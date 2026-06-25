import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ClassifierCircuitBreaker,
  type CircuitState,
} from "./classifier-circuit-breaker.js";

function fakeClock(startMs = 0): { now: () => number; advance: (ms: number) => void } {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test("parte CLOSED e permette tentativi", () => {
  const cb = new ClassifierCircuitBreaker();
  assert.equal(cb.getState(), "CLOSED");
  assert.equal(cb.canAttempt(), true);
});

test("apre dopo threshold fallimenti consecutivi", () => {
  const cb = new ClassifierCircuitBreaker({ failureThreshold: 3 });
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.getState(), "CLOSED");

  cb.recordFailure();
  assert.equal(cb.getState(), "OPEN");
  assert.equal(cb.canAttempt(), false);
});

test("chiama onOpen quando entra in OPEN", () => {
  let opened = 0;
  const cb = new ClassifierCircuitBreaker({
    failureThreshold: 2,
    onOpen: () => {
      opened += 1;
    },
  });

  cb.recordFailure();
  cb.recordFailure();
  assert.equal(opened, 1);
});

test("dopo reset timeout passa a HALF_OPEN e permette una sola probe", () => {
  const clock = fakeClock();
  const cb = new ClassifierCircuitBreaker({
    failureThreshold: 2,
    resetTimeoutMs: 1000,
    now: clock.now,
  });

  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.getState(), "OPEN");
  assert.equal(cb.canAttempt(), false);

  clock.advance(1001);
  assert.equal(cb.getState(), "HALF_OPEN" satisfies CircuitState);
  assert.equal(cb.canAttempt(), true);
  assert.equal(cb.canAttempt(), false);
});

test("successo in HALF_OPEN richiude il breaker", () => {
  const clock = fakeClock();
  const cb = new ClassifierCircuitBreaker({
    failureThreshold: 2,
    resetTimeoutMs: 1000,
    now: clock.now,
  });

  cb.recordFailure();
  cb.recordFailure();
  clock.advance(1001);

  assert.equal(cb.canAttempt(), true);
  cb.recordSuccess();

  assert.equal(cb.getState(), "CLOSED");
  assert.equal(cb.canAttempt(), true);
});

test("fallimento in HALF_OPEN riapre subito", () => {
  const clock = fakeClock();
  let opened = 0;
  const cb = new ClassifierCircuitBreaker({
    failureThreshold: 2,
    resetTimeoutMs: 1000,
    now: clock.now,
    onOpen: () => {
      opened += 1;
    },
  });

  cb.recordFailure();
  cb.recordFailure();
  clock.advance(1001);

  assert.equal(cb.canAttempt(), true);
  cb.recordFailure();

  assert.equal(cb.getState(), "OPEN");
  assert.equal(opened, 2);
});

test("recordSuccess in CLOSED azzera i fallimenti consecutivi", () => {
  const cb = new ClassifierCircuitBreaker({ failureThreshold: 2 });

  cb.recordFailure();
  cb.recordSuccess();
  cb.recordFailure();

  // Should still be closed because failures are no longer consecutive.
  assert.equal(cb.getState(), "CLOSED");
});
