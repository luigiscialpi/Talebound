import type { InputGuardrailReason } from "./input-guardrail.js";

const IT_MESSAGES: Record<InputGuardrailReason, string> = {
  OFF_TOPIC:
    "Il Narratore ti fissa in silenzio. Questa domanda non appartiene a questo mondo. Cosa vuoi fare?",
  INJECTION:
    "Qualcosa nella tua mente sembra confusa. Il Narratore attende una tua azione nella storia.",
  INAPPROPRIATE:
    "Il Narratore non puo proseguire con questo. Torna alla storia.",
  EXPLOIT:
    "Il Narratore percepisce una distorsione nella realta. Solo le tue azioni nella storia contano.",
  PARSE_ERROR: "Il Narratore ha difficolta a comprendere. Per favore, riformula.",
  INPUT_TOO_LONG:
    "Il Narratore non riesce a seguire un discorso cosi lungo. Sii piu conciso.",
  EMPTY_INPUT: "Il Narratore attende un'azione. Prova a descrivere cosa fai.",
  NON_PRINTABLE:
    "Il Narratore fatica a leggere questi simboli. Riformula in modo semplice.",
};

const EN_MESSAGES: Record<InputGuardrailReason, string> = {
  OFF_TOPIC:
    "The Narrator stares at you in silence. This question does not belong to this world. What do you want to do?",
  INJECTION:
    "Something in your mind seems confused. The Narrator awaits your action in the story.",
  INAPPROPRIATE:
    "The Narrator cannot continue with this. Return to the story.",
  EXPLOIT:
    "The Narrator senses a distortion in reality. Only your actions in the story count.",
  PARSE_ERROR: "The Narrator struggles to understand. Please rephrase.",
  INPUT_TOO_LONG:
    "The Narrator cannot follow such a long speech. Be more concise.",
  EMPTY_INPUT: "The Narrator waits for an action. Try describing what you do.",
  NON_PRINTABLE:
    "The Narrator struggles to read these symbols. Please rephrase clearly.",
};

/** Return localized narrative-safe message for a blocked input. */
export function getGuardrailBlockMessage(
  reason: InputGuardrailReason,
  language: string,
): string {
  const isItalian = language.toLowerCase().startsWith("it");
  return isItalian ? IT_MESSAGES[reason] : EN_MESSAGES[reason];
}
