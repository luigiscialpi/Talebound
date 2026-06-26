import type { ClassifierResult } from "@talebound/shared";
import { parseClassifierResponse } from "./classifier-parser.js";
import { ClassifierCircuitBreaker } from "./classifier-circuit-breaker.js";
import { ClassifierLRUCache, getCacheKey } from "./classifier-cache.js";
import type { ClassifierPromptInput } from "./classifier-groq.js";
import { logger } from "../utils/logger.js";

export interface ClassifierServiceContext extends ClassifierPromptInput {
  campaignId: string;
}

export type RawClassifierFn = (
  input: ClassifierPromptInput,
) => Promise<string>;

export interface ClassifierServiceOptions {
  cache?: ClassifierLRUCache;
  circuitBreaker?: ClassifierCircuitBreaker;
  parseResponse?: (raw: string) => ClassifierResult;
}

/**
 * Pure orchestration for classifier calls:
 * cache -> circuit-breaker gate -> raw provider -> parser -> cache/breaker updates.
 */
export class ClassifierService {
  private readonly cache: ClassifierLRUCache;
  private readonly circuitBreaker: ClassifierCircuitBreaker;
  private readonly parseResponse: (raw: string) => ClassifierResult;

  constructor(
    private readonly classifyRaw: RawClassifierFn,
    options?: ClassifierServiceOptions,
  ) {
    this.cache = options?.cache ?? new ClassifierLRUCache();
    this.circuitBreaker =
      options?.circuitBreaker ?? new ClassifierCircuitBreaker();
    this.parseResponse = options?.parseResponse ?? parseClassifierResponse;
  }

  /** Classify input with fail-closed semantics (returns PARSE_ERROR on failure). */
  async classify(context: ClassifierServiceContext): Promise<ClassifierResult> {
    const key = getCacheKey(context.userInput, context.campaignId);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    if (!this.circuitBreaker.canAttempt()) {
      logger.warn({ event: "classifier_breaker_open" }, "Classifier breaker open, blocking request");
      return "PARSE_ERROR";
    }

    try {
      const raw = await this.classifyRaw(context);
      const parsed = this.parseResponse(raw);

      if (parsed === "PARSE_ERROR") {
        this.circuitBreaker.recordFailure();
        logger.warn({
          event: "classifier_parse_error",
          rawResponse: raw,
        }, "Failed to parse classifier response");
        return "PARSE_ERROR";
      }

      this.circuitBreaker.recordSuccess();
      this.cache.set(key, parsed);
      return parsed;
    } catch (err: any) {
      this.circuitBreaker.recordFailure();
      logger.error({
        event: "classifier_service_error",
        error: err?.message || err,
        stack: err?.stack,
      }, "Classifier service error");
      return "PARSE_ERROR";
    }
  }
}
