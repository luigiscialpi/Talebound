---
name: mobile-expo
description: >
  Activate when working in apps/mobile or on the Talebound React Native client:
  Expo SDK 55, expo-router, dev build, Reanimated, Skia map, audio/TTS/STT, AdMob,
  or whenever installing/upgrading mobile dependencies. Also activate on terms like
  Expo, Metro, dev-client, prebuild, EAS, React Native.
---

# Mobile / Expo Skill (Talebound)

Conoscenza operativa per l'app `apps/mobile` (Expo SDK 55, monorepo pnpm).
Si applica insieme alla Costituzione del team (`.github/copilot-instructions.md`).

---

## 1. Regole di progetto (NON violare)

- **Dev build, non Expo Go.** Lo stack nativo (Skia, Firebase, AdMob) non gira in
  Expo Go. Si lavora con `expo-dev-client`: installi l'APK una volta su
  emulatore/telefono, poi Metro + Fast Refresh. Si ricostruisce solo quando si
  aggiunge una **nuova libreria nativa**.
- **Installa con `npx expo install <pkg>`**, mai `pnpm add` per dipendenze RN:
  Expo allinea le versioni alla SDK 55. Dopo cambi di versione: `npx expo install --fix`.
- **`.npmrc` ha `node-linker=hoisted`**: Metro non gestisce i symlink pnpm. Non rimuoverlo.
- **`metro.config.js` e monorepo-aware** (watchFolders=root, nodeModulesPaths root+app).
  Non semplificarlo.
- **Reanimated 4**: il plugin Babel e `react-native-worklets/plugin` (ultimo della
  lista), non `react-native-reanimated/plugin`.
- **Tipi condivisi** da `@talebound/shared`: non duplicare GameState, AIResponse, Room...

## 2. Comandi

- `pnpm dev` -> Metro (Fast Refresh). `pnpm android` -> build/install dev build.
- `pnpm --filter @talebound/mobile typecheck` per validare le modifiche.
- nvm non persiste: prefissa con
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20`.

## 3. Stile e architettura

- Componenti funzionali + hook. Routing file-based con expo-router (`typedRoutes` on).
- Stato server con `@tanstack/react-query` (quando introdotto). JWT in `expo-secure-store`.
- Accessibilita e tema dark/light non sono opzionali (roadmap Fase 3).
- Riferimenti doc: §4 (app), §12 (musica), §13 (mappa Skia), §14 (voce TTS/STT).

## 4. Checklist finale

- Typecheck verde. Verifica su emulatore/device. Ricorda la logica di business, non solo la sintassi.
