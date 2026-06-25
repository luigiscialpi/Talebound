/**
 * L0 input guardrail: the cheap, ReDoS-safe pre-filter that runs before the LLM
 * classifier (L2). It blocks the ~90% of known attacks recognizable without an
 * LLM call: obvious injections, meta-AI probing, game-state exploits, plus basic
 * format abuse (empty, over-length, mostly non-printable input).
 *
 * Reference: docs/Talebound_Guardrail_e_Implementazione.md section 2.
 *
 * Design rules from the doc:
 *  - REJECT, never truncate: silently slicing input to the limit teaches an
 *    attacker exactly where to hide a payload. We reject the whole input instead.
 *  - No regex with backtracking: phrase matching uses plain case-insensitive
 *    substring search, so a crafted input cannot trigger ReDoS.
 */

import { L0_PATTERNS } from "./l0-patterns.js";

/** Reason an input was blocked by L0. */
export type L0BlockReason =
  | "EMPTY_INPUT"
  | "INPUT_TOO_LONG"
  | "NON_PRINTABLE"
  | "INJECTION"
  | "EXPLOIT";

/** Outcome of running the L0 pre-filter on a single input. */
export interface L0Result {
  blocked: boolean;
  /** Set only when blocked. */
  reason?: L0BlockReason;
  /** The literal phrase that matched, for ai_logs.l0_pattern_matched. */
  patternMatched?: string;
}

/** Tunable L0 thresholds. Defaults follow the architecture doc (section 2). */
export interface L0Options {
  /** Max accepted input length in code points (reject above). Default 500. */
  maxLength?: number;
  /** Block if the non-printable ratio exceeds this fraction. Default 0.5. */
  nonPrintableRatio?: number;
}

const DEFAULT_MAX_LENGTH = 500;
const DEFAULT_NON_PRINTABLE_RATIO = 0.5;

// Whitespace that is legitimate in normal prose and must not count as
// "non-printable" when measuring the control-character ratio.
const ALLOWED_WHITESPACE = new Set(["\t", "\n", "\r", " "]);

// Matches a single Unicode "Other" code point (control, format, surrogate,
// private-use, unassigned). Applied per code point, so there is no backtracking.
const CONTROL_CODE_POINT = /\p{C}/u;

/**
 * Count code points that are control/non-printable, excluding normal whitespace.
 */
function countNonPrintable(codePoints: readonly string[]): number {
  let count = 0;
  for (const ch of codePoints) {
    if (ALLOWED_WHITESPACE.has(ch)) {
      continue;
    }
    if (CONTROL_CODE_POINT.test(ch)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Run the L0 pre-filter. Checks are ordered so cheaper/format checks run first
 * and the length check precedes pattern matching (an over-length input is
 * rejected before we ever scan for a payload hidden past the limit).
 *
 * @param input Raw user input.
 * @param options Optional threshold overrides.
 * @returns Whether the input is blocked, and why.
 */
export function runL0Guardrail(input: string, options?: L0Options): L0Result {
  const maxLength = options?.maxLength ?? DEFAULT_MAX_LENGTH;
  const nonPrintableRatio =
    options?.nonPrintableRatio ?? DEFAULT_NON_PRINTABLE_RATIO;

  // Empty / whitespace-only input.
  if (input.trim().length === 0) {
    return { blocked: true, reason: "EMPTY_INPUT" };
  }

  // Count code points once (correct for emoji / astral characters).
  const codePoints = Array.from(input);

  // Over-length: reject, do not truncate.
  if (codePoints.length > maxLength) {
    return { blocked: true, reason: "INPUT_TOO_LONG" };
  }

  // Mostly non-printable input (e.g. binary/control-char flooding).
  if (countNonPrintable(codePoints) / codePoints.length > nonPrintableRatio) {
    return { blocked: true, reason: "NON_PRINTABLE" };
  }

  // Known attack phrases (case-insensitive substring match, ReDoS-safe).
  const haystack = input.toLowerCase();
  for (const pattern of L0_PATTERNS) {
    if (haystack.includes(pattern.phrase)) {
      return {
        blocked: true,
        reason: pattern.category,
        patternMatched: pattern.phrase,
      };
    }
  }

  return { blocked: false };
}
