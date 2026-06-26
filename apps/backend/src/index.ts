import express from "express";
import { z } from "zod";
import { config } from "./config.js";
import { createRuntimeNarrator } from "./ai/runtime-narrator.js";
import { InMemoryGameStore } from "./game/in-memory-game-store.js";
import { checkInputGuardrail } from "./guardrail/input-guardrail.js";
import {
  getGuardrailBlockMessage,
  getRateLimitMessage,
} from "./guardrail/block-messages.js";
import { createRuntimeClassifier } from "./guardrail/runtime-classifier.js";
import { UserRateLimiter } from "./guardrail/user-rate-limiter.js";

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

const gameStore = new InMemoryGameStore();

const guardrailCheckRequestSchema = z.object({
  campaignId: z.string().min(1),
  campaignTitle: z.string().min(1),
  campaignGenre: z.string().min(1),
  campaignLanguage: z.string().min(1),
  input: z.string(),
});

const gameActionRequestSchema = z.object({
  userId: z.string().min(1),
  action: z.string(),
  slotId: z.string().min(1),
  requestId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignTitle: z.string().min(1),
  campaignGenre: z.string().min(1),
  campaignLanguage: z.string().min(1),
});

const gameNewRequestSchema = z.object({
  userId: z.string().min(1),
  slotId: z.string().min(1),
  campaignId: z.string().min(1),
});

const gameStateQuerySchema = z.object({
  userId: z.string().min(1),
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "talebound-backend" });
});

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

app.post("/game/action", async (req, res) => {
  const parsed = gameActionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;

  const cached = gameStore.getIdempotentResponse(payload.userId, payload.requestId);
  if (cached) {
    return res.status(200).json({ ...cached, idempotentReplay: true });
  }

  const state = gameStore.getOrCreateSlot(
    payload.userId,
    payload.slotId,
    payload.campaignId,
  );

  if (!userRateLimiter.tryConsume(payload.userId)) {
    const response = {
      slotId: payload.slotId,
      requestId: payload.requestId,
      blocked: true,
      reason: "RATE_LIMIT",
      stage: "pre_guardrail",
      narrative: getRateLimitMessage(payload.campaignLanguage),
      gameState: state,
    };
    gameStore.saveIdempotentResponse(payload.userId, payload.requestId, response);
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
    gameStore.saveIdempotentResponse(payload.userId, payload.requestId, response);
    return res.status(200).json(response);
  }

  const narrator = await runtimeNarrator.narrate({
    action: payload.action,
    campaignId: payload.campaignId,
    campaignTitle: payload.campaignTitle,
    campaignGenre: payload.campaignGenre,
    campaignLanguage: payload.campaignLanguage,
  });

  const updatedState = gameStore.applySuccessfulTurn(payload.userId, payload.slotId);

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

  gameStore.saveIdempotentResponse(payload.userId, payload.requestId, response);
  return res.status(200).json(response);
});

app.post("/game/new", (req, res) => {
  const parsed = gameNewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const state = gameStore.startNewGame(
    payload.userId,
    payload.slotId,
    payload.campaignId,
  );

  return res.status(200).json({
    slotId: payload.slotId,
    gameState: state,
  });
});

app.get("/game/state/:slotId", (req, res) => {
  const query = gameStateQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      details: query.error.flatten(),
    });
  }

  const state = gameStore.getSlot(query.data.userId, req.params.slotId);
  if (!state) {
    return res.status(404).json({ error: "SLOT_NOT_FOUND" });
  }

  return res.status(200).json({
    slotId: req.params.slotId,
    gameState: state,
  });
});

const server = app.listen(config.PORT, () => {
  console.log(`Talebound backend in ascolto su :${config.PORT}`);
});

// Graceful shutdown (doc §12): evita stato corrotto durante i deploy.
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
