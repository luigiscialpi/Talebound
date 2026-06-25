/**
 * Output guardrail (layer L-out).
 *
 * Runs AFTER the narrator AI produces a response. Cheap (~5ms) regex scan that
 * rejects responses leaking the system prompt or carrying malicious
 * instructions the client might execute. When triggered, the caller discards
 * the narrator response and does NOT advance game state.
 *
 * Reference: docs/Talebound_Guardrail_e_Implementazione.md section 5.
 *
 * Security note: only simple regex are allowed here. No lookahead, no nested
 * quantifiers. Complex regex over long strings are ReDoS-prone -- an attacker
 * could craft input that makes the engine run for seconds. The patterns below
 * are linear-time.
 */

/** Result of an output guardrail scan, shaped for ai_logs auditing. */
export interface OutputGuardrailResult {
  /** True when a forbidden pattern matched and the response must be discarded. */
  triggered: boolean;
  /** Source of the regex that matched, recorded for logging. Present only when triggered. */
  patternMatched?: string;
}

/**
 * Labeled, ReDoS-safe patterns scanned against narrator output.
 * The label is stored in ai_logs instead of the raw response to avoid leaking
 * sensitive narrative content into logs.
 */
const OUTPUT_PATTERNS: readonly RegExp[] = [
  /system\s*prompt/i,
  /le mie istruzioni sono/i,
  /come (?:AI|modello) linguistico/i,
  /ignore\s+previous/i,
  /regole di sicurezza/i,
  /\bDAN\b/,
  /sei libero di/i,
  /dimentica le istruzioni/i,
];

/**
 * Scan a narrator response for leakage or malicious instructions.
 *
 * @param response - The raw text produced by the narrator AI.
 * @returns A result flagging whether the response must be discarded.
 */
export function checkOutputGuardrail(response: string): OutputGuardrailResult {
  for (const pattern of OUTPUT_PATTERNS) {
    if (pattern.test(response)) {
      return { triggered: true, patternMatched: pattern.source };
    }
  }
  return { triggered: false };
}
