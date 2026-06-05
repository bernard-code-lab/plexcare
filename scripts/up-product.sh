#!/usr/bin/env bash
# up-product.sh — sobe TUDO que e necessario para usar o produto de
# teleconferencia end-to-end: stack Docker (postgres, redis, kafka, livekit,
# room-service) + teleconf-web em background.
#
# Idempotente — chamar duas vezes nao quebra nada.
#
# Para derrubar tudo (Docker + web bg): scripts/down-product.sh
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

readonly BOLD=$'\033[1m'
readonly GREEN=$'\033[0;32m'
readonly YELL=$'\033[0;33m'
readonly RED=$'\033[0;31m'
readonly CYAN=$'\033[0;36m'
readonly DIM=$'\033[2m'
readonly RESET=$'\033[0m'

readonly TELECONF_DIR="platform/backend/plexcare-teleconf-service"
readonly WEB_DIR="platform/frontend/plexcare-teleconf-web"
readonly TMP_DIR="${REPO_ROOT}/tmp"
readonly WEB_PID_FILE="${TMP_DIR}/teleconf-web.pid"
readonly WEB_LOG_FILE="${TMP_DIR}/teleconf-web.log"
readonly ROOM_SERVICE_URL="${ROOM_SERVICE_URL:-http://localhost:8080}"
readonly WEB_URL="${WEB_URL:-http://localhost:5174}"
readonly COMPOSE_PROJECT="${COMPOSE_PROJECT:-plexcare-platform-dev}"

mkdir -p "${TMP_DIR}"

step()  { printf "\n%s▶%s %s\n" "${CYAN}" "${RESET}" "$1"; }
ok()    { printf "  %s✓%s %s\n" "${GREEN}" "${RESET}" "$1"; }
warn()  { printf "  %s!%s %s\n" "${YELL}" "${RESET}" "$1"; }
fail()  { printf "  %s✗%s %s\n" "${RED}" "${RESET}" "$1" >&2; exit 1; }

# ---------- 1) docker stack ----------
step "Subindo stack Docker (postgres, redis, kafka, livekit, room-service)"
docker compose -f "${TELECONF_DIR}/docker-compose.dev.yml" -p "${COMPOSE_PROJECT}" up -d >/dev/null
ok "compose up -d ok"

# ---------- 2) wait for room-service ----------
step "Aguardando room-service ficar saudavel em ${ROOM_SERVICE_URL}/health"
attempts=0
max_attempts=60
until curl -sf -o /dev/null --max-time 2 "${ROOM_SERVICE_URL}/health"; do
  attempts=$((attempts + 1))
  if (( attempts >= max_attempts )); then
    warn "room-service nao respondeu apos ${max_attempts}s — verifique 'make logs'"
    break
  fi
  printf "  %s.%s" "${DIM}" "${RESET}"
  sleep 1
done
if (( attempts < max_attempts )); then
  printf "\n"
  ok "room-service respondendo (${attempts}s)"
fi

# ---------- 3) teleconf-web (background) ----------
step "Verificando teleconf-web (background)"
if [[ -f "${WEB_PID_FILE}" ]]; then
  pid="$(cat "${WEB_PID_FILE}")"
  if kill -0 "${pid}" 2>/dev/null; then
    ok "ja rodando (pid=${pid})"
  else
    warn "PID ${pid} morto — limpando arquivo"
    rm -f "${WEB_PID_FILE}"
  fi
fi

if [[ ! -f "${WEB_PID_FILE}" ]]; then
  if [[ ! -d "${WEB_DIR}/node_modules" ]]; then
    warn "${WEB_DIR}/node_modules ausente — rodando npm install primeiro"
    (cd "${WEB_DIR}" && npm install --no-audit --no-fund) || fail "npm install falhou em ${WEB_DIR}"
  fi
  # Log limpo a cada start para nao crescer indefinidamente.
  : > "${WEB_LOG_FILE}"
  # nohup + disown para sobreviver ao fechamento do terminal pai.
  ( cd "${WEB_DIR}" && nohup npm run dev > "${WEB_LOG_FILE}" 2>&1 & echo "$!" > "${WEB_PID_FILE}" )
  ok "teleconf-web iniciado (pid=$(cat "${WEB_PID_FILE}"), log=${WEB_LOG_FILE})"

  # Aguarda Vite responder.
  attempts=0
  max_attempts=30
  until curl -sf -o /dev/null --max-time 2 "${WEB_URL}/"; do
    attempts=$((attempts + 1))
    if (( attempts >= max_attempts )); then
      warn "teleconf-web nao respondeu em ${WEB_URL} (talvez ainda buildando — veja ${WEB_LOG_FILE})"
      break
    fi
    printf "  %s.%s" "${DIM}" "${RESET}"
    sleep 1
  done
  if (( attempts < max_attempts )); then
    printf "\n"
    ok "teleconf-web respondendo em ${WEB_URL} (${attempts}s)"
  fi
fi

# ---------- 4) sumario ----------
printf "\n%s%s✓ Produto de teleconferencia pronto%s\n\n" "${GREEN}" "${BOLD}" "${RESET}"
printf "  %sApp web:%s        %s\n" "${BOLD}" "${RESET}" "${WEB_URL}"
printf "  %sRoom service:%s   %s\n" "${BOLD}" "${RESET}" "${ROOM_SERVICE_URL}"
printf "  %sLiveKit (WS):%s   ws://localhost:7880\n" "${BOLD}" "${RESET}"
printf "\n"
printf "  %sCriar sala de teste:%s make test-rooms\n" "${DIM}" "${RESET}"
printf "  %sTail logs do web:%s    tail -f %s\n" "${DIM}" "${RESET}" "${WEB_LOG_FILE}"
printf "  %sTail logs Docker:%s    make logs\n" "${DIM}" "${RESET}"
printf "  %sDerrubar tudo:%s       make down-product\n\n" "${DIM}" "${RESET}"
