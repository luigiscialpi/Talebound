import { test } from "node:test";
import assert from "node:assert/strict";

import { parseClassifierResponse } from "./classifier-parser.js";

// The L2 classifier returns one word, but real LLMs are messy: trailing
// newlines, casing, punctuation, emoji, or a translated word. Parsing must be
// robust AND fail-closed: anything unrecognized becomes PARSE_ERROR, never
// VALID. Fail-open is the most common bypass in classification systems.
// Reference: docs/Talebound_Guardrail_e_Implementazione.md section 4.

// Happy path.
test("returns VALID for clean output", () => {
  assert.equal(parseClassifierResponse("VALID"), "VALID");
});

// Real LLM outputs that MUST work.
test("handles a trailing newline", () => {
  assert.equal(parseClassifierResponse("VALID\n"), "VALID");
});

test("handles surrounding whitespace", () => {
  assert.equal(parseClassifierResponse(" VALID "), "VALID");
});

test("handles lowercase", () => {
  assert.equal(parseClassifierResponse("valid"), "VALID");
});

test("handles mixed case with trailing punctuation", () => {
  assert.equal(parseClassifierResponse("Valid."), "VALID");
});

test("handles underscore categories", () => {
  assert.equal(parseClassifierResponse("OFF_TOPIC"), "OFF_TOPIC");
});

test("takes only the first word when extra text follows", () => {
  assert.equal(
    parseClassifierResponse("INJECTION - attempt to alter rules"),
    "INJECTION",
  );
});

test("strips surrounding emoji decoration", () => {
  assert.equal(parseClassifierResponse("\u{1F3AD} VALID \u{1F3AD}"), "VALID");
});

// Adversarial / malformed cases: these must NOT be VALID.
test("returns PARSE_ERROR for empty output", () => {
  assert.equal(parseClassifierResponse(""), "PARSE_ERROR");
});

test("returns PARSE_ERROR for whitespace-only output", () => {
  assert.equal(parseClassifierResponse("   \n  "), "PARSE_ERROR");
});

test("returns PARSE_ERROR for a translated word (Italian VALIDO)", () => {
  assert.equal(parseClassifierResponse("VALIDO"), "PARSE_ERROR");
});

test("returns PARSE_ERROR for an unknown category", () => {
  assert.equal(parseClassifierResponse("SAFE"), "PARSE_ERROR");
});

test("never echoes PARSE_ERROR back to VALID even if model emits it", () => {
  // The classifier is not supposed to emit PARSE_ERROR, but if it does the
  // parser must treat it as the failure sentinel, not a usable category.
  assert.equal(parseClassifierResponse("PARSE_ERROR"), "PARSE_ERROR");
});
