#!/bin/bash
# scripts/healthcheck.sh
#
# Controllo rapido qualita' e deprecazioni per Talebound.
# Uso:
#   bash scripts/healthcheck.sh
#   bash scripts/healthcheck.sh --android

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
RUN_ANDROID_CHECK=0

for arg in "$@"; do
  case "$arg" in
    --android) RUN_ANDROID_CHECK=1 ;;
  esac
done

log_info()   { echo "[INFO] $*"; }
log_ok()     { echo "[OK]   $*"; }
log_warn()   { echo "[WARN] $*"; }
log_fail()   { echo "[FAIL] $*"; }

setup_nvm() {
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  if command -v nvm >/dev/null 2>&1; then
    nvm use 20 </dev/null 2>/dev/null || nvm install 20 </dev/null
  fi
}

run_step() {
  local title="$1"
  local command="$2"

  log_info "$title"
  if bash -lc "cd '$REPO_ROOT' && $command"; then
    log_ok "$title"
    return 0
  fi

  log_fail "$title"
  return 1
}

main() {
  local failed=0

  setup_nvm

  if ! command -v pnpm >/dev/null 2>&1; then
    log_fail "pnpm non trovato"
    exit 1
  fi

  run_step "Lint mobile (expo lint)" "pnpm --filter @talebound/mobile lint" || failed=1
  run_step "Typecheck monorepo" "pnpm typecheck" || failed=1

  run_step "Expo Doctor" "pnpm --filter @talebound/mobile exec expo-doctor" || failed=1

  log_info "Dipendenze obsolete (report informativo)"
  if bash -lc "cd '$REPO_ROOT' && pnpm -r outdated"; then
    log_ok "Nessuna dipendenza obsoleta"
  else
    log_warn "Sono presenti dipendenze obsolete (vedi tabella sopra)"
  fi

  if [ "$RUN_ANDROID_CHECK" -eq 1 ]; then
    if [ -d "$ANDROID_DIR" ]; then
      run_step "Gradle check configurazione (--warning-mode all)" "cd '$ANDROID_DIR' && ./gradlew help --warning-mode all" || failed=1
    else
      log_warn "Cartella android/ non trovata. Esegui prima: pnpm --filter @talebound/mobile prebuild"
    fi
  fi

  echo ""
  echo "---------------- RIEPILOGO ----------------"
  if [ "$failed" -eq 0 ]; then
    log_ok "Health-check completato senza errori bloccanti"
    exit 0
  fi

  log_fail "Health-check completato con errori"
  exit 1
}

main
