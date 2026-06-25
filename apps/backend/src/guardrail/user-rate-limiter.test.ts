import { test } from "node:test";
import assert from "node:assert/strict";

import { UserRateLimiter } from "./user-rate-limiter.js";

function fakeClock(startMs = 0): { now: () => number; advance: (ms: number) => void } {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test("accetta richieste entro la soglia", () => {
  const clock = fakeClock();
  const limiter = new UserRateLimiter({ maxRequests: 2, windowMs: 1000, now: clock.now });

  assert.equal(limiter.tryConsume("u1"), true);
  assert.equal(limiter.tryConsume("u1"), true);
});

test("blocca oltre soglia nella stessa finestra", () => {
  const clock = fakeClock();
  const limiter = new UserRateLimiter({ maxRequests: 2, windowMs: 1000, now: clock.now });

  assert.equal(limiter.tryConsume("u1"), true);
  assert.equal(limiter.tryConsume("u1"), true);
  assert.equal(limiter.tryConsume("u1"), false);
});

test("finestra mobile: dopo la scadenza torna ad accettare", () => {
  const clock = fakeClock();
  const limiter = new UserRateLimiter({ maxRequests: 2, windowMs: 1000, now: clock.now });

  assert.equal(limiter.tryConsume("u1"), true);
  assert.equal(limiter.tryConsume("u1"), true);
  assert.equal(limiter.tryConsume("u1"), false);

  clock.advance(1001);
  assert.equal(limiter.tryConsume("u1"), true);
});

test("limiti separati per user_id diversi", () => {
  const clock = fakeClock();
  const limiter = new UserRateLimiter({ maxRequests: 1, windowMs: 1000, now: clock.now });

  assert.equal(limiter.tryConsume("u1"), true);
  assert.equal(limiter.tryConsume("u1"), false);

  assert.equal(limiter.tryConsume("u2"), true);
});
