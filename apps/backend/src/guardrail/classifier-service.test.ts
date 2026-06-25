import { test } from "node:test";
import assert from "node:assert/strict";

import { ClassifierCircuitBreaker } from "./classifier-circuit-breaker.js";
import { ClassifierLRUCache } from "./classifier-cache.js";
import { ClassifierService } from "./classifier-service.js";

test("cache hit evita chiamata provider", async () => {
  const cache = new ClassifierLRUCache();
  cache.set("camp:apro la porta", "VALID");

  let calls = 0;
  const service = new ClassifierService(async () => {
    calls += 1;
    return "OFF_TOPIC";
  }, { cache });

  const result = await service.classify({
    campaignId: "camp",
    campaignTitle: "Torre",
    campaignGenre: "fantasy",
    campaignLanguage: "it",
    userInput: "apro la porta",
  });

  assert.equal(result, "VALID");
  assert.equal(calls, 0);
});

test("breaker aperto forza PARSE_ERROR senza provider", async () => {
  const breaker = new ClassifierCircuitBreaker({ failureThreshold: 1 });
  breaker.recordFailure();

  let calls = 0;
  const service = new ClassifierService(async () => {
    calls += 1;
    return "VALID";
  }, { circuitBreaker: breaker });

  const result = await service.classify({
    campaignId: "camp",
    campaignTitle: "Torre",
    campaignGenre: "fantasy",
    campaignLanguage: "it",
    userInput: "apro la porta",
  });

  assert.equal(result, "PARSE_ERROR");
  assert.equal(calls, 0);
});

test("success path: parse + cache + reset failure counter", async () => {
  let calls = 0;
  const cache = new ClassifierLRUCache();
  const breaker = new ClassifierCircuitBreaker({ failureThreshold: 2 });

  const service = new ClassifierService(async () => {
    calls += 1;
    return " valid. ";
  }, { cache, circuitBreaker: breaker });

  const context = {
    campaignId: "camp",
    campaignTitle: "Torre",
    campaignGenre: "fantasy",
    campaignLanguage: "it",
    userInput: "apro la porta",
  };

  assert.equal(await service.classify(context), "VALID");
  assert.equal(await service.classify(context), "VALID");
  assert.equal(calls, 1);
  assert.equal(breaker.getState(), "CLOSED");
});

test("parse error conta come failure e non viene cachato", async () => {
  const breaker = new ClassifierCircuitBreaker({ failureThreshold: 2 });
  let calls = 0;

  const service = new ClassifierService(async () => {
    calls += 1;
    return "VALIDE";
  }, { circuitBreaker: breaker });

  const context = {
    campaignId: "camp",
    campaignTitle: "Torre",
    campaignGenre: "fantasy",
    campaignLanguage: "it",
    userInput: "apro la porta",
  };

  assert.equal(await service.classify(context), "PARSE_ERROR");
  assert.equal(await service.classify(context), "PARSE_ERROR");
  assert.equal(calls, 2);
  assert.equal(breaker.getState(), "OPEN");
});

test("throw provider conta come failure e ritorna PARSE_ERROR", async () => {
  const breaker = new ClassifierCircuitBreaker({ failureThreshold: 2 });
  const service = new ClassifierService(
    async () => {
      throw new Error("network down");
    },
    { circuitBreaker: breaker },
  );

  const context = {
    campaignId: "camp",
    campaignTitle: "Torre",
    campaignGenre: "fantasy",
    campaignLanguage: "it",
    userInput: "apro la porta",
  };

  assert.equal(await service.classify(context), "PARSE_ERROR");
  assert.equal(await service.classify(context), "PARSE_ERROR");
  assert.equal(breaker.getState(), "OPEN");
});
