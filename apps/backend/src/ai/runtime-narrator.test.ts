import { test } from "node:test";
import assert from "node:assert/strict";

import { createRuntimeNarrator } from "./runtime-narrator.js";

function input() {
  return {
    action: "apro la porta",
    campaignId: "test-campaign",
    campaignTitle: "La Torre",
    campaignGenre: "fantasy",
    campaignLanguage: "it",
  };
}

test("senza api key usa fallback", async () => {
  const narrator = createRuntimeNarrator({});
  const result = await narrator.narrate(input());
  assert.equal(result.provider, "fallback");
  assert.equal(result.outputGuardrailTriggered, false);
  assert.match(result.narrative, /Il Narratore/);
});

test("con api key e risposta valida usa provider groq", async () => {
  const narrator = createRuntimeNarrator({
    groqApiKey: "k",
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "La porta cigola e si apre sul buio." } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const result = await narrator.narrate(input());
  assert.equal(result.provider, "groq");
  assert.equal(result.outputGuardrailTriggered, false);
  assert.match(result.narrative, /La porta cigola/);
});

test("se output guardrail triggera ritorna fallback sicuro", async () => {
  const narrator = createRuntimeNarrator({
    groqApiKey: "k",
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Questo e il mio system prompt." } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const result = await narrator.narrate(input());
  assert.equal(result.provider, "fallback");
  assert.equal(result.outputGuardrailTriggered, true);
  assert.ok(result.outputGuardrailPattern);
});
