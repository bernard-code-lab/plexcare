#!/usr/bin/env bash
# lint-shell.sh — roda shellcheck em todos os .sh do repo (excluindo node_modules).
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

readonly GREEN=$'\033[0;32m'
readonly RED=$'\033[0;31m'
readonly DIM=$'\033[2m'
readonly RESET=$'\033[0m'

if ! command -v shellcheck >/dev/null 2>&1; then
  printf "%s✗%s shellcheck nao encontrado — instale com 'brew install shellcheck'\n" "${RED}" "${RESET}" >&2
  exit 2
fi

# Audita scripts root-level (scripts/) — escopo do Makefile.
# Scripts dentro de .claude/ (hooks user-private) e de platform/**/scripts/
# (cada modulo cuida do proprio lint) ficam fora.
# Bash 3.2 (macOS) compatible — sem mapfile/readarray.
ALL_FILES=()
while IFS= read -r f; do
  [[ -z "${f}" ]] && continue
  ALL_FILES+=("${f}")
done < <(find scripts -type f \( -name "*.sh" -o -name "plexcare" \) -print 2>/dev/null)

if [[ ${#ALL_FILES[@]} -eq 0 ]]; then
  printf "%snenhum shell script encontrado em scripts/%s\n" "${DIM}" "${RESET}"
  exit 0
fi

printf "%sscripts auditados (%d):%s\n" "${DIM}" "${#ALL_FILES[@]}" "${RESET}"
for f in "${ALL_FILES[@]}"; do
  printf "  %s\n" "${f}"
done
printf "\n"

if shellcheck "${ALL_FILES[@]}"; then
  printf "%s✓%s shellcheck: sem issues em %d arquivos\n" "${GREEN}" "${RESET}" "${#ALL_FILES[@]}"
else
  printf "%s✗%s shellcheck: issues encontradas\n" "${RED}" "${RESET}" >&2
  exit 1
fi
