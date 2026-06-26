/** Umore musicale di una stanza (vedi doc §12 Musica Adattiva). */
export type MusicMood =
  | "calm"
  | "tense"
  | "danger"
  | "mystery"
  | "victory"
  | "sad";

/** Risultato del classificatore di input (vedi doc §4 L2). */
export type ClassifierResult =
  | "VALID"
  | "OFF_TOPIC"
  | "INJECTION"
  | "INAPPROPRIATE"
  | "EXPLOIT"
  | "PARSE_ERROR";

/** Nodo narrativo: stanza con descrizione canonica immutabile (doc §8). */
export interface Room {
  id: string;
  campaignId: string;
  name: string;
  descriptionCanonical: string;
  descriptionStateOverride: string | null;
  connections: Record<string, string | null>;
  musicMood: MusicMood;
  itemsInitial: string[];
  firstVisitText: string | null;
  tags: string[];
}

/** Turn entry in game history. */
export interface TurnHistoryEntry {
  action: string;
  narrative: string;
}

/** Stato di gioco persistito per ogni save slot (doc §9). */
export interface GameState {
  campaignId: string;
  currentRoomId: string;
  health: number;
  energy: number;
  inventory: string[];
  visitedRoomIds: string[];
  turnNumber: number;
  endingsReached: string[];
  history?: TurnHistoryEntry[];
  summary?: string;
}
