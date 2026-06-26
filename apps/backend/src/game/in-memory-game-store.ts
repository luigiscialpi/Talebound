import type { GameState } from "@talebound/shared";

export interface InMemoryGameStoreOptions {
  now?: () => number;
  /** How long idempotency entries are kept in memory (default: 24h). */
  idempotencyTtlMs?: number;
}

export interface GameActionResponseSnapshot {
  slotId: string;
  requestId: string;
  blocked: boolean;
  narrative: string;
  reason?: string;
  stage?: string;
  provider?: "gemini" | "groq" | "cerebras" | "fallback";
  outputGuardrailTriggered?: boolean;
  outputGuardrailPattern?: string;
  gameState: GameState;
}

interface IdempotencyEntry {
  createdAt: number;
  response: GameActionResponseSnapshot;
}

/**
 * Temporary in-memory game persistence for local/MVP runtime.
 *
 * ponytail: state is process-local and will be lost on restart/deploy.
 * Upgrade path: replace with Supabase-backed StateManager + Redis idempotency.
 */
export class InMemoryGameStore {
  private readonly now: () => number;
  private readonly idempotencyTtlMs: number;
  private readonly slots = new Map<string, GameState>();
  private readonly idempotency = new Map<string, IdempotencyEntry>();

  constructor(options?: InMemoryGameStoreOptions) {
    this.now = options?.now ?? Date.now;
    this.idempotencyTtlMs = options?.idempotencyTtlMs ?? 24 * 60 * 60 * 1000;
  }

  /** Build the composite key for a slot scoped to a user. */
  private slotKey(userId: string, slotId: string): string {
    return `${userId}:${slotId}`;
  }

  /** Build the composite key for an idempotency record scoped to a user. */
  private idemKey(userId: string, requestId: string): string {
    return `${userId}:${requestId}`;
  }

  /** Remove expired idempotency entries. */
  private pruneIdempotency(): void {
    const cutoff = this.now() - this.idempotencyTtlMs;
    for (const [key, entry] of this.idempotency) {
      if (entry.createdAt <= cutoff) {
        this.idempotency.delete(key);
      }
    }
  }

  /**
   * Create or reset a slot with an initial game state for the campaign.
   */
  startNewGame(userId: string, slotId: string, campaignId: string): GameState {
    const state: GameState = {
      campaignId,
      currentRoomId: "room-start",
      health: 100,
      energy: 100,
      inventory: [],
      visitedRoomIds: ["room-start"],
      turnNumber: 0,
      endingsReached: [],
    };
    this.slots.set(this.slotKey(userId, slotId), state);
    return state;
  }

  /**
   * Read current slot state, creating a default one when absent.
   */
  getOrCreateSlot(userId: string, slotId: string, campaignId: string): GameState {
    const key = this.slotKey(userId, slotId);
    const existing = this.slots.get(key);
    if (existing) {
      return existing;
    }
    return this.startNewGame(userId, slotId, campaignId);
  }

  /**
   * Get room metadata (mock for in-memory store).
   */
  getRoom(campaignId: string, roomId: string): any {
    return {
      id: roomId,
      campaignId,
      name: "Atrio del Tempio",
      descriptionCanonical: "Ti trovi nell'atrio di un antico tempio dimenticato. Le pareti sono coperte di rampicanti e geroglifici sbiaditi. C'è una sola uscita visibile a nord, bloccata da una pesante grata di ferro.",
      descriptionStateOverride: null,
      connections: { north: "room-next" },
      musicMood: "calm",
      itemsInitial: ["chiave_ruggine"],
      firstVisitText: "Benvenuto nel tempio.",
      tags: [],
    };
  }

  /**
   * Apply one successful turn to game state (minimal MVP progression).
   */
  applySuccessfulTurn(
    userId: string,
    slotId: string,
    _campaignId?: string,
    history?: Array<{ action: string; narrative: string }>,
  ): GameState {
    const key = this.slotKey(userId, slotId);
    const state = this.slots.get(key);
    if (!state) {
      throw new Error("Slot not found");
    }

    const next: GameState = {
      ...state,
      turnNumber: state.turnNumber + 1,
      energy: Math.max(0, state.energy - 1),
      history,
    };
    this.slots.set(key, next);
    return next;
  }

  /**
   * Save idempotent response for a request.
   */
  saveIdempotentResponse(
    userId: string,
    requestId: string,
    response: GameActionResponseSnapshot,
  ): void {
    this.pruneIdempotency();
    this.idempotency.set(this.idemKey(userId, requestId), {
      createdAt: this.now(),
      response,
    });
  }

  /**
   * Retrieve previously saved response for the same request id.
   */
  getIdempotentResponse(
    userId: string,
    requestId: string,
  ): GameActionResponseSnapshot | undefined {
    this.pruneIdempotency();
    const entry = this.idempotency.get(this.idemKey(userId, requestId));
    return entry?.response;
  }

  /** Read slot state if present. */
  getSlot(userId: string, slotId: string, _campaignId?: string): GameState | undefined {
    return this.slots.get(this.slotKey(userId, slotId));
  }
}
