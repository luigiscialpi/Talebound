import type { NarratorInput, NarratorProviderResult } from "../narrator-types.js";

export interface GeminiNarratorOptions {
  apiKey: string;
  timeoutMs?: number;
}

const MODEL = "gemini-2.0-flash";
const TIMEOUT_MS = 3000;

/**
 * Calls Gemini via @google/generative-ai SDK to generate a narrative turn.
 * Returns null on any failure so the orchestrator can try the next provider.
 *
 * We import dynamically so the module is skipped at startup when the key is absent,
 * keeping the cold start fast.
 */
export async function callGeminiNarrator(
  input: NarratorInput,
  options: GeminiNarratorOptions,
): Promise<NarratorProviderResult | null> {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(options.apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const resultPromise = model.generateContent(input.prompt);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs),
    );

    const winner = await Promise.race([resultPromise, timeoutPromise]);
    if (!winner) return null;

    const text = winner.response.text().trim();
    return text.length > 0 ? { narrative: text, provider: "gemini" } : null;
  } catch {
    return null;
  }
}
