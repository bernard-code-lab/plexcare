#!/usr/bin/env bash
# down-product.sh — derruba tudo subido por up-product.sh:
#   - mata o teleconf-web background (via PID file)
#   - docker compose down da stack teleconf
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

readonly GREEN=$'\033[0;32m'
readonly YELL=$'\033[0;33m'
readonly CYAN=$'\033[0;36m'
readonly DIM=$'\033[2m'
readonly RESET=$'\033[0m'

readonly TELECONF_DIR="platform/backend/plexcare-teleconf-service"
readonly TMP_DIR="${REPO_ROOT}/tmp"
readonly WEB_PID_FILE="${TMP_DIR}/teleconf-web.pid"
readonly COMPOSE_PROJECT="${COMPOSE_PROJECT:-plexcare-platform-dev}"

step()  { printf "\n%s▶%s %s\n" "${CYAN}" "${RESET}" "$1"; }
ok()    { printf "  %s✓%s %s\n" "${GREEN}" "${RESET}" "$1"; }
warn()  { printf "  %s!%s %s\n" "${YELL}" "${RESET}" "$1"; }

step "Parando teleconf-web (background)"
if [[ -f "${WEB_PID_FILE}" ]]; then
  pid="$(cat "${WEB_PID_FILE}")"
  if kill -0 "${pid}" 2>/dev/null; then
    # Mata o grupo inteiro (npm + vite + esbuild).
    pgid="$(ps -o pgid= -p "${pid}" 2>/dev/null | tr -d ' ' || echo "${pid}")"
    if [[ -n "${pgid}" ]] && kill -TERM -- "-${pgid}" 2>/dev/null; then
      ok "process group ${pgid} sinalizado (TERM)"
    else
      kill -TERM "${pid}" 2>/dev/null || true
      ok "pid ${pid} sinalizado (TERM)"
    fi
    sleep 1
    if kill -0 "${pid}" 2>/dev/null; then
      kill -KILL "${pid}" 2>/dev/null || true
      warn "pid ${pid} sobreviveu — forcei KILL"
    fi
  else
    warn "PID ${pid} ja nao existe"
  fi
  rm -f "${WEB_PID_FILE}"
else
  printf "  %s(nada para parar — sem PID file em %s)%s\n" "${DIM}" "${WEB_PID_FILE}" "${RESET}"
fi

step "Docker compose down (preserva volumes)"
docker compose -f "${TELECONF_DIR}/docker-compose.dev.yml" -p "${COMPOSE_PROJECT}" down >/dev/null
ok "stack docker derrubada"

printf "\n%s✓ Produto de teleconferencia derrubado%s\n\n" "${GREEN}" "${RESET}"
