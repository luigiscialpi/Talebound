import { useState, useCallback, useRef } from "react";
import type { GameState } from "@talebound/shared";
import { GameClient, type GameActionResponse } from "../services/api/gameClient";
import { useAccessToken } from "./useAuth";

// ---------------------------------------------------------------------------
// Campaign config (hardcoded for MVP — will come from /campaigns list later)
// ---------------------------------------------------------------------------

/** Demo campaign seeded by 0003_demo_campaign.sql */
export const DEMO_CAMPAIGN = {
  id: "c1111111-1111-1111-1111-111111111111",
  title: "La Cripta dei Sussurri",
  genre: "fantasy",
  language: "it",
} as const;

const SLOT_ID = "slot-1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GamePhase = "idle" | "loading" | "playing" | "error";

export interface GameSessionState {
  phase: GamePhase;
  gameState: GameState | null;
  /** Ordered list of narrative turns shown on screen. */
  turns: Array<{ action: string; narrative: string; blocked: boolean }>;
  error: string | null;
}

export interface UseGameState extends GameSessionState {
  /** Start or reset the demo game. */
  startGame: () => Promise<void>;
  /** Send a player action; returns false if blocked by guardrail. */
  sendAction: (action: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the full lifecycle of a game session (doc §9 - Sistema di Salvataggio).
 *
 * - Uses the demo campaign (MVP) — future: accept campaignId as param.
 * - Generates a monotonic requestId per action for idempotency.
 * - Exposes `turns` so the UI can render a scrollable narrative history.
 */
export function useGameState(): UseGameState {
  const accessToken = useAccessToken();

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [turns, setTurns] = useState<GameSessionState["turns"]>([]);
  const [error, setError] = useState<string | null>(null);

  // Monotonic counter for idempotency — survives React re-renders.
  const requestCounter = useRef(0);

  const getClient = useCallback((): GameClient | null => {
    if (!accessToken) {
      setError("Non autenticato. Effettua il login.");
      return null;
    }
    return new GameClient(accessToken);
  }, [accessToken]);

  const startGame = useCallback(async () => {
    const client = getClient();
    if (!client) return;

    setPhase("loading");
    setError(null);
    setTurns([]);

    try {
      const { gameState: newState } = await client.newGame(
        SLOT_ID,
        DEMO_CAMPAIGN.id,
      );
      setGameState(newState);
      setPhase("playing");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore di rete";
      setError(message);
      setPhase("error");
    }
  }, [getClient]);

  const sendAction = useCallback(
    async (action: string): Promise<boolean> => {
      const client = getClient();
      if (!client || !gameState) return false;

      setPhase("loading");
      setError(null);

      requestCounter.current += 1;
      const requestId = `req-${Date.now()}-${requestCounter.current}`;

      let result: GameActionResponse;
      try {
        result = await client.sendAction({
          action,
          slotId: SLOT_ID,
          requestId,
          campaignId: DEMO_CAMPAIGN.id,
          campaignTitle: DEMO_CAMPAIGN.title,
          campaignGenre: DEMO_CAMPAIGN.genre,
          campaignLanguage: DEMO_CAMPAIGN.language,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Errore di rete";
        setError(message);
        setPhase("playing");
        return false;
      }

      setGameState(result.gameState);
      setTurns((prev) => [
        ...prev,
        {
          action,
          narrative: result.narrative,
          blocked: result.blocked,
        },
      ]);
      setPhase("playing");
      return !result.blocked;
    },
    [getClient, gameState],
  );

  return { phase, gameState, turns, error, startGame, sendAction };
}
