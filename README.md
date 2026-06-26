# Talebound

Avventure testuali GenAI · React Native + Expo (Android-first)

> **Handoff / Onboarding** — questo file è il punto d'ingresso per chiunque
> riprenda il progetto. La doc tecnica completa è in
> [docs/Talebound_Architettura_completa.md](docs/Talebound_Architettura_completa.md).

---

## Stato attuale

Fase: **orchestratore narratore multi-provider e state manager Supabase completati**.

- [x] Toolchain: Node 20 LTS (nvm) + pnpm 10
- [x] Monorepo pnpm (`apps/*`, `packages/*`)
- [x] App mobile: Expo **SDK 55** + expo-router + expo-dev-client
- [x] Backend: Express 5 + TypeScript + config validato con Zod
- [x] Package condiviso `@talebound/shared` (tipi TS)
- [x] Metro verificato (dev server su `:8081`)
- [x] ESLint mobile configurato (flat config + eslint-config-expo)
- [x] Script `talebound.sh` — menu bootstrap/avvio interattivo in italiano
- [x] Script `scripts/healthcheck.sh` — lint + typecheck + expo doctor (19/19) in un colpo
- [x] Android CLI (`emulator:list`, `emulator`, `android:dev`) in `package.json`
- [x] Emulatore Android Studio + prima dev build (Pixel 10)
- [x] Provider AI runtime: **Groq** configurato e verificato end-to-end
  (classificatore L2 + narratore runtime rispondono live; `provider:"groq"`)
- [x] Account cloud (Supabase, Firebase, AI keys) + `.env` — Groq + Gemini attivi;
  Supabase progetto creato e linkato via CLI (`supabase link`)
- [x] Schema DB Supabase v1 core — migration `0001_core_schema.sql` + `0002_rls_policies.sql`
  applicate al progetto remoto (`supabase db push`)
- [~] Guardrail logica pura (TDD): L0 (§2), output (§5), sanitizer canonical (§6), parser L2 fail-closed (§4), orchestratore input L0→L2 fail-closed, sanitizer titolo campagna (§4), cache classificatore LRU+TTL (`getCacheKey`, §4), circuit breaker classificatore (§9), servizio classificatore con adapter Groq (retry/timeout), wiring runtime su endpoint `POST /guardrail/check` e endpoint `POST /game/action` con narratore runtime minimo + output guardrail + rate limiter su `user_id` (sliding window in-memory, upgrade path Redis). Resta come pezzo cloud-dipendente: rate limiter Redis condiviso multi-istanza. Pagina/stato di gioco salvato via SupabaseGameStore (con fallback locale).

---

## Prerequisiti

- **Node 20 LTS** (gestito via `nvm`; vedi `.nvmrc`). Node 18 NON è supportato da Expo SDK 55.
- **pnpm 10** (via corepack: `corepack enable && corepack prepare pnpm@10.17.1 --activate`).
- **Android Studio** (SDK + NDK + un AVD API 34+) per emulatore e build native.
- **JDK 17** per le build Android.

> Se `node`/`pnpm` non sono nel PATH della shell:
> `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20`

---

## Avvio rapido

```bash
# 1. Installa le dipendenze del workspace
pnpm install

# 2. Avvia Metro per l'app mobile (Fast Refresh)
pnpm dev

# 3. Compila e installa la dev build su emulatore/device (prima volta)
pnpm android

# Backend (in un altro terminale)
cp apps/backend/.env.example apps/backend/.env   # poi compila i valori
# Il backend NON carica .env da solo: sorgilo prima di avviare
set -a && source apps/backend/.env && set +a && pnpm backend:dev
```

> **Chiavi AI minime per il runtime**: basta `GROQ_API_KEY` (free, da
> [console.groq.com](https://console.groq.com)) per far girare classificatore e
> narratore. ATTENZIONE: Groq (`api.groq.com`) **non** e Grok/xAI (`api.x.ai`):
> sono provider diversi, il piano (doc §10) usa Groq + Gemini.
> In dev locale `CLASSIFIER_TIMEOUT_MS=300` puo essere troppo stretto per il
> round-trip verso Groq US: alzalo (es. `2000`) nel tuo `.env` se vedi `PARSE_ERROR`.

| Comando | Effetto |
|---|---|
| `pnpm dev` | Avvia Metro (`expo start --dev-client`) |
| `pnpm android` | Build + install dev build su emulatore/device |
| `pnpm backend:dev` | Avvia il backend in watch (tsx) |
| `pnpm typecheck` | Typecheck di tutto il monorepo |
| `pnpm lint` | Lint di tutto il monorepo |

Endpoint backend runtime disponibili (MVP scaffolding):

| Metodo | Endpoint | Note |
|---|---|---|
| `POST` | `/guardrail/check` | Solo decisione guardrail input |
| `POST` | `/game/new` | Inizializza/resetta slot in-memory |
| `GET` | `/game/state/:slotId?userId=...` | Legge stato slot in-memory |
| `POST` | `/game/action` | Guardrail + narratore runtime + update stato + idempotency |

Smoke test guardrail runtime (con backend avviato):

```bash
curl -sS -X POST http://localhost:3000/guardrail/check \
  -H 'content-type: application/json' \
  -d '{
    "campaignId":"demo-1",
    "campaignTitle":"La Torre Nera",
    "campaignGenre":"fantasy",
    "campaignLanguage":"it",
    "input":"apro la porta"
  }'
```

Smoke test endpoint di gioco (guardrail + narratore runtime minimo):

```bash
curl -sS -X POST http://localhost:3000/game/action \
  -H 'content-type: application/json' \
  -d '{
    "userId":"user-1",
    "action":"apro la porta",
    "slotId":"slot-1",
    "requestId":"req-1",
    "campaignId":"demo-1",
    "campaignTitle":"La Torre Nera",
    "campaignGenre":"fantasy",
    "campaignLanguage":"it"
  }'
```

Note `/game/action`:

- `requestId` e idempotente per `userId`: retry con lo stesso `requestId`
  restituisce la stessa risposta (`idempotentReplay: true`) senza doppio turno.
- Stato slot attuale e in-memory (persistenza temporanea): verra sostituito da
  StateManager su Supabase nelle fasi cloud successive.

---

## Struttura del monorepo

```
Talebound/
├── apps/
│   ├── mobile/          # Expo SDK 55, expo-router, dev-client
│   │   ├── app/         # Schermate (file-based routing)
│   │   ├── app.json     # Config Expo
│   │   ├── babel.config.js   # plugin react-native-worklets (Reanimated 4)
│   │   └── metro.config.js   # monorepo-aware
│   └── backend/         # Express 5 + TS + Zod
│       ├── src/index.ts      # /health + graceful shutdown
│       ├── src/config.ts     # validazione env
│       └── .env.example
├── packages/
│   └── shared/          # Tipi TS condivisi (@talebound/shared)
├── supabase/
│   └── migrations/      # 0001 schema core v1, 0002 policy RLS
├── docs/                # Documentazione tecnica
├── pnpm-workspace.yaml
└── .npmrc               # node-linker=hoisted (necessario per Metro + pnpm)
```

---

## Convenzioni e trappole (leggere prima di lavorare)

- **Dev build, non Expo Go.** Skia, Firebase nativo e AdMob non girano in Expo Go.
  Si usa una **Development Build** (`expo-dev-client`): la installi una volta su
  emulatore/telefono, poi lavori con Metro + Fast Refresh. Si ricostruisce solo
  quando si aggiunge una **nuova libreria nativa**.
- **Installare pacchetti mobile con `npx expo install <pkg>`**, non `pnpm add`:
  Expo allinea le versioni alla SDK in uso.
- **`.npmrc` ha `node-linker=hoisted`**: Metro non supporta i symlink di pnpm.
  Non rimuoverlo.
- **Reanimated 4**: il plugin Babel è `react-native-worklets/plugin`
  (non `react-native-reanimated/plugin`).
- **Secret**: mai committare `.env`. Solo `.env.example` è versionato.
- **Backend non carica `.env` da solo**: va sorgento prima dell'avvio
  (`set -a && source apps/backend/.env && set +a && pnpm backend:dev`).
- **Processo backend orfano su `:3000`**: chiudere il terminale non sempre uccide
  il child node di `tsx watch`. Se edit/riavvii non hanno effetto (il server
  risponde con codice/config vecchi), cerca l'orfano con
  `lsof -nP -iTCP:3000 -sTCP:LISTEN`, poi `kill <PID>` prima di riavviare.

---

## Prossimi passi suggeriti

1. ~~**Account cloud**~~ ✅ Supabase progetto creato e linkato, `.env` compilato.
2. ~~**Schema DB**~~ ✅ Migration `0001` + `0002` applicate (`supabase db push`).
3. ~~**Orchestratore narratore completo**~~ ✅ Gemini → Groq → Cerebras + cache LRU (256 entry, TTL 5 min).
4. ~~**State manager DB**~~ ✅ Collegato il game state a Supabase con fallback locale in-memory.
5. **Rate limiter Redis** → migrazione da sliding window in-memory a Redis shared
   multi-istanza.

---

## Agenti e skill custom

Il progetto usa **skill** (conoscenza di dominio, attivata automaticamente dal
contesto) e **agenti** (modalità di lavoro che selezioni manualmente).

Skill (`.github/skills/`) oppure (`.agent/skills/`):

Skill di progetto:

- **mobile-expo** — sviluppo app Expo / React Native (`apps/mobile`).
- **backend-guardrail** — backend Node.js e sicurezza anti-injection (`apps/backend`).
- **tdd-coverage** — metodologia di test Red-Green-Refactor (si combina con le altre).

Skill community (da awesome-copilot, attivate dal contesto):

- **security-review** — scansione del codice per vulnerabilita (injection, XSS,
  secret esposti, access control) ragionando sui data flow.
- **gdpr-compliant** — pratiche di ingegneria GDPR per dati personali, logging,
  retention/cancellazione e privacy by design.
- **postgresql-optimization** — feature avanzate PostgreSQL (JSONB, array, FTS,
  window function), utile per lo schema su Supabase.
- **ai-prompt-engineering-safety-review** — review di sicurezza e robustezza dei
  prompt verso gli LLM (bias, injection, efficacia).
- **javascript-typescript-jest** — best practice per test Jest in JS/TS
  (mocking, struttura, pattern comuni).
- **eval-driven-dev** — metodologia eval-driven per app GenAI (criteri, golden
  dataset, analisi). Nota: tooling Python; usala come riferimento metodologico.

Agenti (`.github/agents/`):

- **Talebound Dev** — agente principale: Lazy Senior + metodologia RLM "Divide et
  Impera", consapevole del monorepo, si appoggia alle skill di dominio.

---

## Come riprendere il lavoro in una nuova chat

Tutto il contesto di progetto vive nel repo, quindi nello **stesso workspace** non
serve allegare quasi nulla:

- `.github/copilot-instructions.md`, le skill in `.github/skills/` e l'agente
  **Talebound Dev** si caricano/attivano da soli.
- La doc tecnica (`docs/Talebound_Architettura_completa.md`) **non** viene caricata
  a ogni messaggio: l'agente la legge in autonomia, solo la sezione che gli serve,
  quando il task lo richiede.

Passi pratici nella nuova chat:

1. Seleziona l'agente **Talebound Dev** dal menu modalità.
2. Scrivi da dove riprendere, es. *"Riprendi da README.md, prossimo step: schema DB"*.
3. Solo se lavori in un **altro workspace o su un'altra macchina**, allega la cartella
   `.github/` e i file in `docs/` (altrimenti non sono disponibili).
