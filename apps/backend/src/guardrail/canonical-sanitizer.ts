/**
 * Canonical description sanitizer (indirect injection defense).
 *
 * Indirect injection is the subtlest attack vector: malicious instructions are
 * not supplied by the live user input, they are embedded in authored narrative
 * content (signs, books, NPC dialogue) stored in `rooms.description_canonical`.
 * That text is later inlined into the narrator prompt as game state, so an
 * unprotected model could obey it.
 *
 * This sanitizer runs at WRITE time (World Builder / author save). It rejects
 * descriptions carrying common injection patterns BEFORE they reach the DB,
 * so a poisoned room never persists.
 *
 * Reference: docs/Talebound_Guardrail_e_Implementazione.md section 6.
 *
 * Security note: patterns are simple and linear-time (no nested quantifiers,
 * no lookahead) to stay ReDoS-safe on attacker-controlled input.
 */

/** Outcome of validating a canonical description before persistence. */
export interface ValidationResult {
  /** True when the text is safe to store. */
  valid: boolean;
  /** Machine-readable reason when rejected. */
  reason?: "INJECTION_PATTERN_DETECTED";
  /** Source of the regex that matched, recorded for logging. Present only when rejected. */
  patternMatched?: string;
}

/** Known injection markers that must never appear in authored room content. */
const CANONICAL_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(?:previous|all)\s+instructions/i,
  /system\s*:/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:DAN|free|unrestricted)/i,
  /forget\s+(?:your|all)\s+(?:instructions|rules)/i,
];

/**
 * Validate a canonical room description before it is saved to the database.
 *
 * @param text - The author-supplied canonical description.
 * @returns A result flagging whether the text is safe to persist.
 */
export function validateCanonicalDescription(text: string): ValidationResult {
  for (const pattern of CANONICAL_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        valid: false,
        reason: "INJECTION_PATTERN_DETECTED",
        patternMatched: pattern.source,
      };
    }
  }
  return { valid: true };
}
