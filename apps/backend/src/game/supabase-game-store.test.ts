import { test } from "node:test";
import assert from "node:assert/strict";

// Mock global WebSocket to bypass Supabase Realtime client checks on older Node versions.
(global as any).WebSocket = class MockWebSocket {};

import { SupabaseGameStore } from "./supabase-game-store.js";
import type { GameState } from "@talebound/shared";

// Valid UUIDs for testing to satisfy validation check.
const validUserId = "12345678-1234-1234-1234-123456789abc";
const validSlotId = "87654321-4321-4321-4321-cba987654321";
const validCampaignId = "55555555-5555-5555-5555-555555555555";

function setupStore() {
  const store = new SupabaseGameStore({
    supabaseUrl: "https://mock.supabase.co",
    serviceRoleKey: "mock-secret",
  });

  const upsertPayloads: any[] = [];
  const updatePayloads: any[] = [];
  const queryFilters: Record<string, any> = {};
  let mockData: any = null;
  let mockError: any = null;

  const mockClient = {
    from: (table: string) => {
      assert.equal(table, "save_slots");
      return {
        upsert: (data: any) => {
          upsertPayloads.push(data);
          return { error: mockError };
        },
        select: (_columns: string) => {
          const chain = {
            eq: (col: string, val: any) => {
              queryFilters[col] = val;
              return chain;
            },
            or: (expr: string) => {
              queryFilters["or"] = expr;
              return chain;
            },
            maybeSingle: async () => {
              return { data: mockData, error: mockError };
            },
          };
          return chain;
        },
        update: (data: any) => {
          updatePayloads.push(data);
          const chain = {
            eq: (col: string, val: any) => {
              queryFilters[col] = val;
              return chain;
            },
            maybeSingle: async () => {
              return { data: mockData, error: mockError };
            },
          };
          return chain;
        },
      };
    },
  } as any;

  (store as any).client = mockClient;

  return {
    store,
    upsertPayloads,
    updatePayloads,
    queryFilters,
    setMockData: (data: any) => {
      mockData = data;
    },
    setMockError: (error: any) => {
      mockError = error;
    },
  };
}

test("startNewGame upserta lo stato iniziale", async () => {
  const { store, upsertPayloads } = setupStore();
  const state = await store.startNewGame(validUserId, validSlotId, validCampaignId);

  assert.equal(state.turnNumber, 0);
  assert.equal(state.currentRoomId, "room-start");
  assert.equal(state.health, 100);
  assert.equal(state.energy, 100);

  assert.equal(upsertPayloads.length, 1);
  assert.equal(upsertPayloads[0].user_id, validUserId);
  assert.equal(upsertPayloads[0].campaign_id, validCampaignId);
});

test("startNewGame ritorna stato di default se UUID non validi", async () => {
  const { store, upsertPayloads } = setupStore();
  const state = await store.startNewGame("invalid", "invalid", "invalid");
  assert.equal(state.turnNumber, 0);
  assert.equal(upsertPayloads.length, 0);
});

test("getOrCreateSlot ritorna slot se esistente", async () => {
  const { store, setMockData, queryFilters } = setupStore();
  const mockState: GameState = {
    campaignId: validCampaignId,
    currentRoomId: "room-2",
    health: 80,
    energy: 90,
    inventory: ["key"],
    visitedRoomIds: ["room-start", "room-2"],
    turnNumber: 5,
    endingsReached: [],
  };

  setMockData({ autosave_json: mockState });

  const state = await store.getOrCreateSlot(validUserId, validSlotId, validCampaignId);
  assert.deepEqual(state, mockState);
  assert.equal(queryFilters.user_id, validUserId);
  assert.equal(queryFilters.campaign_id, validCampaignId);
});

test("getOrCreateSlot crea nuovo slot se non esistente", async () => {
  const { store, setMockData, upsertPayloads } = setupStore();
  setMockData(null); // non esistente

  const state = await store.getOrCreateSlot(validUserId, validSlotId, validCampaignId);
  assert.equal(state.turnNumber, 0);
  assert.equal(upsertPayloads.length, 1);
});

test("applySuccessfulTurn incrementa turni e consuma energia", async () => {
  const { store, setMockData, updatePayloads } = setupStore();
  const mockState: GameState = {
    campaignId: validCampaignId,
    currentRoomId: "room-start",
    health: 100,
    energy: 100,
    inventory: [],
    visitedRoomIds: ["room-start"],
    turnNumber: 0,
    endingsReached: [],
  };

  setMockData({ autosave_json: mockState, total_turns: 0 });

  const next = await store.applySuccessfulTurn(validUserId, validSlotId, validCampaignId);
  assert.equal(next.turnNumber, 1);
  assert.equal(next.energy, 99);

  assert.equal(updatePayloads.length, 1);
  assert.equal(updatePayloads[0].autosave_json.turnNumber, 1);
  assert.equal(updatePayloads[0].total_turns, 1);
});

test("getSlot recupera slot per campaignId", async () => {
  const { store, setMockData, queryFilters } = setupStore();
  const mockState: GameState = {
    campaignId: validCampaignId,
    currentRoomId: "room-start",
    health: 100,
    energy: 100,
    inventory: [],
    visitedRoomIds: ["room-start"],
    turnNumber: 3,
    endingsReached: [],
  };

  setMockData({ autosave_json: mockState });

  const state = await store.getSlot(validUserId, "", validCampaignId);
  assert.deepEqual(state, mockState);
  assert.equal(queryFilters.campaign_id, validCampaignId);
});

test("getSlot recupera slot per slotId se campaignId assente", async () => {
  const { store, setMockData, queryFilters } = setupStore();
  const mockState: GameState = {
    campaignId: validCampaignId,
    currentRoomId: "room-start",
    health: 100,
    energy: 100,
    inventory: [],
    visitedRoomIds: ["room-start"],
    turnNumber: 4,
    endingsReached: [],
  };

  setMockData({ autosave_json: mockState });

  const state = await store.getSlot(validUserId, validSlotId);
  assert.deepEqual(state, mockState);
  assert.equal(queryFilters.or, `id.eq.${validSlotId},campaign_id.eq.${validSlotId}`);
});
