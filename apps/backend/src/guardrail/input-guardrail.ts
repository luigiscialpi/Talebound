/**
 * Input guardrail orchestrator: the single entry point that decides whether a
 * raw user input may reach the narrator AI. It chains the cheap in-memory
 * pre-filter (L0) with the LLM classifier (L2), enforcing the fail-closed rule
 * from the architecture doc: any classifier error becomes PARSE_ERROR, never
 * VALID.
 *
 * Reference: docs/Talebound_Guardrail_e_Implementazione.md sections 2 and 4.
 *
 * Design notes:
 *  - The L2 classifier is injected as a dependency so this module stays pure and
 *    unit-testable without any network call. Production wires in the real Groq
 *    cascade (with cache and circuit breaker) at the call site.
 *  - L0 runs first and short-circuits: when it blocks, the classifier is never
 *    invoked, saving an LLM call on the ~90% of attacks L0 already catches.
 */

import type { ClassifierResult } from "@talebound/shared";
import { runL0Guardrail, type L0BlockReason, type L0Options } from "./l0.js";

/** Which stage of the pipeline produced the decision. */
export type GuardrailStage = "l0" | "l2";

/**
 * Reason an input was blocked. L0 reasons cover format/known-attack rejections;
 * the remaining values map to non-VALID classifier categories (PARSE_ERROR is
 * shared between a classifier parse failure and a thrown classifier call).
 */
export type InputGuardrailReason =
  | L0BlockReason
  | "OFF_TOPIC"
  | "INAPPROPRIATE"
  | "PARSE_ERROR";

/** Outcome of the full input guardrail pipeline. */
export interface InputGuardrailDecision {
  /** True only when the input may reach the narrator AI. */
  allowed: boolean;
  /** Set only when blocked. */
  reason?: InputGuardrailReason;
  /** Which stage decided. Set only when blocked. */
  stage?: GuardrailStage;
  /** The L0 phrase that matched, for ai_logs. Set only on L0 pattern blocks. */
  patternMatched?: string;
}

/**
 * Async classifier function (L2). Implementations call the LLM cascade and parse
 * the response with parseClassifierResponse; they must resolve to a
 * ClassifierResult and may reject on transport failures (handled fail-closed).
 */
export type ClassifierFn = (input: string) => Promise<ClassifierResult>;

/**
 * Run the input guardrail: L0 pre-filter first, then the injected L2 classifier.
 *
 * @param input Raw user input.
 * @param classify Injected L2 classifier (LLM cascade in production).
 * @param options Optional L0 threshold overrides.
 * @returns The pipeline decision (allowed plus reason/stage when blocked).
 */
export async function checkInputGuardrail(
  input: string,
  classify: ClassifierFn,
  options?: L0Options,
): Promise<InputGuardrailDecision> {
  // Stage L0: cheap, in-memory, ReDoS-safe. Blocks short-circuit the pipeline.
  const l0 = runL0Guardrail(input, options);
  if (l0.blocked) {
    return {
      allowed: false,
      reason: l0.reason,
      stage: "l0",
      patternMatched: l0.patternMatched,
    };
  }

  // Stage L2: LLM classifier. Fail-closed on any transport error.
  let result: ClassifierResult;
  try {
    result = await classify(input);
  } catch {
    // Never fail-open to VALID: a forced classifier error must not bypass L2.
    return { allowed: false, reason: "PARSE_ERROR", stage: "l2" };
  }

  if (result === "VALID") {
    return { allowed: true };
  }

  return { allowed: false, reason: result, stage: "l2" };
}
