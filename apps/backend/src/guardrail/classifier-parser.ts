import type { ClassifierResult } from "@talebound/shared";

/**
 * L2 classifier response parser.
 *
 * The classifier is prompted to answer with ONE English word naming the
 * category. Real LLMs are messy though: trailing newlines, casing, punctuation,
 * emoji decoration, or extra words. This parser normalizes that output.
 *
 * Critical security property: it is FAIL-CLOSED. Any output that does not map
 * to a known category becomes PARSE_ERROR, never VALID. Fail-open (treating
 * parse errors as VALID) is the most common bypass in classification systems:
 * an attacker who learns to trigger parse errors would skip the classifier
 * entirely.
 *
 * Reference: docs/Talebound_Guardrail_e_Implementazione.md section 4.
 */

/**
 * Recognized categories, excluding PARSE_ERROR. PARSE_ERROR is the failure
 * sentinel only -- it must never be selectable from model output.
 */
const KNOWN_CATEGORIES: readonly ClassifierResult[] = [
  "VALID",
  "OFF_TOPIC",
  "INJECTION",
  "INAPPROPRIATE",
  "EXPLOIT",
];

/**
 * Parse a raw classifier response into a ClassifierResult.
 *
 * Strategy: scan whitespace-separated tokens, strip each to A-Z and underscore,
 * and return the first token matching a known category. Token scanning (rather
 * than first-word-only) handles observed real cases like emoji-decorated output
 * ("\u{1F3AD} VALID \u{1F3AD}") while staying fail-closed: if no token matches,
 * the result is PARSE_ERROR.
 *
 * @param raw - The raw text returned by the classifier model.
 * @returns A recognized ClassifierResult, or PARSE_ERROR when unrecognized.
 */
export function parseClassifierResponse(raw: string): ClassifierResult {
  // Trust boundary: the value comes from an external LLM call. Guard against
  // non-string input so a malformed response can never crash the caller.
  if (typeof raw !== "string") {
    return "PARSE_ERROR";
  }

  const tokens = raw.trim().toUpperCase().split(/\s+/);
  for (const token of tokens) {
    const normalized = token.replace(/[^A-Z_]/g, "");
    if ((KNOWN_CATEGORIES as readonly string[]).includes(normalized)) {
      return normalized as ClassifierResult;
    }
  }

  // Fail-closed: never default to VALID on unrecognized output.
  return "PARSE_ERROR";
}
