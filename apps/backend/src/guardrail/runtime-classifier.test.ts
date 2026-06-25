import { test } from "node:test";
import assert from "node:assert/strict";

import { createRuntimeClassifier } from "./runtime-classifier.js";

function baseContext() {
  return {
    campaignId: "camp-1",
    campaignTitle: "La Torre",
    campaignGenre: "fantasy",
    campaignLanguage: "it",
    userInput: "apro la porta",
  };
}

test("senza GROQ_API_KEY ritorna PARSE_ERROR (fail-closed)", async () => {
  const runtime = createRuntimeClassifier({});
  const result = await runtime.classify(baseContext());
  assert.equal(result, "PARSE_ERROR");
});

test("con GROQ_API_KEY usa Groq e ritorna categoria parsata", async () => {
  const runtime = createRuntimeClassifier({
    groqApiKey: "test-key",
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "VALID" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const result = await runtime.classify(baseContext());
  assert.equal(result, "VALID");
});

test("cache runtime evita seconda chiamata provider sullo stesso input", async () => {
  let calls = 0;
  const runtime = createRuntimeClassifier({
    groqApiKey: "test-key",
    fetchFn: async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "OFF_TOPIC" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const context = baseContext();
  assert.equal(await runtime.classify(context), "OFF_TOPIC");
  assert.equal(await runtime.classify(context), "OFF_TOPIC");
  assert.equal(calls, 1);
});
