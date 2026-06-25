# Talebound — Architettura Core

**AI Text Adventure · React Native + Expo · Giugno 2026**

---

## Indice

1. [Visione e Pilastri](#1-visione-e-pilastri)
2. [Stack Tecnologico](#2-stack-tecnologico)
3. [Autenticazione](#3-autenticazione)
4. [App React Native + Expo](#4-app-react-native--expo)
5. [Backend Node.js](#5-backend-nodejs)
6. [Database — Supabase PostgreSQL](#6-database--supabase-postgresql)
7. [Struttura Narrativa](#7-struttura-narrativa)
8. [Descrizioni Immutabili](#8-descrizioni-immutabili)
9. [Sistema di Salvataggio](#9-sistema-di-salvataggio)
10. [AI — Orchestratore e Modelli Gratuiti](#10-ai--orchestratore-e-modelli-gratuiti)
11. [World Builder](#11-world-builder)
12. [Musica Adattiva](#12-musica-adattiva)
13. [Mappa Interattiva](#13-mappa-interattiva)
14. [Voce — TTS e STT](#14-voce--tts-e-stt)
15. [Multilingua e Traduzione On-Demand](#15-multilingua-e-traduzione-on-demand)
16. [Community e Voti](#16-community-e-voti)
17. [Multiplayer Asincrono](#17-multiplayer-asincrono)
18. [Monetizzazione — AdMob](#18-monetizzazione--admob)
19. [Schema DB Completo](#19-schema-db-completo)
20. [Roadmap](#20-roadmap)
21. [Analisi Costi](#21-analisi-costi)

---

## 1. Visione e Pilastri

Talebound è un'avventura testuale AI-powered per Android. Lo scheletro di ogni storia è fisso (per garantire coerenza narrativa), arricchito da eventi procedurali AI-generati che rendono ogni run unica. Il narratore è un LLM gratuito orchestrato dal backend.

| Pilastro | Descrizione | Priorità MVP |
|---|---|---|
| Account e progressi | Registrazione, login, salvataggio partita su cloud | ⭐ Alta |
| Narratore AI | LLM gratuito che genera testo atmosferico e coerente | ⭐ Alta |
| Storia + proceduralità | Struttura fissa + eventi variabili ad ogni run | ⭐ Alta |
| Musica adattiva | Tracce ambientali che cambiano con l'umore della scena | ◈ Media |
| Mappa interattiva | Visualizzazione del mondo esplorato | ◈ Media |
| Community | Storie condivise, voti, traduzione on-demand | ◈ Media |
| Multiplayer asincrono | Co-op a turni con notifiche push | ○ Post-MVP |
| World Builder | Editor per storie create dagli utenti | ○ Post-MVP |

---

## 2. Stack Tecnologico

### Divisione di responsabilità

```
CLIENT REACT NATIVE
├── Supabase SDK    → DB queries, auth, storage
├── Firebase SDK    → analytics, crashlytics, remote config, AdMob
└── Expo SDK        → audio, speech, camera, notifications

BACKEND NODE.JS (Railway)
├── AIOrchestrator  → cascade Gemini → Groq → Cerebras
├── Guardrail       → L0 regex + L2 classificatore + output guardrail
├── GameEngine      → stato partita, eventi procedurali
└── Supabase client → lettura/scrittura DB

SUPABASE (cloud)
├── PostgreSQL      → tutti i dati business
├── Auth            → JWT, email, Google OAuth
└── Storage         → asset audio campagne community

FIREBASE (cloud)
├── Analytics       → eventi product, funnel, retention
├── Crashlytics     → errori client e stack trace
├── Remote Config   → feature flags senza deploy
└── AdMob           → ads e revenue tracking
```

### Regole fondamentali — nessuna duplicazione

- **Auth**: solo Supabase Auth. Firebase Auth non viene usato.
- **Database**: solo Supabase PostgreSQL. Firebase Firestore non viene usato.
- **Feature flags**: Firebase Remote Config (non tabelle DB custom).
- **Crash reporting**: solo Firebase Crashlytics.

---

## 3. Autenticazione

Supabase Auth gestisce tutti i metodi di login. Un solo sistema di autenticazione, nessuna sincronizzazione di token tra provider.

### Metodi supportati

| Metodo | Flusso | MVP |
|---|---|---|
| Email + password | `signUp()` → conferma email → `signIn()` | Sì |
| Google OAuth | `expo-auth-session` → `signInWithIdToken()` | Sì |
| Reset password | `resetPasswordForEmail()` → link → `updateUser()` | Sì |
| Magic link | `signInWithOtp()` → click link | Post-MVP |

### Persistenza sessione

Il JWT Supabase viene salvato in `expo-secure-store`. Il client JS lo refresha automaticamente prima della scadenza. Al riavvio, se il token è valido, l'utente è già loggato.

**Rate limiting sui token JWT**: il backend verifica il JWT ad ogni richiesta. La verifica è locale (Supabase JWT è firmato con chiave pubblica nota) — nessun roundtrip DB. Il rate limiter usa `user_id` estratto dal JWT verificato, non l'IP, per resistere a proxy e VPN.

### Google OAuth — setup

1. Google Cloud Console: crea OAuth 2.0 Client ID per Android (package name + SHA-1 keystore)
2. Supabase Dashboard → Authentication → Providers → Google
3. App RN: `expo-auth-session` con `makeRedirectUri()` per il callback
4. Per Play Store: secondo Client ID con SHA-1 del keystore di produzione EAS

### Template email Supabase

Editor HTML nella dashboard (Authentication → Email Templates). Variabili disponibili: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`.

| Template | Quando |
|---|---|
| Confirm signup | Dopo registrazione |
| Reset password | Richiesta reset |
| Magic link | Login via link |
| Change email | Cambio email |

Per produzione: SMTP custom via Resend.com (3.000 email/mese gratis).

---

## 4. App React Native + Expo

### Dipendenze principali

| Pacchetto | Versione | Funzione |
|---|---|---|
| expo | SDK 53+ | Base con New Architecture (Fabric + JSI) |
| expo-router | 4.x | Navigazione file-based, deep linking |
| @shopify/react-native-skia | latest | Mappa GPU-accelerated |
| expo-av | latest | Musica adattiva + ducking audio |
| expo-speech | latest | TTS narratore (on-device, gratis) |
| expo-speech-recognition | latest | STT dettatura comandi |
| @supabase/supabase-js | 2.x | Auth + DB + Storage |
| expo-auth-session | latest | Google OAuth flow |
| react-native-google-mobile-ads | latest | AdMob banner + rewarded + GDPR |
| expo-tracking-transparency | latest | ATT consent iOS |
| expo-localization + i18next | latest | Internazionalizzazione IT/EN/FR |
| @tanstack/react-query | 5.x | Cache + sync stato server |
| react-native-reanimated | 3.x | Animazioni 60fps |
| expo-secure-store | latest | JWT cifrato |
| expo-notifications | latest | Push notifications |
| @react-native-firebase/app | latest | Firebase core |
| @react-native-firebase/analytics | latest | Product analytics |
| @react-native-firebase/crashlytics | latest | Crash reporting |
| @react-native-firebase/remote-config | latest | Feature flags |

> Expo SDK 53+ abilita la New Architecture di default. Richiesta per `react-native-skia` che usa JSI per accedere alla GPU.

### Struttura cartelle (Expo Router)

| Percorso | Contenuto |
|---|---|
| `app/_layout.tsx` | Root layout: init AdMob, Supabase, i18n, Firebase |
| `app/(auth)/login.tsx` | Login email + Google |
| `app/(auth)/signup.tsx` | Registrazione + lingua preferita |
| `app/(home)/index.tsx` | Home: campagne, slot salvataggio |
| `app/(home)/create.tsx` | World Builder: form narrativo |
| `app/(home)/explore.tsx` | Community: esplora campagne |
| `app/(game)/play.tsx` | Schermata principale di gioco |
| `app/(game)/map.tsx` | Mappa Skia fullscreen |
| `app/(game)/inventory.tsx` | Inventario e statistiche |
| `app/settings.tsx` | Lingua, volume, consenso ads, account |
| `components/game/OutputText.tsx` | Testo narrativo con typewriter |
| `components/game/CommandInput.tsx` | Input + pulsante microfono STT |
| `components/game/StatsPanel.tsx` | HP, energia, posizione |
| `components/map/WorldMap.tsx` | Canvas Skia con grafo + fog of war |
| `components/ads/AdBanner.tsx` | Banner AdMob con gestione GDPR |
| `services/ai/AIOrchestrator.ts` | Client chiamate backend |
| `services/audio/AdaptiveMusic.ts` | Wrapper expo-av per crossfade mood |
| `services/i18n/index.ts` | Setup i18next con rilevamento locale |
| `hooks/useGameState.ts` | Stato partita, dispatch azioni |
| `hooks/useAuth.ts` | Auth Supabase: login, logout, sessione |

---

## 5. Backend Node.js

Il backend gira su Railway (free tier sufficiente per MVP).

### Flusso di ogni turno

1. Client invia `{ action, slotId, sessionToken, requestId }`
2. Auth middleware verifica JWT Supabase (locale, no roundtrip DB)
3. Rate limiter controlla soglie per `user_id` (Redis sliding window)
4. **L0 regex** pre-filtro (~0.1ms)
5. Se L0 blocca → risposta immediata
6. **L2 classificatore** (Groq Llama 8B, ~50ms)
7. Se non VALID → risposta con messaggio narrativo fisso
8. StateManager carica `state_json` da Supabase
9. EventSystem valuta eventi procedurali per la stanza
10. **Headroom** comprime storico (mai il system prompt)
11. **AIOrchestrator** tenta Gemini → Groq → Cerebras → cache
12. **Output guardrail** sulla risposta del narratore
13. Parser estrae narrativa + JSON metadata
14. StateManager aggiorna `state_json` su Supabase
15. Client riceve risposta via WebSocket (streaming) o HTTP

### Endpoint API

| Metodo | Endpoint | Descrizione |
|---|---|---|
| POST | `/game/action` | Invia azione, riceve narrativa + stato |
| GET | `/game/state/:slotId` | Stato corrente di un save slot |
| GET | `/game/slots` | Lista 3 save slot dell'utente |
| POST | `/game/new` | Inizia nuova partita su uno slot |
| GET | `/campaigns` | Lista campagne pubblicate |
| POST | `/campaigns/generate` | World Builder: genera campagna |
| POST | `/campaigns/:id/translate` | Avvia traduzione on-demand |
| WS | `/ws/stream` | Streaming token-by-token dal narratore |

### Struttura cartelle backend

| Percorso | Contenuto |
|---|---|
| `src/routes/` | `gameRoutes.ts`, `authRoutes.ts`, `campaignRoutes.ts` |
| `src/services/ai/` | `AIOrchestrator.ts`, `GeminiProvider.ts`, `GroqProvider.ts` |
| `src/services/guardrail/` | `L0Regex.ts`, `L2Classifier.ts`, `OutputGuardrail.ts` |
| `src/services/game/` | `GameEngine.ts`, `EventSystem.ts`, `StateManager.ts` |
| `src/services/db/` | `SupabaseClient.ts`, `SaveSlotService.ts` |
| `src/middleware/` | `authMiddleware.ts`, `rateLimiter.ts`, `idempotency.ts` |
| `src/types/` | `GameState.ts`, `AIResponse.ts`, `Campaign.ts` |
| `src/config.ts` | Config centralizzato con validazione Zod |
| `prompts/classifier/` | Versioni versionati del prompt classificatore |
| `prompts/narrator/` | Versioni versionati del prompt narratore |
| `prompts/l0_patterns/` | YAML con pattern regex L0 |

---

## 6. Database — Supabase PostgreSQL

### Schema completo

| Tabella | Scopo |
|---|---|
| `users` | Profili, preferenze lingua/voce, consenso GDPR |
| `user_consents` | Audit trail consensi (ads, analytics) |
| `campaigns` | Storie: metadati, stato pubblicazione, rating, lingue |
| `rooms` | Nodi narrativi: `description_canonical`, connessioni, mood |
| `room_translations` | Traduzioni on-demand per lingua |
| `events` | Pool eventi procedurali per stanza |
| `npcs` | Personaggi con personalità e stato |
| `story_acts` | Atti narrativi con trigger e testo di rivelazione |
| `save_slots` | Autosave + snapshot manuali + checkpoint di atto |
| `world_builder_jobs` | Coda generazione campagne utente |
| `campaign_ratings` | Voti e recensioni community |
| `rating_helpful` | "Utile" su recensioni |
| `campaign_reports` | Segnalazioni contenuti |
| `campaign_stats` | Statistiche aggregate |
| `co_op_sessions` | Stato condiviso multiplayer |
| `co_op_players` | Giocatori per sessione + ordine turni |
| `co_op_invites` | Inviti pending |
| `co_op_chat` | Chat fuori-gioco tra co-op players |
| `ai_logs` | Log sicurezza/audit per ogni turno |
| `business_events` | Revenue tracking custom |

---

## 7. Struttura Narrativa

### Principio fondamentale: lo scheletro sa, l'AI no

Lo scheletro (generato una volta dal World Builder) definisce atti, stanze e ending. Il narratore AI non conosce il futuro — descrive il presente sulla base dei fatti della stanza corrente. Come un attore che recita un copione: non improvvisa la trama, ma può recitare ogni battuta diversamente.

### I cinque layer

| Layer | Chi decide | Cosa decide | Quando |
|---|---|---|---|
| Atti e struttura | World Builder (una volta) | Sequenza atti, stanze chiave, trigger narrativi | Creazione campagna |
| Ending conditions | World Builder (una volta) | Cosa deve fare il giocatore per ogni finale | Creazione campagna |
| Stanze e connessioni | World Builder (una volta) | Grafo del mondo, descrizioni canoniche | Creazione campagna |
| Testo narrativo | AI narratore (ogni turno) | Come descrive la stanza, lo stile, l'atmosfera | Runtime |
| Scelta del giocatore | Utente | Dove va, cosa fa, cosa dice | Runtime |

### Ending

- **Principale**: risoluzione del mistero centrale con oggetti e stanza giusta.
- **Alternativi**: percorsi diversi, moralità diverse, stesso mondo.
- **Fallimento**: chiusura tragica ma narrativamente coerente.

Il sistema controlla le `ending_conditions` dopo ogni turno. Al raggiungimento di un ending, l'app propone di tornare a un checkpoint per esplorare percorsi alternativi.

### Metrica di profondità (non "durata in ore")

La durata in ore non è prevedibile — dipende dalla velocità di lettura, dall'esplorazione, dalle sessioni interrotte. Si comunicano invece dati oggettivi:

> **"35 scene · 3 finali · percorso minimo: 18 scene"**

Oppure semplicemente: **Breve / Media / Lunga**, calcolato dal numero di nodi e dalla profondità BFS verso gli ending. Per riferimento: Zork I aveva 110 stanze e un percorso minimo di 231 mosse.

### Rolling summary

Il narratore non riceve mai l'intera storia. Riceve un rolling summary aggiornato ogni 10 turni: atti completati, oggetti chiave, NPC incontrati, ultimi 5-10 turni completi. Generato dall'AI stessa: *"Riassumi in max 300 token gli eventi importanti accaduti finora."*

---

## 8. Descrizioni Immutabili

> **REQUISITO MANDATORIO**: la `description_canonical` di una stanza viene generata una sola volta e non cambia mai, salvo eventi espliciti di modifica permanente previsti dalla storia.

Questo è il principio fondante delle avventure testuali classiche: il mondo è consistente, le scelte hanno peso.

### Tipi di testo

| Tipo | Chi genera | Quando | Mutabile |
|---|---|---|---|
| `description_canonical` | World Builder / autore | Una volta, alla creazione | **Mai** |
| `description_state_override` | Story event esplicito | Solo se la storia lo prevede | Solo da eventi predefiniti |
| `narrative_flavor` | AI narratore | Ogni turno | Sì — non salvato |
| `event_text` | AI narratore (se evento scatta) | Solo quando il trigger è attivo | Sì — effimero |

Il `narrative_flavor` non viene mai salvato: è effimero, serve solo per rendere la lettura piacevole. Ciò che conta e viene salvato è lo STATO (porte aperte/chiuse, oggetti presenti/assenti, NPC vivi/morti).

### Schema tabella `rooms`

| Colonna | Tipo | Descrizione |
|---|---|---|
| `id` | uuid PK | Identificatore stanza |
| `campaign_id` | uuid FK | Campagna di appartenenza |
| `name` | text | Nome breve ("Corridoio B7") |
| `description_canonical` | text NOT NULL | Descrizione fissa e immutabile |
| `description_state_override` | text NULL | Override da eventi (null di default) |
| `connections` | jsonb | `{"nord": "uuid", "sud": null, ...}` |
| `music_mood` | text | calm / tense / danger / mystery / victory / sad |
| `items_initial` | jsonb | Oggetti presenti all'inizio |
| `first_visit_text` | text NULL | Testo speciale solo alla prima visita |
| `tags` | text[] | Es. `["safe_room", "boss_area", "puzzle"]` |

### Prompt template per il narratore

```
--- STANZA CORRENTE ---
Nome: {room.name}
Descrizione canonica (IMMUTABILE — usa questi fatti, non inventarne altri):
{room.description_canonical}

Stato attuale oggetti: {room_state.items}
Prima visita: {is_first_visit}

REGOLA: Descrivi questa stanza in modo atmosferico e coinvolgente.
Puoi variare tono e stile, ma i FATTI devono corrispondere esattamente
alla descrizione canonica. Non aggiungere porte, oggetti o dettagli
non presenti nella descrizione canonica.
--- FINE STANZA ---
```

---

## 9. Sistema di Salvataggio

### Tre livelli

| Tipo | Chi lo crea | Quando | Quanti | Scopo |
|---|---|---|---|---|
| Autosave | Sistema automatico | Ad ogni turno | 1 per slot (sovrascrive) | Continuare dove si era rimasti |
| Snapshot manuale | Utente ("Salva qui") | Quando vuole | 3 per slot (FIFO) | Tornare a un momento preciso |
| Checkpoint di atto | Sistema automatico | Al completamento di ogni atto | 1 per atto | Recovery post-ending |

I checkpoint di atto vengono creati silenziosamente. Quando l'utente raggiunge un ending, il gioco propone di tornare all'inizio dell'ultimo atto per esplorare percorsi alternativi.

### Flusso post-ending

1. Testo del finale con animazione e musica
2. Schermata "Fine Storia": ending raggiunto, statistiche run
3. Se esistono altri ending: *"Vuoi esplorare un percorso alternativo?"*
4. Scelta: torna all'ultimo atto / torna a uno snapshot / nuova run / menu

### Tabella `save_slots`

| Colonna | Tipo | Descrizione |
|---|---|---|
| `autosave_json` | jsonb | Stato completo aggiornato ad ogni turno |
| `snapshots_json` | jsonb[] | Max 3 snapshot manuali con timestamp e nome |
| `act_checkpoints_json` | jsonb[] | Checkpoint automatici per ogni atto |
| `endings_reached` | text[] | ID ending già raggiunti |
| `total_turns` | int | Contatore totale turni |

Gli snapshot FIFO: il quarto sovrascrive il primo. L'app avvisa prima di sovrascrivere, mostrando quale snapshot andrà perso.

---

## 10. AI — Orchestratore e Modelli Gratuiti

### Cascade provider

| Priorità | Provider | Modello | Limite free | Uso |
|---|---|---|---|---|
| 1 (primario) | Google AI Studio | Gemini 2.0 Flash | 1.500 req/giorno | Default — qualità narrativa migliore |
| 2 (fallback) | Groq | Llama 3.3 70B | 14.400 req/giorno | Se Gemini esaurito o lento |
| 3 (fallback) | Cerebras | Llama 3.1 8B | 1.000 req/giorno | Terzo fallback |
| 4 (emergency) | Cache backend | Risposta pre-scritta | Illimitato | Se tutti i provider falliscono |

Il classificatore usa Groq Llama 8B, separato dal budget Gemini. Questa separazione è intenzionale e non va unificata: unificarla creerebbe un single point of failure e saturerebbe il budget Gemini.

### Headroom — compressione contesto

Headroom riduce i token dello stato di gioco del 60-95% prima di ogni chiamata al narratore.

**Regola critica**: il system prompt non passa mai da Headroom. Viene sempre reiniettato per intero dopo la compressione. Se Headroom comprime anche il system prompt, le regole di sicurezza spariscono silenziosamente nelle campagne lunghe (es. al turno 200).

```javascript
const prompt = `
SYSTEM PROMPT (FIDATO — MAI COMPRIMERE):
${systemPrompt}

STATO DI GIOCO (FIDATO — MAI COMPRIMERE):
${gameState}

STORICO TURNI COMPRESSO (NON FIDATO):
${headroomCompressedHistory}

INPUT UTENTE (NON FIDATO):
${userInput}
`;

// Alert se Headroom comprime troppo aggressivamente
if (headroomRatio > 0.9) {
  logAlert('Headroom troppo aggressivo', { ratio: headroomRatio, turn: turnNumber });
  // Fallback: usa stato non compresso
}
```

### Formato risposta AI

| Campo | Tipo | Descrizione |
|---|---|---|
| `location` | string | Nome breve stanza corrente |
| `health` | number 0-100 | Salute personaggio |
| `energy` | number 0-100 | Energia / stamina |
| `inventory` | string[] | Lista completa oggetti |
| `hints` | string[] | Max 4 azioni suggerite contestualmente |
| `music_mood` | string | calm / tense / danger / mystery / victory / sad |
| `map_reveal` | object? | Nuova stanza da aggiungere alla mappa |
| `event_triggered` | string? | ID evento procedurale scattato |

---

## 11. World Builder

L'utente descrive la sua idea di storia in linguaggio libero. Il backend genera lo scheletro strutturato completo una volta sola e lo salva nel DB come campagna normale.

### Flusso

1. Utente descrive l'idea (form guidato o testo libero)
2. Backend invia al World Builder AI con prompt di generazione struttura
3. AI risponde con JSON completo della campagna
4. Backend valida, normalizza e salva in `campaigns` + `rooms` + `events`
5. Utente vede anteprima: titolo, mappa schematica, synopsis
6. Può rigenerare (max 3 tentativi) o confermare e iniziare

### Domande guidate

| Domanda | Uso |
|---|---|
| Ambientazione | Tono, estetica, vocabolario del narratore |
| Il protagonista | Seconda o terza persona, background iniziale |
| Il mistero centrale | Filo conduttore, ending conditions |
| Tono della storia | Parametro del prompt narratore |
| Lunghezza desiderata | Numero di stanze generate |
| Lingua della campagna | Lingua di tutte le descrizioni e dell'AI |

### Schema JSON output

| Campo | Descrizione |
|---|---|
| `campaign.title` | Titolo generato |
| `campaign.synopsis` | Breve descrizione (2-3 frasi) |
| `campaign.tone` | dark / hopeful / mystery / action / ecc. |
| `campaign.language` | Codice lingua |
| `rooms[]` | Stanze con `description_canonical`, connessioni, mood |
| `events[]` | Pool eventi procedurali con probabilità e trigger |
| `npcs[]` | Personaggi con personalità e posizione iniziale |
| `story_acts[]` | Atti con trigger e testo di rivelazione |
| `ending_conditions[]` | Oggetti e stanze richiesti per ogni ending |

### Stima token

| Campagna | Stanze | Token totali | Strategia |
|---|---|---|---|
| Breve | 10-12 | ~3.500-4.500 | Singola chiamata |
| Media | 20-25 | ~6.000-8.000 | Singola o due passate |
| Lunga | 40-50 | ~12.000-15.000 | Due passate obbligatorie |

Per campagne lunghe: passata 1 (struttura + stanze), passata 2 (eventi + NPC + ending). Mantiene ogni risposta sotto il limite di output di Gemini (8.192 token di default).

---

## 12. Musica Adattiva

### Mood e tracce

| Mood | Contesto | Prompt Suno |
|---|---|---|
| calm | Esplorazione tranquilla | "Ambient sci-fi, slow pads, deep space, no vocals, 80 BPM, loop-friendly, 2 min" |
| tense | Pericolo imminente | "Cinematic tension, rising strings, sci-fi thriller, no vocals, 110 BPM, loop" |
| danger | Combattimento / trappola | "Dark electronic, aggressive percussion, alarm tones, no vocals, 130 BPM" |
| mystery | Scoperta, enigma | "Mysterious ambient, sparse piano, reverb heavy, no vocals, 70 BPM, loop" |
| victory | Obiettivo raggiunto | "Uplifting sci-fi fanfare, resolution, no vocals, 10-15 seconds" |
| sad | Perdita, fallimento | "Melancholic ambient, slow piano, minor key, no vocals, 60 BPM" |

**Licenze Suno**: il piano Free non consente uso commerciale. Con AdMob attivo servono i diritti Pro (€10/mese). Generare le 6-10 tracce in un mese e poi cancellare. Alternativa gratuita: Freesound.org e OpenGameArt.org con licenze CC0.

### Implementazione

- `expo-av` con due istanze in parallelo per crossfade fluido (fade out A → fade in B in 2-3 secondi)
- Tracce bundled nell'APK per campagne ufficiali (~8-12MB totali)
- Campagne community: streaming da Supabase Storage con pre-caching
- **Ducking audio**: quando TTS inizia (`onStart`), volume musica scende a 0.3; quando finisce (`onDone`), torna a 1.0 con fade 500ms

---

## 13. Mappa Interattiva

`@shopify/react-native-skia` è il motore grafico di Chrome, Android e Flutter. Su Expo SDK 53+ funziona out-of-the-box con la New Architecture.

| Elemento | Implementazione Skia |
|---|---|
| Nodi stanze | `Circle`/`RoundedRect` con colore per tipo stanza |
| Connessioni | `Path` tra nodi, stile per stato (aperta/bloccata/segreta) |
| Fog of war | Nodi non visitati semitrasparenti con "?" |
| Stanza corrente | Nodo con pulsazione (Reanimated + Skia uniform) |
| Pinch-to-zoom | Gesture Handler → transform matrix Skia |
| Minimap | Secondo Canvas ridotto (15% schermo) sempre visibile |

Il grafo è memorizzato come adjacency list in `state_json`. Il campo `map_reveal` nel JSON del narratore aggiunge nuovi nodi in tempo reale.

Setup: `npx expo install @shopify/react-native-skia` (richiede Android NDK).

---

## 14. Voce — TTS e STT

### TTS — expo-speech

Usa il motore TTS nativo del dispositivo (Google TTS su Android). Funziona offline, gratis, senza latenza di rete.

| Parametro | Range | Default |
|---|---|---|
| `language` | BCP-47 (it-IT, en-US, fr-FR...) | Segue lingua campagna |
| `pitch` | 0.5 – 2.0 | 1.0 |
| `rate` | 0.1 – 2.0 | 1.0 |
| `voice` | ID voce installata | Voce di sistema |
| `onBoundary` | callback | Evidenzia parola durante lettura |

Impostazioni utente: voce (picker), velocità (slider), tonalità (slider), auto-lettura (toggle), evidenzia parola (toggle).

Cloud TTS (ElevenLabs, Google TTS Wavenet) come feature premium post-MVP.

### STT — expo-speech-recognition

Usa il riconoscimento vocale nativo. On-device su Android 13+.

**UX deliberata**: la trascrizione appare in tempo reale nel campo input ma **non viene inviata automaticamente**. L'utente corregge e conferma. Nelle avventure testuali le parole contano — un invio accidentale potrebbe compromettere la sessione.

### Gestione conflitti audio

| Scenario | Comportamento |
|---|---|
| TTS durante musica | Musica scende a 30% (ducking), TTS legge, poi torna a 100% con fade |
| STT durante musica | Musica scende a 20% (meno interferenze per il riconoscimento) |
| STT durante TTS | TTS si ferma, STT parte |
| Chiamata in arrivo | expo-av gestisce interruzione automaticamente |

---

## 15. Multilingua e Traduzione On-Demand

### Lingue supportate

| Lingua | UI app | World Builder | Traduzione on-demand |
|---|---|---|---|
| Italiano | MVP | MVP | MVP |
| Inglese | MVP | MVP | MVP |
| Francese | MVP | MVP | MVP |
| Spagnolo | v2.0 | v2.0 | MVP* |
| Tedesco | v2.0 | v2.0 | MVP* |
| Portoghese | v3.0 | v3.0 | MVP* |

*Solo traduzione on-demand; UI post-MVP.

### Traduzione on-demand

Quando un utente vuole giocare una storia in una lingua non disponibile:

1. Banner: *"Questa storia è in [lingua]. Tradurla in italiano?"*
2. Backend avvia traduzione batch di tutte le stanze
3. Progresso: "Traduzione: 7/23 stanze"
4. Salvata in `room_translations` e condivisa per tutti
5. Lingua aggiunta a `languages_available` della campagna

La traduzione è in coda a bassa priorità per non consumare il budget AI durante le ore di punta.

### Prompt di traduzione

```
Sei un traduttore letterario specializzato in narrativa.
Traduci da [LINGUA_ORIGINALE] a [LINGUA_TARGET].

REGOLE:
- Preserva atmosfera, registro narrativo e tono originale
- Non aggiungere o rimuovere informazioni fattuali
- Mantieni i nomi propri invariati salvo eccezioni ovvie
- La traduzione deve sembrare scritta originalmente in [LINGUA_TARGET]
- Rispondi SOLO con il testo tradotto, senza commenti

TESTO:
{description_canonical}
```

### Tabella `room_translations`

Chiave primaria composta: `(room_id, language)`.

| Colonna | Tipo | Descrizione |
|---|---|---|
| `room_id` | uuid FK | Stanza di riferimento |
| `language` | text | Codice lingua target |
| `description_canonical_translated` | text | Testo tradotto — immutabile come l'originale |
| `translated_at` | timestamptz | Data traduzione |
| `translated_by_model` | text | Modello AI usato |

---

## 16. Community e Voti

### Stati di una campagna

| Stato | Visibilità |
|---|---|
| `draft` | Solo autore |
| `published` | Tutti |
| `featured` | Tutti + evidenziata in home |
| `unlisted` | Solo chi ha il link |
| `suspended` | Nessuno |

### Schermata Esplora

Filtri: più votate, trending (run nelle ultime 48h), nuove, per lingua, per genere, per lunghezza, staff picks.

Ogni campagna mostra: copertina, titolo, autore, lingue disponibili, genere/tag, lunghezza (Breve/Media/Lunga), voto medio, numero voti, run completate.

### Sistema voti

- Stelle 1-5, un voto per utente per campagna, modificabile
- Recensione testuale opzionale (max 500 caratteri)
- **Voto abilitato solo dopo aver completato almeno un ending** — niente voti senza aver giocato
- "Utile" su recensioni (come Steam)
- Risposta autore (una per recensione)

### Moderazione

Moderazione reattiva: sistema di segnalazione disponibile su ogni campagna. Dopo N segnalazioni, campagna sospesa automaticamente e in coda revisione manuale. Autori con troppe violazioni: ban dalla pubblicazione, non dall'uso dell'app.

---

## 17. Multiplayer Asincrono

Il multiplayer real-time contrasta con lo spirito delle avventure testuali (si leggono con calma) ed è architetturalmente complesso. Il multiplayer asincrono è fedele al genere e si implementa con minime modifiche all'architettura esistente.

### Funzionamento

- Utente A crea sessione co-op e invita B tramite username o link
- I turni si alternano: A agisce → AI risponde → notifica push a B → B agisce → ...
- Entrambi vedono la storia completa in ogni momento
- Skip turno: dopo 24h di inattività, l'altro giocatore può passare
- Chat testuale per coordinarsi fuori dalla storia
- Supporto 3+ giocatori in rotazione circolare

Lo stato della sessione co-op è separato dagli slot singolo — non consuma i 3 slot personali.

### Tabelle DB

| Tabella | Colonne principali |
|---|---|
| `co_op_sessions` | `id, campaign_id, state_json, current_turn_user_id, turn_number` |
| `co_op_players` | `session_id, user_id, order_index, joined_at` |
| `co_op_invites` | `id, session_id, inviter_id, invitee_id, status, expires_at` |
| `co_op_chat` | `id, session_id, user_id, message, created_at` |

---

## 18. Monetizzazione — AdMob

### Formati ads

| Formato | Posizionamento | Frequenza | Impatto UX |
|---|---|---|---|
| Banner adattivo | In fondo alla schermata di gioco | Sempre visibile | Minimo |
| Interstitial | Tra stanze (ogni 5-10 mosse) | Moderata | Medio |
| Rewarded Video | "Guarda un video per un suggerimento AI extra" | Su richiesta | Positivo — volontario |
| App Open Ad | All'avvio (post-splash) | Una volta per sessione | Accettabile |

### Integrazione tecnica

- Libreria: `react-native-google-mobile-ads` (NON la deprecata `expo-ads-admob`)
- Richiede `expo prebuild` — non funziona con Expo Go, necessita development build
- UMP SDK integrato gestisce il consenso GDPR/EU automaticamente
- `delayAppMeasurementInit: true` in `app.json` — non tracciare prima del consenso
- TestIds obbligatori durante lo sviluppo (obbligatorio o AdMob blocca l'account)

---

## 19. Schema DB Completo

| Tabella | Scopo | Introdotta |
|---|---|---|
| `users` | Profili, preferenze, consenso GDPR | v1 |
| `user_consents` | Audit trail consensi GDPR/ATT | v1 |
| `campaigns` | Storie: metadati, stato, rating, lingue | v1 |
| `rooms` | Nodi narrativi con `description_canonical` | v1 |
| `room_translations` | Traduzioni on-demand per lingua | v2 |
| `events` | Pool eventi procedurali | v1 |
| `npcs` | Personaggi con personalità e stato | v1 |
| `story_acts` | Atti narrativi con trigger | v1 |
| `save_slots` | Autosave + snapshot + checkpoint di atto | v1 |
| `world_builder_jobs` | Coda generazione campagne utente | v2 |
| `campaign_ratings` | Voti e recensioni | v2 |
| `rating_helpful` | "Utile" su recensioni | v2 |
| `campaign_reports` | Segnalazioni contenuti | v2 |
| `campaign_stats` | Statistiche aggregate | v2 |
| `co_op_sessions` | Stato condiviso multiplayer | v3 |
| `co_op_players` | Giocatori per sessione | v3 |
| `co_op_invites` | Inviti pending | v3 |
| `co_op_chat` | Chat fuori-gioco | v3 |
| `ai_logs` | Log sicurezza/audit ogni turno | v1 |
| `business_events` | Revenue tracking custom | v1 |

---

## 20. Roadmap

### Fase 1 — Core + Auth (4 settimane)

| Task | Stima |
|---|---|
| Setup Expo SDK 53 + Skia + TypeScript | 1 giorno |
| Supabase: schema completo + RLS policies | 1 giorno |
| Auth: email + Google OAuth + template email | 3 giorni |
| Backend: AIOrchestrator + Headroom | 3 giorni |
| Backend: guardrail L0 + L2 + output | 3 giorni |
| Schermata gioco (output + input + stats) | 3 giorni |
| Sistema salvataggio (autosave + snapshot + checkpoint) | 3 giorni |
| Campagna Talebound demo (10 stanze, 2 ending) | 3 giorni |

### Fase 2 — Media + Voice + Community (5 settimane)

| Task | Stima |
|---|---|
| TTS expo-speech + STT expo-speech-recognition | 5 giorni |
| Ducking audio + impostazioni voce | 2 giorni |
| World Builder: form + generazione + anteprima | 6 giorni |
| Mappa Skia: nodi + fog of war + minimap | 5 giorni |
| Musica adattiva: tracce Suno + expo-av crossfade | 3 giorni |
| AdMob: banner + rewarded + consenso GDPR | 3 giorni |
| Community: pubblicazione + Esplora + voti | 5 giorni |
| Traduzione on-demand | 3 giorni |
| i18n UI: IT/EN/FR | 2 giorni |

### Fase 3 — Multiplayer + Polish (3 settimane)

| Task | Stima |
|---|---|
| Multiplayer asincrono: sessioni + inviti + notifiche | 7 giorni |
| Campagna Talebound completa (30+ stanze, 3+ ending) | 5 giorni |
| Accessibilità + dark/light theme | 2 giorni |
| Test su device fisici (API 26-34) | 3 giorni |
| EAS Build → APK + AAB firmato | 1 giorno |
| Google Play: closed testing → produzione | 1 giorno |

---

## 21. Analisi Costi

### Scalabilità

| DAU | Supabase | Firebase | Backend | Totale | Revenue AdMob stimata |
|---|---|---|---|---|---|
| 100 | $0 | $0 | $0 | **$0** | ~$3/mese |
| 1.000 | $0 | $0 | $0 | **$0** | ~$30/mese |
| 5.000 | $25 (Pro) | $0 | $0 | **$25/mese** | ~$150/mese |
| 10.000 | $50-100 | $0 | $5 | **$55-105/mese** | ~$300/mese |
| 50.000 | $150 | $0 | $20 | **$170/mese** | ~$1.500/mese |

Break-even: circa 5.000 DAU (costi ~$25, revenue ~$150).

### Costi una tantum

| Voce | Costo |
|---|---|
| Google Play Developer | €23 (una volta) |
| Suno AI Pro (generare tracce audio) | €10 (un mese, poi cancellare) |

### AI in produzione (>500 DAU)

Sopra ~500 DAU il free tier Gemini si esaurisce. Conviene attivare Gemini pay-per-use:
- $0.075/1M token input, $0.30/1M token output
- A 10k DAU: circa $40-60/mese di AI, ampiamente coperto dalla revenue AdMob

Il classificatore (Groq Llama 8B) con cache al 60% di hit rate costa ~$7/mese a 10k DAU.
