import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GameState } from "@talebound/shared";
import type {
  GameActionResponseSnapshot,
} from "./in-memory-game-store.js";

// ---------------------------------------------------------------------------
// Re-export the snapshot type so callers can import from either store module.
// ---------------------------------------------------------------------------
export type { GameActionResponseSnapshot };

export interface SupabaseGameStoreOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  /** Fallback: in-memory idempotency TTL (default 24h). Redis is the upgrade path. */
  idempotencyTtlMs?: number;
  now?: () => number;
}

interface IdempotencyEntry {
  createdAt: number;
  response: GameActionResponseSnapshot;
}

function isValidUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Supabase-backed game store.
 *
 * Game state -> save_slots.autosave_json (full GameState, overwritten every turn).
 * Idempotency -> in-memory map (upgrade path: Redis, see README step 5).
 *
 * The backend uses the service_role key which bypasses RLS; RLS policies govern
 * only the anon/authenticated client roles (migration 0002).
 *
 * Lookup key for save_slots: (user_id, campaign_id) — one autosave slot per campaign.
 */
export class SupabaseGameStore {
  private readonly client: SupabaseClient;
  private readonly now: () => number;
  private readonly idempotencyTtlMs: number;
  private readonly idempotency = new Map<string, IdempotencyEntry>();

  constructor(options: SupabaseGameStoreOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: { persistSession: false },
    });
    this.now = options.now ?? Date.now;
    this.idempotencyTtlMs = options.idempotencyTtlMs ?? 24 * 60 * 60 * 1000;
  }

  // ---------------------------------------------------------------------------
  // Slot helpers
  // ---------------------------------------------------------------------------

  private defaultState(campaignId: string): GameState {
    return {
      campaignId,
      currentRoomId: "room-start",
      health: 100,
      energy: 100,
      inventory: [],
      visitedRoomIds: ["room-start"],
      turnNumber: 0,
      endingsReached: [],
    };
  }

  /**
   * Upsert a fresh slot row (or reset an existing one) in save_slots.
   */
  async startNewGame(
    userId: string,
    _slotId: string,
    campaignId: string,
  ): Promise<GameState> {
    const state = this.defaultState(campaignId);

    if (!isValidUuid(userId) || !isValidUuid(campaignId)) {
      console.warn("[supabase-game-store] startNewGame: invalid UUIDs", { userId, campaignId });
      return state;
    }

    const { error } = await this.client.from("save_slots").upsert(
      {
        user_id: userId,
        campaign_id: campaignId,
        autosave_json: state,
        total_turns: 0,
        endings_reached: [],
        snapshots_json: [],
        act_checkpoints_json: [],
      },
      { onConflict: "user_id,campaign_id" },
    );

    if (error) {
      console.error("[supabase-game-store] startNewGame error:", error.message);
    }

    return state;
  }

  /**
   * Read current slot state; create a default one if absent.
   */
  async getOrCreateSlot(
    userId: string,
    slotId: string,
    campaignId: string,
  ): Promise<GameState> {
    if (!isValidUuid(userId) || !isValidUuid(campaignId)) {
      console.warn("[supabase-game-store] getOrCreateSlot: invalid UUIDs", { userId, campaignId });
      return this.defaultState(campaignId);
    }

    const { data, error } = await this.client
      .from("save_slots")
      .select("autosave_json")
      .eq("user_id", userId)
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (error) {
      console.error(
        "[supabase-game-store] getOrCreateSlot error:",
        error.message,
      );
      return this.defaultState(campaignId);
    }

    if (!data) {
      return this.startNewGame(userId, slotId, campaignId);
    }

    return data.autosave_json as GameState;
  }

  /**
   * Fetch room data from the database.
   */
  async getRoom(campaignId: string, roomId: string): Promise<any | undefined> {
    if (!isValidUuid(campaignId) || !isValidUuid(roomId)) {
      console.warn("[supabase-game-store] getRoom: invalid UUIDs", { campaignId, roomId });
      return undefined;
    }
    const { data, error } = await this.client
      .from("rooms")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("id", roomId)
      .maybeSingle();

    if (error) {
      console.error("[supabase-game-store] getRoom error:", error.message);
      return undefined;
    }

    if (!data) return undefined;

    return {
      id: data.id,
      campaignId: data.campaign_id,
      name: data.name,
      descriptionCanonical: data.description_canonical,
      descriptionStateOverride: data.description_state_override,
      connections: data.connections,
      musicMood: data.music_mood,
      itemsInitial: data.items_initial,
      firstVisitText: data.first_visit_text,
      tags: data.tags,
    };
  }

  /**
   * Increment turnNumber, decrement energy, persist to autosave_json.
   */
  async applySuccessfulTurn(
    userId: string,
    slotId: string,
    campaignId?: string,
    history?: Array<{ action: string; narrative: string }>,
  ): Promise<GameState> {
    if (!isValidUuid(userId)) {
      console.warn("[supabase-game-store] applySuccessfulTurn: invalid user UUID", { userId });
      return this.defaultState(campaignId ?? "");
    }

    let query = this.client
      .from("save_slots")
      .select("autosave_json, total_turns")
      .eq("user_id", userId);

    if (campaignId && isValidUuid(campaignId)) {
      query = query.eq("campaign_id", campaignId);
    } else if (slotId && isValidUuid(slotId)) {
      query = query.or(`id.eq.${slotId},campaign_id.eq.${slotId}`);
    } else {
      console.warn("[supabase-game-store] applySuccessfulTurn: no valid slot/campaign UUID", { slotId, campaignId });
      return this.defaultState(campaignId ?? "");
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      console.error(
        "[supabase-game-store] applySuccessfulTurn: slot not found",
        error?.message
      );
      return this.defaultState(campaignId ?? "");
    }

    const current = data.autosave_json as GameState;
    const next: GameState = {
      ...current,
      turnNumber: current.turnNumber + 1,
      energy: Math.max(0, current.energy - 1),
      history,
    };

    const matchedCampaignId = current.campaignId;
    if (isValidUuid(matchedCampaignId)) {
      await this.client
        .from("save_slots")
        .update({
          autosave_json: next,
          total_turns: (data.total_turns as number) + 1,
        })
        .eq("user_id", userId)
        .eq("campaign_id", matchedCampaignId);
    }

    return next;
  }

  /**
   * Read slot state if present (undefined when absent).
   */
  async getSlot(
    userId: string,
    slotId: string,
    campaignId?: string,
  ): Promise<GameState | undefined> {
    if (!isValidUuid(userId)) {
      console.warn("[supabase-game-store] getSlot: invalid user UUID", { userId });
      return undefined;
    }

    let query = this.client
      .from("save_slots")
      .select("autosave_json")
      .eq("user_id", userId);

    if (campaignId && isValidUuid(campaignId)) {
      query = query.eq("campaign_id", campaignId);
    } else if (slotId && isValidUuid(slotId)) {
      query = query.or(`id.eq.${slotId},campaign_id.eq.${slotId}`);
    } else {
      console.warn("[supabase-game-store] getSlot: no valid slot/campaign UUID", { slotId, campaignId });
      return undefined;
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error(
        "[supabase-game-store] getSlot error:",
        error.message,
      );
      return undefined;
    }

    return data ? (data.autosave_json as GameState) : undefined;
  }

  // ---------------------------------------------------------------------------
  // Idempotency (in-memory; upgrade path: Redis)
  // ---------------------------------------------------------------------------

  private idemKey(userId: string, requestId: string): string {
    return `${userId}:${requestId}`;
  }

  private pruneIdempotency(): void {
    const cutoff = this.now() - this.idempotencyTtlMs;
    for (const [key, entry] of this.idempotency) {
      if (entry.createdAt <= cutoff) {
        this.idempotency.delete(key);
      }
    }
  }

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

  getIdempotentResponse(
    userId: string,
    requestId: string,
  ): GameActionResponseSnapshot | undefined {
    this.pruneIdempotency();
    return this.idempotency.get(this.idemKey(userId, requestId))?.response;
  }
}
