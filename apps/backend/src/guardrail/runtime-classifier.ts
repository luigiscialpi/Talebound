import type { ClassifierResult } from "@talebound/shared";
import { ClassifierCircuitBreaker } from "./classifier-circuit-breaker.js";
import { ClassifierLRUCache } from "./classifier-cache.js";
import {
  classifyWithGroq,
  type ClassifierPromptInput,
  type GroqClassifierOptions,
} from "./classifier-groq.js";
import { ClassifierService } from "./classifier-service.js";

export interface RuntimeClassifierOptions {
  groqApiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  onCircuitOpen?: () => void;
}

export interface RuntimeClassifierContext extends ClassifierPromptInput {
  campaignId: string;
}

/**
 * Runtime classifier wiring used by the HTTP layer.
 *
 * It binds the pure classifier service to the Groq adapter and environment
 * values. Missing API key is handled fail-closed by returning PARSE_ERROR.
 */
export function createRuntimeClassifier(options: RuntimeClassifierOptions): {
  classify: (context: RuntimeClassifierContext) => Promise<ClassifierResult>;
} {
  const cache = new ClassifierLRUCache();
  const breaker = new ClassifierCircuitBreaker({
    onOpen: options.onCircuitOpen,
  });

  const groqOptionsBase: Omit<GroqClassifierOptions, "apiKey"> = {
    timeoutMs: options.timeoutMs,
    fetchFn: options.fetchFn,
    sleep: options.sleep,
  };

  const service = new ClassifierService(async (context) => {
    if (!options.groqApiKey) {
      throw new Error("GROQ_API_KEY is missing");
    }

    return classifyWithGroq(context, {
      apiKey: options.groqApiKey,
      ...groqOptionsBase,
    });
  }, { cache, circuitBreaker: breaker });

  return {
    classify: (context) => service.classify(context),
  };
}
