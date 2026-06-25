# Talebound

Avventure testuali GenAI · React Native + Expo (Android-first)

> **Handoff / Onboarding** — questo file è il punto d'ingresso per chiunque
> riprenda il progetto. La doc tecnica completa è in
> [docs/Talebound_Architettura_completa.md](docs/Talebound_Architettura_completa.md).

---

## Stato attuale

Fase: **scaffolding del monorepo completato e verificato**.

- [x] Toolchain: Node 20 LTS (nvm) + pnpm 10
- [x] Monorepo pnpm (`apps/*`, `packages/*`)
- [x] App mobile: Expo **SDK 55** + expo-router + expo-dev-client
- [x] Backend: Express 5 + TypeScript + config validato con Zod
- [x] Package condiviso `@talebound/shared` (tipi TS)
- [x] Metro verificato (dev server su `:8081`)
- [ ] Emulatore Android Studio + prima dev build
- [ ] Account cloud (Supabase, Firebase, AI keys) + `.env`
- [ ] Schema DB Supabase (migration + RLS)

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
pnpm backend:dev
```

| Comando | Effetto |
|---|---|
| `pnpm dev` | Avvia Metro (`expo start --dev-client`) |
| `pnpm android` | Build + install dev build su emulatore/device |
| `pnpm backend:dev` | Avvia il backend in watch (tsx) |
| `pnpm typecheck` | Typecheck di tutto il monorepo |
| `pnpm lint` | Lint di tutto il monorepo |

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

---

## Prossimi passi suggeriti

1. **Emulatore Android** → AVD API 34+, poi `pnpm android` per la prima dev build.
2. **Account cloud** → progetti Supabase + Firebase, API key AI (Gemini/Groq/Cerebras),
   compilare `apps/backend/.env`.
3. **Schema DB** → tradurre le tabelle della doc (§19) in migration SQL + RLS.
4. **Guardrail** → implementare L0/L2/output con TDD (doc §13, test-first obbligatorio).

---

## Agenti e skill custom

Il progetto usa **skill** (conoscenza di dominio, attivata automaticamente dal
contesto) e **agenti** (modalità di lavoro che selezioni manualmente).

Skill (`.github/skills/`):

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
