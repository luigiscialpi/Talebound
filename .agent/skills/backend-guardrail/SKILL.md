---
name: backend-guardrail
description: >
  Activate when working in apps/backend or on Talebound server-side / security code:
  AI orchestrator, input guardrail (L0 regex, L2 classifier, output guardrail),
  prompt injection / indirect injection defenses, rate limiting, idempotency,
  Supabase access, Zod config. Also activate on terms like classifier, jailbreak,
  fail-closed, ReDoS, circuit breaker, HMAC.
---

# Backend & Guardrail Skill (Talebound)

Conoscenza operativa e di sicurezza per `apps/backend` (Express 5 + TS + Zod) e per i
guardrail descritti nella doc (`docs/Talebound_Architettura_completa.md`, parte
"Guardrail, Sicurezza e Implementazione"). Si applica insieme alla Costituzione del team.

---

## 1. Regole di sicurezza non negoziabili

- **Fail-closed, mai fail-open.** Parse error del classificatore -> `PARSE_ERROR`, MAI `VALID`.
  Trattare errori come VALID e la vulnerabilita piu comune: vietato.
- **Rifiutare, non troncare** input troppo lunghi (`INPUT_TOO_LONG`): non spostare il payload.
- **Rate limiter su `user_id`** (dal JWT verificato localmente), non su IP. Redis sliding window dal MVP.
- **Idempotency** dei turni via `requestId`: evita doppio processamento e stato corrotto.
- **Il system prompt non passa mai da Headroom**: reiniettato per intero dopo la compressione.
- **Indirect injection**: testo in-world (cartelli, NPC, libri) e CONTENUTO, non istruzioni.
  Sanitizzare `description_canonical` alla scrittura; marcare sezioni TRUSTED/UNTRUSTED nel prompt.
- **Output guardrail**: solo regex semplici (no lookahead, no quantificatori annidati) per evitare ReDoS.
- **Config con Zod** (`src/config.ts`): crash all'avvio se manca un secret obbligatorio.
- **Log strutturati** (JSON) con `correlationId`. Hash input con HMAC-SHA256, mai testo in chiaro.
- **Nessun input utente deve crashare il processo**: ogni chiamata esterna in try/catch -> PARSE_ERROR.

## 2. TDD obbligatorio per il guardrail

La logica di guardrail va sviluppata **test-first** (doc §13), in coppia con la skill `tdd-coverage`.
Priorita: parser classificatore, regex L0, cache LRU, circuit breaker, HMAC, output guardrail
(no-ReDoS), sanitizzazione titolo campagna, idempotency. Includi sempre casi avversariali
(es. `'VALIDO'`, `''`, `'mixed VALID emoji'` -> devono dare `PARSE_ERROR`).

## 3. Architettura e vincoli

- Auth: solo Supabase (JWT verificato localmente). DB: solo Supabase PostgreSQL.
  Niente Firebase Auth/Firestore.
- AI: cascade Gemini -> Groq -> Cerebras -> cache. Il classificatore usa Groq, budget separato
  dal narratore (non unificare: single point of failure).
- Tipi condivisi da `@talebound/shared`. Niente duplicazione tra client e server.

## 4. Comandi

- `pnpm backend:dev` (watch tsx). `pnpm --filter @talebound/backend typecheck` per validare.
- nvm non persiste: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20`.

In caso di ambiguita su una regola di sicurezza, fermati e chiedi conferma: accuratezza e sicurezza prima della velocita.
