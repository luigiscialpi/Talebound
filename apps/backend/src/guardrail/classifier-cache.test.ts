import { test } from "node:test";
import assert from "node:assert/strict";

import type { ClassifierResult } from "@talebound/shared";
import {
  ClassifierLRUCache,
  DEFAULT_CLASSIFIER_CACHE_MAX,
  DEFAULT_CLASSIFIER_CACHE_TTL_MS,
  getCacheKey,
} from "./classifier-cache.js";

function fakeClock(startMs = 0): { now: () => number; advance: (ms: number) => void } {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test("getCacheKey normalizza trim + lowercase e include campaignId", () => {
  assert.equal(
    getCacheKey("  Apri La Porta  ", "camp-1"),
    "camp-1:apri la porta",
  );
});

test("valori di default coerenti con doc", () => {
  assert.equal(DEFAULT_CLASSIFIER_CACHE_MAX, 1000);
  assert.equal(DEFAULT_CLASSIFIER_CACHE_TTL_MS, 5 * 60 * 1000);
});

test("hit di cache prima della scadenza TTL", () => {
  const clock = fakeClock();
  const cache = new ClassifierLRUCache({ now: clock.now });
  const key = getCacheKey("guardo la stanza", "camp");

  cache.set(key, "VALID");
  assert.equal(cache.get(key), "VALID");
  assert.equal(cache.size(), 1);
});

test("miss dopo scadenza TTL", () => {
  const clock = fakeClock();
  const cache = new ClassifierLRUCache({ ttlMs: 1000, now: clock.now });
  const key = getCacheKey("parlo col guardiano", "camp");

  cache.set(key, "OFF_TOPIC");
  clock.advance(1001);

  assert.equal(cache.get(key), undefined);
  assert.equal(cache.size(), 0);
});

test("eviction LRU quando supera max", () => {
  const clock = fakeClock();
  const cache = new ClassifierLRUCache({ max: 2, now: clock.now });

  const k1 = getCacheKey("a", "c");
  const k2 = getCacheKey("b", "c");
  const k3 = getCacheKey("c", "c");

  cache.set(k1, "VALID");
  cache.set(k2, "OFF_TOPIC");

  // Touch k1 so k2 becomes least recently used.
  assert.equal(cache.get(k1), "VALID");

  cache.set(k3, "INJECTION");

  assert.equal(cache.get(k1), "VALID");
  assert.equal(cache.get(k2), undefined);
  assert.equal(cache.get(k3), "INJECTION");
});

test("set su chiave esistente sovrascrive il valore", () => {
  const cache = new ClassifierLRUCache();
  const key = getCacheKey("apro", "camp");

  cache.set(key, "VALID");
  cache.set(key, "EXPLOIT");

  assert.equal(cache.get(key), "EXPLOIT" satisfies ClassifierResult);
  assert.equal(cache.size(), 1);
});

test("clear svuota completamente la cache", () => {
  const cache = new ClassifierLRUCache({ max: 2 });
  cache.set(getCacheKey("a", "x"), "VALID");
  cache.set(getCacheKey("b", "x"), "OFF_TOPIC");

  cache.clear();
  assert.equal(cache.size(), 0);
});
