import { z } from "zod";

const optionalEnv = {
  string: () =>
    z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
  url: () =>
    z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
};

/**
 * Config centralizzato validato con Zod (doc §12).
 * In questa fase di scaffolding le chiavi dei servizi esterni sono opzionali
 * per permettere l'avvio locale; vanno rese obbligatorie prima della produzione.
 */
const configSchema = z.object({
  PORT: z.coerce.number().default(3000),

  // Servizi esterni (compilare in .env prima di usare le relative feature).
  SUPABASE_URL: optionalEnv.url(),
  SUPABASE_SERVICE_ROLE_KEY: optionalEnv.string(),
  SUPABASE_JWT_SECRET: optionalEnv.string(),
  GEMINI_API_KEY: optionalEnv.string(),
  GROQ_API_KEY: optionalEnv.string(),
  CEREBRAS_API_KEY: optionalEnv.string(),

  // Sicurezza.
  HMAC_SECRET: z
    .string()
    .min(32, "HMAC_SECRET deve avere almeno 32 caratteri")
    .default("dev-only-secret-change-me-32characters"),

  // Opzionali.
  REDIS_URL: optionalEnv.url(),
  SLACK_WEBHOOK_URL: optionalEnv.url(),
  MAX_INPUT_LENGTH: z.coerce.number().default(500),
  CLASSIFIER_TIMEOUT_MS: z.coerce.number().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(20),
});

export const config = configSchema.parse(process.env);
