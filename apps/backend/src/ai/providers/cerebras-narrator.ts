import type { NarratorInput, NarratorProviderResult } from "../narrator-types.js";

const ENDPOINT = "https://api.cerebras.ai/v1/chat/completions";
const MODEL = "llama-3.3-70b";
const TIMEOUT_MS = 2000;

export interface CerebrasNarratorOptions {
  apiKey: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * Calls Cerebras (OpenAI-compatible) to generate a narrative turn.
 * Returns null on any network/API failure so the orchestrator can try the next provider.
 */
export async function callCerebrasNarrator(
  input: NarratorInput,
  options: CerebrasNarratorOptions,
): Promise<NarratorProviderResult | null> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetchFn(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: input.prompt }],
        temperature: 0.7,
        max_tokens: 256,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim().length > 0
      ? { narrative: text.trim(), provider: "cerebras" }
      : null;
  } catch {
    return null;
  }
}
