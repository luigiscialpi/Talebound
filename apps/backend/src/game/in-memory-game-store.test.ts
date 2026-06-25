import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryGameStore } from "./in-memory-game-store.js";

function fakeClock(start = 0): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test("startNewGame inizializza stato base", () => {
  const store = new InMemoryGameStore();
  const state = store.startNewGame("u1", "s1", "c1");

  assert.equal(state.turnNumber, 0);
  assert.equal(state.currentRoomId, "room-start");
  assert.equal(state.health, 100);
  assert.equal(state.energy, 100);
});

test("getOrCreateSlot crea alla prima lettura e poi riusa", () => {
  const store = new InMemoryGameStore();

  const first = store.getOrCreateSlot("u1", "s1", "c1");
  const second = store.getOrCreateSlot("u1", "s1", "c1");

  assert.deepEqual(second, first);
});

test("applySuccessfulTurn incrementa turn e consuma energia", () => {
  const store = new InMemoryGameStore();
  store.startNewGame("u1", "s1", "c1");

  const after = store.applySuccessfulTurn("u1", "s1");
  assert.equal(after.turnNumber, 1);
  assert.equal(after.energy, 99);
});

test("idempotency restituisce la risposta salvata", () => {
  const store = new InMemoryGameStore();
  const state = store.startNewGame("u1", "s1", "c1");

  store.saveIdempotentResponse("u1", "r1", {
    slotId: "s1",
    requestId: "r1",
    blocked: false,
    narrative: "ok",
    gameState: state,
  });

  const cached = store.getIdempotentResponse("u1", "r1");
  assert.ok(cached);
  assert.equal(cached?.narrative, "ok");
});

test("idempotency scade dopo TTL", () => {
  const clock = fakeClock();
  const store = new InMemoryGameStore({ now: clock.now, idempotencyTtlMs: 1000 });
  const state = store.startNewGame("u1", "s1", "c1");

  store.saveIdempotentResponse("u1", "r1", {
    slotId: "s1",
    requestId: "r1",
    blocked: true,
    narrative: "blocked",
    gameState: state,
  });

  clock.advance(1001);
  const cached = store.getIdempotentResponse("u1", "r1");
  assert.equal(cached, undefined);
});
