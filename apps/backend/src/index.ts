import express from "express";
import { z } from "zod";
import { config } from "./config.js";
import { createRuntimeNarrator } from "./ai/runtime-narrator.js";
import { checkInputGuardrail } from "./guardrail/input-guardrail.js";
import { getGuardrailBlockMessage } from "./guardrail/block-messages.js";
import { createRuntimeClassifier } from "./guardrail/runtime-classifier.js";

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
  groqApiKey: config.GROQ_API_KEY,
});

const guardrailCheckRequestSchema = z.object({
  campaignId: z.string().min(1),
  campaignTitle: z.string().min(1),
  campaignGenre: z.string().min(1),
  campaignLanguage: z.string().min(1),
  input: z.string(),
});

const gameActionRequestSchema = z.object({
  action: z.string(),
  slotId: z.string().min(1),
  requestId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignTitle: z.string().min(1),
  campaignGenre: z.string().min(1),
  campaignLanguage: z.string().min(1),
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
    return res.status(200).json({
      slotId: payload.slotId,
      requestId: payload.requestId,
      blocked: true,
      reason: decision.reason,
      stage: decision.stage,
      narrative: getGuardrailBlockMessage(
        decision.reason ?? "PARSE_ERROR",
        payload.campaignLanguage,
      ),
    });
  }

  const narrator = await runtimeNarrator.narrate({
    action: payload.action,
    campaignTitle: payload.campaignTitle,
    campaignGenre: payload.campaignGenre,
    campaignLanguage: payload.campaignLanguage,
  });

  return res.status(200).json({
    slotId: payload.slotId,
    requestId: payload.requestId,
    blocked: false,
    narrative: narrator.narrative,
    provider: narrator.provider,
    outputGuardrailTriggered: narrator.outputGuardrailTriggered,
    outputGuardrailPattern: narrator.outputGuardrailPattern,
  });
});

const server = app.listen(config.PORT, () => {
  console.log(`Talebound backend in ascolto su :${config.PORT}`);
});

// Graceful shutdown (doc §12): evita stato corrotto durante i deploy.
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
