import express from "express";
import { z } from "zod";
import crypto from "crypto";
import { config } from "./config.js";
import { createRuntimeNarrator } from "./ai/runtime-narrator.js";
import { InMemoryGameStore } from "./game/in-memory-game-store.js";
import { SupabaseGameStore } from "./game/supabase-game-store.js";
import { checkInputGuardrail } from "./guardrail/input-guardrail.js";
import { compressHistory } from "./ai/headroom.js";
import {
  getGuardrailBlockMessage,
  getRateLimitMessage,
} from "./guardrail/block-messages.js";
import { createRuntimeClassifier } from "./guardrail/runtime-classifier.js";
import { UserRateLimiter } from "./guardrail/user-rate-limiter.js";
import { authMiddleware } from "./middleware/auth-middleware.js";
import { logger } from "./utils/logger.js";
import { getCacheKey } from "./guardrail/classifier-cache.js";

const app = express();
app.use(express.json());

// Global request logger middleware (structured logs)
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on("finish", () => {
    const latency = Date.now() - startTime;
    logger.info({
      event: "http_request",
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      latencyMs: latency,
    }, `${req.method} ${req.originalUrl || req.url} - ${res.statusCode} (${latency}ms)`);
  });
  next();
});


const runtimeClassifier = createRuntimeClassifier({
  groqApiKey: config.GROQ_API_KEY,
  timeoutMs: config.CLASSIFIER_TIMEOUT_MS,
  onCircuitOpen: () => {
    logger.warn({ event: "classifier_circuit_breaker_opened" }, "Classifier circuit breaker opened");
  },
});

const runtimeNarrator = createRuntimeNarrator({
  geminiApiKey: config.GEMINI_API_KEY,
  groqApiKey: config.GROQ_API_KEY,
  cerebrasApiKey: config.CEREBRAS_API_KEY,
});

const userRateLimiter = new UserRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
});

const gameStore =
  config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseGameStore({
        supabaseUrl: config.SUPABASE_URL,
        serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
      })
    : new InMemoryGameStore();

const guardrailCheckRequestSchema = z.object({
  campaignId: z.string().min(1),
  campaignTitle: z.string().min(1),
  campaignGenre: z.string().min(1),
  campaignLanguage: z.string().min(1),
  input: z.string(),
});

const gameActionRequestSchema = z.object({
  // userId is NOT accepted from the body: it is extracted from the verified JWT
  // (req.user.sub) to prevent spoofing.
  action: z.string(),
  slotId: z.string().min(1),
  requestId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignTitle: z.string().min(1),
  campaignGenre: z.string().min(1),
  campaignLanguage: z.string().min(1),
});

const gameNewRequestSchema = z.object({
  slotId: z.string().min(1),
  campaignId: z.string().min(1),
});

const gameStateQuerySchema = z.object({
  campaignId: z.string().min(1).optional(),
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "talebound-backend" });
});

// All /game/* routes require a valid Supabase JWT.
const gameRouter = express.Router();
gameRouter.use(authMiddleware);

app.post("/guardrail/check", async (req, res) => {
  const parsed = guardrailCheckRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const decision = await checkInputGuardrail(payload.input, (input) =>
    runtimeClassifier.classify({
      campaignId: payload.campaignId,
      campaignTitle: payload.campaignTitle,
      campaignGenre: payload.campaignGenre,
      campaignLanguage: payload.campaignLanguage,
      userInput: input,
    }),
  );

  return res.json({ decision });
});

gameRouter.post("/action", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing user claim" });
  }

  const correlationId = (req.headers["x-correlation-id"] || crypto.randomUUID()) as string;
  res.setHeader("x-correlation-id", correlationId);

  const startTime = Date.now();
  logger.info({ correlationId, event: "turn_started", userId, campaignId: req.body?.campaignId }, "Turn started");

  try {
    const parsed = gameActionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.error({
        event: "bad_request",
        correlationId,
        userId,
        campaignId: req.body?.campaignId,
        details: parsed.error.flatten(),
      }, "Invalid payload request");
      return res.status(400).json({
        error: "BAD_REQUEST",
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;

    const inputHash = crypto.createHmac("sha256", config.HMAC_SECRET)
      .update(payload.action)
      .digest("hex");

    const cached = gameStore.getIdempotentResponse(userId, payload.requestId);
    if (cached) {
      logger.info({
        event: "idempotent_replay",
        correlationId,
        userId,
        campaignId: payload.campaignId,
        requestId: payload.requestId,
      }, "Idempotent response replayed");
      return res.status(200).json({ ...cached, idempotentReplay: true });
    }

    const state = await gameStore.getOrCreateSlot(
      userId,
      payload.slotId,
      payload.campaignId,
    );

    if (!userRateLimiter.tryConsume(userId)) {
      const response = {
        slotId: payload.slotId,
        requestId: payload.requestId,
        blocked: true,
        reason: "RATE_LIMIT",
        stage: "pre_guardrail",
        narrative: getRateLimitMessage(payload.campaignLanguage),
        gameState: state,
      };
      gameStore.saveIdempotentResponse(userId, payload.requestId, response);

      await gameStore.saveAiLog({
        user_id: userId,
        correlation_id: correlationId,
        session_id: payload.slotId,
        turn_number: state.turnNumber,
        campaign_id: payload.campaignId,
        room_id: state.currentRoomId,
        user_input_hash: inputHash,
        input_length: payload.action.length,
        l0_blocked: false,
        l0_pattern_matched: null,
        classifier_result: "PARSE_ERROR",
        classifier_model: null,
        classifier_latency_ms: null,
        classifier_cached: false,
        narrator_called: false,
        narrator_provider: null,
        narrator_latency_ms: null,
        headroom_ratio: null,
        output_guardrail_triggered: null,
        indirect_injection_suspected: null,
      });

      logger.warn({
        event: "rate_limit_exceeded",
        correlationId,
        userId,
        campaignId: payload.campaignId,
        latencyMs: Date.now() - startTime,
      }, "Rate limit exceeded for user");

      return res.status(429).json(response);
    }

    const cacheKey = getCacheKey(payload.action, payload.campaignId);
    const isCached = runtimeClassifier.cache.get(cacheKey) !== undefined;

    let classifierLatency: number | null = null;
    const startClassifier = Date.now();

    const decision = await checkInputGuardrail(payload.action, async (input) => {
      const result = await runtimeClassifier.classify({
        campaignId: payload.campaignId,
        campaignTitle: payload.campaignTitle,
        campaignGenre: payload.campaignGenre,
        campaignLanguage: payload.campaignLanguage,
        userInput: input,
      });
      return result;
    });

    if (decision.stage === "l2") {
      classifierLatency = Date.now() - startClassifier;
    }

    if (!decision.allowed) {
      const response = {
        slotId: payload.slotId,
        requestId: payload.requestId,
        blocked: true,
        reason: decision.reason,
        stage: decision.stage,
        narrative: getGuardrailBlockMessage(
          decision.reason ?? "PARSE_ERROR",
          payload.campaignLanguage,
        ),
        gameState: state,
      };
      gameStore.saveIdempotentResponse(userId, payload.requestId, response);

      await gameStore.saveAiLog({
        user_id: userId,
        correlation_id: correlationId,
        session_id: payload.slotId,
        turn_number: state.turnNumber,
        campaign_id: payload.campaignId,
        room_id: state.currentRoomId,
        user_input_hash: inputHash,
        input_length: payload.action.length,
        l0_blocked: decision.stage === "l0",
        l0_pattern_matched: decision.patternMatched ?? null,
        classifier_result: decision.reason ?? "PARSE_ERROR",
        classifier_model: decision.stage === "l2" ? "llama-3.1-8b-instant" : null,
        classifier_latency_ms: classifierLatency,
        classifier_cached: decision.stage === "l2" ? isCached : false,
        narrator_called: false,
        narrator_provider: null,
        narrator_latency_ms: null,
        headroom_ratio: null,
        output_guardrail_triggered: null,
        indirect_injection_suspected: null,
      });

      logger.warn({
        event: "input_guardrail_blocked",
        correlationId,
        userId,
        campaignId: payload.campaignId,
        stage: decision.stage,
        reason: decision.reason,
        patternMatched: decision.patternMatched,
        latencyMs: Date.now() - startTime,
      }, "Input guardrail blocked the action");

      return res.status(200).json(response);
    }

    const room = await gameStore.getRoom(payload.campaignId, state.currentRoomId);
    const history = state.history ?? [];
    const { compressedHistory, headroomRatio } = compressHistory(history);

    const startNarrator = Date.now();
    const narrator = await runtimeNarrator.narrate({
      action: payload.action,
      campaignId: payload.campaignId,
      campaignTitle: payload.campaignTitle,
      campaignGenre: payload.campaignGenre,
      campaignLanguage: payload.campaignLanguage,
      roomName: room?.name,
      roomDescription: room?.descriptionCanonical,
      roomItems: room?.itemsInitial,
      health: state.health,
      energy: state.energy,
      inventory: state.inventory,
      compressedHistory,
    });
    const narratorLatency = Date.now() - startNarrator;

    let updatedState = state;
    if (!narrator.outputGuardrailTriggered) {
      const newHistory = [...history, { action: payload.action, narrative: narrator.narrative }];
      if (newHistory.length > 10) {
        newHistory.shift();
      }
      updatedState = await gameStore.applySuccessfulTurn(
        userId,
        payload.slotId,
        payload.campaignId,
        newHistory,
      );
    }

    const response = {
      slotId: payload.slotId,
      requestId: payload.requestId,
      blocked: false,
      narrative: narrator.narrative,
      provider: narrator.provider,
      outputGuardrailTriggered: narrator.outputGuardrailTriggered,
      outputGuardrailPattern: narrator.outputGuardrailPattern,
      gameState: updatedState,
    };

    gameStore.saveIdempotentResponse(userId, payload.requestId, response);

    const indirectInjectionSuspected = narrator.outputGuardrailTriggered && room?.descriptionCanonical ? true : false;

    await gameStore.saveAiLog({
      user_id: userId,
      correlation_id: correlationId,
      session_id: payload.slotId,
      turn_number: state.turnNumber,
      campaign_id: payload.campaignId,
      room_id: state.currentRoomId,
      user_input_hash: inputHash,
      input_length: payload.action.length,
      l0_blocked: false,
      l0_pattern_matched: null,
      classifier_result: "VALID",
      classifier_model: decision.stage === "l2" ? "llama-3.1-8b-instant" : null,
      classifier_latency_ms: classifierLatency,
      classifier_cached: decision.stage === "l2" ? isCached : false,
      narrator_called: true,
      narrator_provider: narrator.cached ? "cache" : narrator.provider,
      narrator_latency_ms: narratorLatency,
      headroom_ratio: headroomRatio,
      output_guardrail_triggered: narrator.outputGuardrailTriggered,
      indirect_injection_suspected: indirectInjectionSuspected,
    });

    if (narrator.outputGuardrailTriggered) {
      logger.warn({
        event: "output_guardrail_triggered",
        correlationId,
        userId,
        campaignId: payload.campaignId,
        outputGuardrailPattern: narrator.outputGuardrailPattern,
        indirectInjectionSuspected,
        latencyMs: Date.now() - startTime,
      }, "Output guardrail triggered on narrator response");
    } else {
      logger.info({
        event: "turn_completed",
        correlationId,
        userId,
        campaignId: payload.campaignId,
        turnNumber: state.turnNumber,
        classifierCached: isCached,
        classifierLatencyMs: classifierLatency,
        narratorProvider: narrator.provider,
        narratorLatencyMs: narratorLatency,
        headroomRatio,
        latencyMs: Date.now() - startTime,
      }, "Turn completed successfully");
    }

    return res.status(200).json(response);
  } catch (error: any) {
    logger.error({
      event: "game_action_handler_failed",
      correlationId,
      userId,
      campaignId: req.body?.campaignId,
      error: error.message,
      stack: error.stack,
      latencyMs: Date.now() - startTime,
    }, "Game action handler failed");
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Si è verificato un errore imprevisto." });
  }
});

gameRouter.post("/new", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing user claim" });
  }

  const parsed = gameNewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const state = await gameStore.startNewGame(
    userId,
    payload.slotId,
    payload.campaignId,
  );

  return res.status(200).json({
    slotId: payload.slotId,
    gameState: state,
  });
});

gameRouter.get("/state/:slotId", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing user claim" });
  }

  const query = gameStateQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      details: query.error.flatten(),
    });
  }

  const state = await gameStore.getSlot(
    userId,
    req.params.slotId,
    query.data.campaignId,
  );
  if (!state) {
    return res.status(404).json({ error: "SLOT_NOT_FOUND" });
  }

  return res.status(200).json({
    slotId: req.params.slotId,
    gameState: state,
  });
});

// Mount the authenticated game router.
app.use("/game", gameRouter);

const server = app.listen(config.PORT, () => {
  console.log(`Talebound backend in ascolto su :${config.PORT}`);
});

// Graceful shutdown (doc §12): evita stato corrotto durante i deploy.
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
