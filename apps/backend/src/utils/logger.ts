/**
 * Structured logger for Talebound backend.
 * Outputs logs in JSON format for easy ingestion by log aggregators
 * and querying in production environments (like Supabase or Railway).
 *
 * Reference: docs/Talebound_Architettura_completa.md §12 (Logging strutturato).
 */

export const logger = {
  info(obj: Record<string, any>, msg?: string) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        ...obj,
        ...(msg ? { msg } : {}),
      })
    );
  },

  warn(obj: Record<string, any>, msg?: string) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        ...obj,
        ...(msg ? { msg } : {}),
      })
    );
  },

  error(obj: Record<string, any>, msg?: string) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        ...obj,
        ...(msg ? { msg } : {}),
      })
    );
  },
};
