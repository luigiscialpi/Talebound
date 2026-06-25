import express from "express";
import { z } from "zod";
import { config } from "./config.js";
import { checkInputGuardrail } from "./guardrail/input-guardrail.js";
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

const guardrailCheckRequestSchema = z.object({
  campaignId: z.string().min(1),
  campaignTitle: z.string().min(1),
  campaignGenre: z.string().min(1),
  campaignLanguage: z.string().min(1),
  input: z.string(),
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

const server = app.listen(config.PORT, () => {
  console.log(`Talebound backend in ascolto su :${config.PORT}`);
});

// Graceful shutdown (doc §12): evita stato corrotto durante i deploy.
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
