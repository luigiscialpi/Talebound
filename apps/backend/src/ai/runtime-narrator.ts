import { checkOutputGuardrail } from "../guardrail/output-guardrail.js";
import { NarratorCache } from "./narrator-cache.js";
import { callGeminiNarrator } from "./providers/gemini-narrator.js";
import { callGroqNarrator } from "./providers/groq-narrator.js";
import { callCerebrasNarrator } from "./providers/cerebras-narrator.js";
import type {
  NarratorInput,
  NarratorResult,
  NarratorProviderResult,
} from "./narrator-types.js";

// Re-export types so existing callers that import from this module still work.
export type { NarratorInput, NarratorResult };

export interface RuntimeNarratorOptions {
  geminiApiKey?: string;
  groqApiKey?: string;
  cerebrasApiKey?: string;
  timeoutMs?: number;
  /** Injected in tests to skip real HTTP calls. */
  fetchFn?: typeof fetch;
  /** Override cache instance (e.g. in tests). */
  cache?: NarratorCache;
}

function buildPrompt(input: {
  action: string;
  campaignTitle: string;
  campaignGenre: string;
  campaignLanguage: string;
}): string {
  return [
    "Sei il Narratore di un'avventura testuale.",
    `Titolo campagna: ${input.campaignTitle}`,
    `Genere: ${input.campaignGenre}`,
    `Lingua: ${input.campaignLanguage}`,
    `Azione del giocatore: ${input.action}`,
    "",
    "Rispondi con 2-4 frasi in tono narrativo in-personaggio, senza meta-commenti.",
  ].join("\n");
}

function fallbackNarrative(language: string): string {
  return language.toLowerCase().startsWith("it")
    ? "Il Narratore prende fiato un istante. L'avventura prosegue: descrivi la tua prossima azione."
    : "The Narrator pauses for a moment. The adventure continues: describe your next action.";
}

/**
 * Multi-provider narrator orchestrator (doc §10).
 *
 * Provider priority: Gemini -> Groq -> Cerebras -> static fallback.
 * Each provider is skipped if its API key is absent.
 * Results are cached by (campaignId, action) using an LRU+TTL cache.
 */
export function createRuntimeNarrator(options: RuntimeNarratorOptions): {
  narrate: (input: {
    action: string;
    campaignId: string;
    campaignTitle: string;
    campaignGenre: string;
    campaignLanguage: string;
  }) => Promise<NarratorResult>;
} {
  const cache = options.cache ?? new NarratorCache();

  return {
    narrate: async (raw): Promise<NarratorResult> => {
      const cacheKey = NarratorCache.buildKey(raw.campaignId, raw.action);
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const prompt = buildPrompt(raw);
      const narratorInput: NarratorInput = { prompt, ...raw };

      // Build the provider chain — only include providers whose keys are set.
      const chain: Array<() => Promise<NarratorProviderResult | null>> = [];

      if (options.geminiApiKey) {
        chain.push(() =>
          callGeminiNarrator(narratorInput, {
            apiKey: options.geminiApiKey!,
            timeoutMs: options.timeoutMs,
          }),
        );
      }

      if (options.groqApiKey) {
        chain.push(() =>
          callGroqNarrator(narratorInput, {
            apiKey: options.groqApiKey!,
            timeoutMs: options.timeoutMs,
            fetchFn: options.fetchFn,
          }),
        );
      }

      if (options.cerebrasApiKey) {
        chain.push(() =>
          callCerebrasNarrator(narratorInput, {
            apiKey: options.cerebrasApiKey!,
            timeoutMs: options.timeoutMs,
            fetchFn: options.fetchFn,
          }),
        );
      }

      // Try each provider in order; stop at the first success.
      let providerResult: NarratorProviderResult | null = null;
      for (const call of chain) {
        providerResult = await call();
        if (providerResult) break;
      }

      // No provider succeeded -> static fallback.
      if (!providerResult) {
        const result: NarratorResult = {
          narrative: fallbackNarrative(raw.campaignLanguage),
          provider: "fallback",
          outputGuardrailTriggered: false,
          cached: false,
        };
        // Do not cache the fallback — we want a real provider to succeed next time.
        return result;
      }

      // Output guardrail on the AI-generated text.
      const outputScan = checkOutputGuardrail(providerResult.narrative);
      if (outputScan.triggered) {
        const result: NarratorResult = {
          narrative: fallbackNarrative(raw.campaignLanguage),
          provider: "fallback",
          outputGuardrailTriggered: true,
          outputGuardrailPattern: outputScan.patternMatched,
          cached: false,
        };
        // Do not cache guardrail-blocked responses.
        return result;
      }

      const result: NarratorResult = {
        narrative: providerResult.narrative,
        provider: providerResult.provider,
        outputGuardrailTriggered: false,
        cached: false,
      };

      cache.set(cacheKey, result);
      return result;
    },
  };
}
