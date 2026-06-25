import type { MusicMood } from "./game";

/** Formato strutturato della risposta del narratore AI (doc §10). */
export interface AIResponse {
  narrative: string;
  location: string;
  health: number;
  energy: number;
  inventory: string[];
  hints: string[];
  musicMood: MusicMood;
  mapReveal?: {
    roomId: string;
    name: string;
    connections: Record<string, string | null>;
  };
  eventTriggered?: string;
}

/** Payload inviato dal client a ogni turno (doc §5). */
export interface GameActionRequest {
  action: string;
  slotId: string;
  requestId: string;
}
