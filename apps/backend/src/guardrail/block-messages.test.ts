import { test } from "node:test";
import assert from "node:assert/strict";

import { getGuardrailBlockMessage } from "./block-messages.js";

test("ritorna messaggio italiano quando language e it", () => {
  const msg = getGuardrailBlockMessage("OFF_TOPIC", "it");
  assert.match(msg, /Questa domanda non appartiene a questo mondo/);
});

test("ritorna messaggio inglese quando language non e it", () => {
  const msg = getGuardrailBlockMessage("OFF_TOPIC", "en");
  assert.match(msg, /does not belong to this world/);
});

test("language case-insensitive", () => {
  const msg = getGuardrailBlockMessage("PARSE_ERROR", "IT-IT");
  assert.match(msg, /Il Narratore ha difficolta a comprendere/);
});
