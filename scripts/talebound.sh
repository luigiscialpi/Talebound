#!/bin/bash
# scripts/talebound.sh
#
# Bootstrap e utility per il progetto Talebound.
# Esegui dalla root del repo:  bash scripts/talebound.sh

# --------------------------------------------------------------------------- #
# Costanti
# --------------------------------------------------------------------------- #
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
ANDROID_DIR="$MOBILE_DIR/android"

# --------------------------------------------------------------------------- #
# Helper output
# --------------------------------------------------------------------------- #
log_info()    { echo -e "\033[1;34mINFO   $*\033[0m"; }
log_ok()      { echo -e "\033[1;32mOK     $*\033[0m"; }
log_warn()    { echo -e "\033[1;33mATTENZ $*\033[0m"; }
log_errore()  { echo -e "\033[1;31mERRORE $*\033[0m" >&2; }

# --------------------------------------------------------------------------- #
# Setup NVM + Node 20
# --------------------------------------------------------------------------- #
setup_nvm() {
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    if command -v nvm &>/dev/null; then
        # Redirect stdin from /dev/null: nvm can consume characters the user
        # has already typed ahead, causing the menu read to get an empty value.
        nvm use 20 </dev/null 2>/dev/null || nvm install 20 </dev/null
    else
        log_warn "nvm non trovato. Assicurati di usare Node 20 (node --version)."
    fi
}

# --------------------------------------------------------------------------- #
# Controllo prerequisiti minimi
# --------------------------------------------------------------------------- #
check_prereqs() {
    local ok=1
    command -v pnpm &>/dev/null \
        || { log_errore "pnpm non trovato. Installa con: npm install -g pnpm"; ok=0; }
    [ -n "${ANDROID_HOME:-}" ] \
        || { log_errore "ANDROID_HOME non settato. Aggiungi al tuo .zshrc:  export ANDROID_HOME=\$HOME/Library/Android/sdk"; ok=0; }
    [ "$ok" -eq 1 ] || exit 1
    export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
}

# --------------------------------------------------------------------------- #
# 1. Installa dipendenze
# --------------------------------------------------------------------------- #
installa_dipendenze() {
    log_info "Installazione dipendenze pnpm nel monorepo..."
    cd "$REPO_ROOT"
    pnpm install
    log_ok "Dipendenze installate."
}

# --------------------------------------------------------------------------- #
# 2. Avvia Android  (emulatore + expo run:android)
# --------------------------------------------------------------------------- #
avvia_android() {
    _avvia_emulatore
    log_info "Lancio app su Android..."
    cd "$REPO_ROOT"
    pnpm --filter @talebound/mobile android
}

# --------------------------------------------------------------------------- #
# 3. Avvia Backend
# --------------------------------------------------------------------------- #
avvia_backend() {
    log_info "Avvio backend Express in primo piano (Ctrl+C per uscire)..."
    cd "$REPO_ROOT"
    pnpm --filter @talebound/backend dev
}

# --------------------------------------------------------------------------- #
# 4. Avvia tutto: backend in background + app Android
# --------------------------------------------------------------------------- #
avvia_tutto() {
    log_info "Avvio backend in background..."
    cd "$REPO_ROOT"
    pnpm --filter @talebound/backend dev &
    local backend_pid=$!
    log_ok "Backend avviato (PID: $backend_pid)"

    _avvia_emulatore
    log_info "Lancio app su Android..."
    pnpm --filter @talebound/mobile android

    log_info "Android chiuso. Termino il backend..."
    kill "$backend_pid" 2>/dev/null && log_ok "Backend fermato." || true
}

# --------------------------------------------------------------------------- #
# 5. Prebuild Android (genera apps/mobile/android/)
# --------------------------------------------------------------------------- #
prebuild_android() {
    log_info "Prebuild Expo per Android (genera la cartella android/)..."
    (cd "$MOBILE_DIR" && pnpm exec expo prebuild --platform android --clean)
    log_ok "Prebuild completato."
}

# --------------------------------------------------------------------------- #
# 6. Pulizia build Android
# --------------------------------------------------------------------------- #
pulisci_android() {
    if [ ! -d "$ANDROID_DIR" ]; then
        log_warn "Cartella android/ non trovata. Esegui prima il Prebuild (opzione 5)."
        return
    fi
    log_info "Pulizia build Android..."
    cd "$ANDROID_DIR"
    ./gradlew clean
    rm -rf app/build .gradle/ build/
    cd "$REPO_ROOT"
    log_ok "Build Android pulita."
}

# --------------------------------------------------------------------------- #
# 7. Pulizia HARDCORE (svuota anche ~/.gradle globale — operazione lenta)
# --------------------------------------------------------------------------- #
pulisci_android_hardcore() {
    log_warn "Questa operazione rimuove ~/.gradle e richiede molto tempo al prossimo build."
    read -rp "Continuare? (s/N): " conferma
    [[ "$conferma" =~ ^[sS]$ ]] || { log_info "Annullato."; return; }
    log_info "Rimozione ~/.gradle..."
    rm -rf ~/.gradle/
    pulisci_android
    log_ok "Pulizia hardcore completata."
}

# --------------------------------------------------------------------------- #
# 8. Typecheck monorepo
# --------------------------------------------------------------------------- #
typecheck() {
    log_info "Typecheck su tutto il monorepo..."
    cd "$REPO_ROOT"
    pnpm typecheck
    log_ok "Typecheck completato senza errori."
}

# --------------------------------------------------------------------------- #
# 9. Pulizia cache pnpm / Metro / Watchman
# --------------------------------------------------------------------------- #
pulisci_cache() {
    log_info "Pulizia pnpm store..."
    pnpm store prune
    if command -v watchman &>/dev/null; then
        log_info "Reset watchman..."
        watchman watch-del-all
    else
        log_warn "watchman non trovato, skip."
    fi
    log_ok "Cache pulita."
}

# --------------------------------------------------------------------------- #
# Funzione interna: avvia emulatore con selezione interattiva
# --------------------------------------------------------------------------- #
_avvia_emulatore() {
    # Gia' attivo? Non fare nulla.
    if "$ANDROID_HOME/platform-tools/adb" devices | grep -q "emulator-"; then
        log_ok "Un emulatore e' gia' attivo."
        return
    fi

    # Controlla anche device fisico connesso
    local device_fisico
    device_fisico=$(
        "$ANDROID_HOME/platform-tools/adb" devices \
        | grep -v emulator | grep -w "device" | awk '{print $1}' | head -n 1
    )
    if [ -n "$device_fisico" ]; then
        log_ok "Device fisico rilevato: $device_fisico. Non avvio un emulatore."
        return
    fi

    # Raccoglie lista AVD
    local avd_list=()
    while IFS= read -r line; do
        [ -n "$line" ] && avd_list+=("$line")
    done < <("$ANDROID_HOME/emulator/emulator" -list-avds 2>/dev/null)

    if [ ${#avd_list[@]} -eq 0 ]; then
        log_errore "Nessun AVD trovato. Creane uno con Android Studio."
        exit 1
    fi

    echo ""
    echo "Emulatori disponibili:"
    for i in "${!avd_list[@]}"; do
        echo "  $((i+1))) ${avd_list[$i]}"
    done
    echo ""
    read -rp "Scegli un emulatore [1-${#avd_list[@]}]: " scelta_avd

    if ! [[ "$scelta_avd" =~ ^[0-9]+$ ]] \
        || [ "$scelta_avd" -lt 1 ] \
        || [ "$scelta_avd" -gt "${#avd_list[@]}" ]; then
        log_errore "Scelta non valida."
        exit 1
    fi

    local avd_name="${avd_list[$((scelta_avd-1))]}"
    log_info "Avvio emulatore: $avd_name"
    nohup "$ANDROID_HOME/emulator/emulator" \
        -avd "$avd_name" -no-snapshot-load -no-boot-anim \
        -dns-server 8.8.8.8,8.8.4.4 \
        > /dev/null 2>&1 &

    _attendi_emulatore
}

# Funzione interna: poll fino al boot completo
_attendi_emulatore() {
    log_info "Attesa avvio completo dell'emulatore..."
    "$ANDROID_HOME/platform-tools/adb" wait-for-device

    local boot_completed=""
    while [ "$boot_completed" != "1" ]; do
        echo "  boot in corso..."
        sleep 3
        boot_completed=$(
            "$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed \
            2>/dev/null | tr -d '\r'
        )
    done
    log_ok "Emulatore pronto."
}

# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
setup_nvm
check_prereqs

echo ""
echo "================================================"
echo "  Talebound - Script di avvio e manutenzione"
echo "================================================"
echo ""
echo "  1) Installa dipendenze         (pnpm install)"
echo "  2) Avvia Android               (emulatore + expo run:android)"
echo "  3) Avvia Backend               (pnpm backend:dev)"
echo "  4) Avvia tutto                 (backend + Android)"
echo "  5) Prebuild Android            (genera apps/mobile/android/)"
echo "  6) Pulisci build Android       (gradlew clean)"
echo "  7) Pulisci Android - HARDCORE  (svuota anche ~/.gradle)"
echo "  8) Typecheck monorepo"
echo "  9) Pulisci cache pnpm / Metro"
echo ""
read -rp "Scelta: " scelta_menu

case "$scelta_menu" in
    1) installa_dipendenze ;;
    2) avvia_android ;;
    3) avvia_backend ;;
    4) avvia_tutto ;;
    5) prebuild_android ;;
    6) pulisci_android ;;
    7) pulisci_android_hardcore ;;
    8) typecheck ;;
    9) pulisci_cache ;;
    *) log_errore "Scelta non valida."; exit 1 ;;
esac
