import { checkOutputGuardrail } from "../guardrail/output-guardrail.js";

const DEFAULT_GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_TIMEOUT_MS = 1200;

export interface NarratorInput {
  action: string;
  campaignTitle: string;
  campaignGenre: string;
  campaignLanguage: string;
}

export interface RuntimeNarratorOptions {
  groqApiKey?: string;
  timeoutMs?: number;
  endpoint?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

export interface NarratorResult {
  narrative: string;
  provider: "groq" | "fallback";
  outputGuardrailTriggered: boolean;
  outputGuardrailPattern?: string;
}

function buildNarratorPrompt(input: NarratorInput): string {
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
 * Runtime narrator adapter for MVP.
 *
 * If GROQ_API_KEY is missing or provider call fails, returns a safe fallback text
 * so /game/action remains available while cloud setup is incomplete.
 */
export function createRuntimeNarrator(options: RuntimeNarratorOptions): {
  narrate: (input: NarratorInput) => Promise<NarratorResult>;
} {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = options.endpoint ?? DEFAULT_GROQ_ENDPOINT;
  const model = options.model ?? DEFAULT_GROQ_MODEL;

  return {
    narrate: async (input: NarratorInput): Promise<NarratorResult> => {
      if (!options.groqApiKey) {
        return {
          narrative: fallbackNarrative(input.campaignLanguage),
          provider: "fallback",
          outputGuardrailTriggered: false,
        };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: buildNarratorPrompt(input) }],
            temperature: 0.7,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return {
            narrative: fallbackNarrative(input.campaignLanguage),
            provider: "fallback",
            outputGuardrailTriggered: false,
          };
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: unknown } }>;
        };
        const raw = payload.choices?.[0]?.message?.content;
        const narrative =
          typeof raw === "string" && raw.trim().length > 0
            ? raw.trim()
            : fallbackNarrative(input.campaignLanguage);

        const outputScan = checkOutputGuardrail(narrative);
        if (outputScan.triggered) {
          return {
            narrative: fallbackNarrative(input.campaignLanguage),
            provider: "fallback",
            outputGuardrailTriggered: true,
            outputGuardrailPattern: outputScan.patternMatched,
          };
        }

        return {
          narrative,
          provider: "groq",
          outputGuardrailTriggered: false,
        };
      } catch {
        return {
          narrative: fallbackNarrative(input.campaignLanguage),
          provider: "fallback",
          outputGuardrailTriggered: false,
        };
      }
    },
  };
}
