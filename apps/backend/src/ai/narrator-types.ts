// Shared types for the narrator orchestrator and provider adapters.

export interface NarratorInput {
  /** Pre-built prompt string for the LLM. */
  prompt: string;
  /** Original player action — used for cache key hashing. */
  action: string;
  campaignId: string;
  campaignTitle: string;
  campaignGenre: string;
  campaignLanguage: string;
}

export type NarratorProvider = "gemini" | "groq" | "cerebras" | "fallback";

export interface NarratorProviderResult {
  narrative: string;
  provider: Exclude<NarratorProvider, "fallback">;
}

export interface NarratorResult {
  narrative: string;
  provider: NarratorProvider;
  outputGuardrailTriggered: boolean;
  outputGuardrailPattern?: string;
  /** True when the response was served from the LRU cache. */
  cached: boolean;
}
