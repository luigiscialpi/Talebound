import express from "express";
import { z } from "zod";
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

const app = express();
app.use(express.json());

const runtimeClassifier = createRuntimeClassifier({
  groqApiKey: config.GROQ_API_KEY,
  timeoutMs: config.CLASSIFIER_TIMEOUT_MS,
  onCircuitOpen: () => {
    // Temporary console logging for MVP observability.
    console.warn("[guardrail] classifier circuit breaker opened");
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
  // userId is sourced from the verified JWT claim, not from the request body.
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing user claim" });
  }

  const parsed = gameActionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;

  const cached = gameStore.getIdempotentResponse(userId, payload.requestId);
  if (cached) {
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
    return res.status(429).json(response);
  }

  const decision = await checkInputGuardrail(payload.action, (input) =>
    runtimeClassifier.classify({
      campaignId: payload.campaignId,
      campaignTitle: payload.campaignTitle,
      campaignGenre: payload.campaignGenre,
      campaignLanguage: payload.campaignLanguage,
      userInput: input,
    }),
  );

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
    return res.status(200).json(response);
  }

  const room = await gameStore.getRoom(payload.campaignId, state.currentRoomId);
  const history = state.history ?? [];
  const { compressedHistory } = compressHistory(history);

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
  return res.status(200).json(response);
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
