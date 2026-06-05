#!/usr/bin/env bash
# setup.sh — bootstrap idempotente do ambiente de desenvolvimento.
# Instala deps de cada módulo, copia .env de exemplo e gera o cliente Prisma.
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

readonly GREEN=$'\033[0;32m'
readonly YELL=$'\033[0;33m'
readonly CYAN=$'\033[0;36m'
readonly RED=$'\033[0;31m'
readonly RESET=$'\033[0m'

readonly TELECONF_DIR="platform/backend/plexcare-teleconf-service"
readonly IDP_DIR="platform/backend/plexcare-idp-api"
readonly WEB_DIR="platform/frontend/plexcare-teleconf-web"
readonly SITE_DIR="site"

step() {
  printf "\n%s▶%s %s\n" "${CYAN}" "${RESET}" "$1"
}

ok() {
  printf "  %s✓%s %s\n" "${GREEN}" "${RESET}" "$1"
}

warn() {
  printf "  %s!%s %s\n" "${YELL}" "${RESET}" "$1"
}

fail() {
  printf "  %s✗%s %s\n" "${RED}" "${RESET}" "$1" >&2
  exit 1
}

require() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    fail "comando '${cmd}' nao encontrado (instale antes de rodar setup)"
  fi
  ok "${cmd} disponivel"
}

copy_env() {
  local dir="$1"
  if [[ ! -d "${dir}" ]]; then
    warn "diretorio ${dir} ausente — pulando .env"
    return
  fi
  if [[ -f "${dir}/.env.example" ]] && [[ ! -f "${dir}/.env" ]]; then
    cp "${dir}/.env.example" "${dir}/.env"
    ok "${dir}/.env criado (a partir de .env.example)"
  elif [[ -f "${dir}/.env" ]]; then
    ok "${dir}/.env ja existe — preservado"
  else
    warn "${dir}/.env.example nao encontrado"
  fi
}

npm_install_if_needed() {
  local dir="$1"
  if [[ ! -f "${dir}/package.json" ]]; then
    warn "${dir} sem package.json — pulando npm install"
    return
  fi
  if [[ -d "${dir}/node_modules" ]]; then
    ok "${dir}/node_modules presente — pulando (use 'npm install' manual para atualizar)"
    return
  fi
  printf "  installing %s ...\n" "${dir}"
  (cd "${dir}" && npm install --no-audit --no-fund) || fail "npm install falhou em ${dir}"
  ok "${dir} deps instaladas"
}

# ---------- main ----------

step "Verificando ferramentas obrigatorias"
require docker
require node
require npm
require go
if ! command -v shellcheck >/dev/null 2>&1; then
  warn "shellcheck nao encontrado (opcional — instale para rodar 'make lint-sh')"
fi

step "Copiando .env de exemplo (idempotente)"
copy_env "${IDP_DIR}"
copy_env "${WEB_DIR}"
copy_env "${TELECONF_DIR}"

step "Gerando JWKS_KEK_DEV para idp-api se ainda for placeholder"
if [[ -f "${IDP_DIR}/.env" ]] && grep -q 'JWKS_KEK_DEV=replace-with-32-bytes-base64-aqui' "${IDP_DIR}/.env" 2>/dev/null; then
  KEK=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  # Use printf-friendly substitution that works on both BSD and GNU sed.
  tmp=$(mktemp)
  awk -v kek="${KEK}" '/^JWKS_KEK_DEV=/ {print "JWKS_KEK_DEV=" kek; next} {print}' "${IDP_DIR}/.env" > "${tmp}"
  mv "${tmp}" "${IDP_DIR}/.env"
  ok "JWKS_KEK_DEV preenchido com chave 32-byte aleatoria"
else
  ok "JWKS_KEK_DEV ja configurado (ou .env ausente)"
fi

step "Instalando deps Node"
npm_install_if_needed "${SITE_DIR}"
npm_install_if_needed "${WEB_DIR}"
npm_install_if_needed "${IDP_DIR}"

step "Gerando Prisma client (idp-api)"
if [[ -f "${IDP_DIR}/prisma/schema.prisma" ]]; then
  (cd "${IDP_DIR}" && npm run prisma:generate >/dev/null 2>&1) || warn "prisma generate falhou (rode 'cd ${IDP_DIR} && npm run prisma:generate' para ver erro)"
  ok "Prisma client gerado"
else
  warn "prisma/schema.prisma nao encontrado — pulando"
fi

step "Baixando deps Go (teleconf-service)"
if [[ -f "${TELECONF_DIR}/go.mod" ]]; then
  (cd "${TELECONF_DIR}" && go mod download) || warn "go mod download falhou"
  ok "go modules prontos"
else
  warn "${TELECONF_DIR}/go.mod ausente"
fi

printf "\n%s%s✓ Setup completo!%s\n\n" "${GREEN}" "$(tput bold 2>/dev/null || true)" "${RESET}"
printf "Proximos passos:\n"
printf "  %smake up%s         — sobe stack Docker (kafka, postgres, livekit, mysql)\n" "${CYAN}" "${RESET}"
printf "  %smake test-rooms%s — smoke test de criacao de sala virtual\n" "${CYAN}" "${RESET}"
printf "  %smake menu%s       — menu interativo\n" "${CYAN}" "${RESET}"
printf "  %smake help%s       — lista todos os comandos\n\n" "${CYAN}" "${RESET}"
