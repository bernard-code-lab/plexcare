#!/usr/bin/env bash
# doctor.sh — diagnostica o ambiente: ferramentas, versoes, portas em uso.
set -Eeuo pipefail

readonly GREEN=$'\033[0;32m'
readonly YELL=$'\033[0;33m'
readonly RED=$'\033[0;31m'
readonly CYAN=$'\033[0;36m'
readonly BOLD=$'\033[1m'
readonly RESET=$'\033[0m'

check_cmd() {
  local cmd="$1"
  local minver="${2:-}"
  if command -v "${cmd}" >/dev/null 2>&1; then
    local ver
    ver=$("${cmd}" --version 2>&1 | head -1 || echo "?")
    printf "  %s✓%s %-10s %s\n" "${GREEN}" "${RESET}" "${cmd}" "${ver}"
  else
    printf "  %s✗%s %-10s %s(nao encontrado%s)\n" "${RED}" "${RESET}" "${cmd}" "${RED}" "${minver:+, requer ${minver}}${RESET}"
  fi
}

check_port() {
  local port="$1"
  local label="$2"
  if lsof -i ":${port}" -sTCP:LISTEN -t >/dev/null 2>&1; then
    local pid proc
    pid=$(lsof -i ":${port}" -sTCP:LISTEN -t | head -1)
    proc=$(ps -o command= -p "${pid}" 2>/dev/null | head -1 | cut -c1-50 || echo "?")
    printf "  %s●%s %-6s %-22s pid=%s %s\n" "${YELL}" "${RESET}" "${port}" "${label}" "${pid}" "${proc}"
  else
    printf "  %s○%s %-6s %s(livre)%s\n" "${GREEN}" "${RESET}" "${port}" "${CYAN}" "${RESET}"
  fi
}

printf "\n%s%sFerramentas%s\n" "${BOLD}" "${CYAN}" "${RESET}"
check_cmd docker
check_cmd node "v20+"
check_cmd npm
check_cmd go "1.26+"
check_cmd shellcheck
check_cmd jq
check_cmd curl
check_cmd uuidgen
check_cmd openssl

printf "\n%s%sDocker daemon%s\n" "${BOLD}" "${CYAN}" "${RESET}"
if docker info >/dev/null 2>&1; then
  printf "  %s✓%s daemon respondendo\n" "${GREEN}" "${RESET}"
  printf "  %s%s\n" "${CYAN}" "${RESET}"
  docker ps --filter "name=plexcare" --format "    {{.Names}}\t{{.Status}}" 2>/dev/null || true
else
  printf "  %s✗%s docker daemon nao acessivel\n" "${RED}" "${RESET}"
fi

printf "\n%s%sPortas usadas pelo PlexCare%s\n" "${BOLD}" "${CYAN}" "${RESET}"
check_port 5173  "site"
check_port 5174  "teleconf-web"
check_port 5175  "login-web"
check_port 4000  "idp-api"
check_port 8080  "room-service"
check_port 3307  "mysql (idp)"
check_port 5432  "postgres (teleconf)"
check_port 6379  "redis"
check_port 7880  "livekit"
check_port 9092  "kafka"
check_port 29092 "kafka (host)"
check_port 8025  "mailhog UI"
check_port 8088  "keycloak"
check_port 8090  "kafka UI"

printf "\n"
