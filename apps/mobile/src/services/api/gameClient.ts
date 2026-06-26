import type { GameState } from "@talebound/shared";

/**
 * The backend URL is set at build time via app.json extra.
 * Falls back to the local dev server so the app works without EAS.
 */
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as
  | { backendUrl?: string }
  | undefined;

// Default to the local dev machine (Metro default host for Android emulator).
const BASE_URL = extra?.backendUrl ?? "http://10.0.2.2:3000";

// ---------------------------------------------------------------------------
// Response shapes (mirrors backend index.ts)
// ---------------------------------------------------------------------------

export interface GameActionResponse {
  slotId: string;
  requestId: string;
  blocked: boolean;
  reason?: string;
  stage?: string;
  narrative: string;
  provider?: string;
  outputGuardrailTriggered?: boolean;
  outputGuardrailPattern?: string;
  gameState: GameState;
  idempotentReplay?: boolean;
}

export interface GameNewResponse {
  slotId: string;
  gameState: GameState;
}

export interface GameStateResponse {
  slotId: string;
  gameState: GameState;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Minimal HTTP client for the Talebound backend game endpoints (doc §5).
 * All requests carry the Supabase JWT as a Bearer token.
 */
export class GameClient {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`[gameClient] POST ${path} -> ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`[gameClient] GET ${path} -> ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Start (or reset) a game slot for the given campaign.
   * The backend extracts userId from the JWT — no need to pass it here.
   */
  async newGame(slotId: string, campaignId: string): Promise<GameNewResponse> {
    return this.post<GameNewResponse>("/game/new", { slotId, campaignId });
  }

  /**
   * Send a player action and receive the AI narrative + updated game state.
   */
  async sendAction(params: {
    action: string;
    slotId: string;
    requestId: string;
    campaignId: string;
    campaignTitle: string;
    campaignGenre: string;
    campaignLanguage: string;
  }): Promise<GameActionResponse> {
    return this.post<GameActionResponse>("/game/action", params);
  }

  /**
   * Read the current state of a save slot.
   */
  async getState(slotId: string, campaignId?: string): Promise<GameStateResponse> {
    const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
    return this.get<GameStateResponse>(`/game/state/${encodeURIComponent(slotId)}${qs}`);
  }
}
