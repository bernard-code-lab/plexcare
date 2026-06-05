#!/usr/bin/env bash
# test-rooms.sh — smoke test da feature "sala virtual" do PlexCare.
#
# Sem args: cria 1 sala via room-service e imprime URL pronta para abrir no
#           teleconf-web (porta 5174).
# --flow:   roda fluxo completo (create + list + verify health) sem UI.
#
# Pre-req: `make up` (stack teleconf rodando — postgres, kafka, livekit, room-service).
set -Eeuo pipefail

readonly GREEN=$'\033[0;32m'
readonly YELL=$'\033[0;33m'
readonly CYAN=$'\033[0;36m'
readonly RED=$'\033[0;31m'
readonly BOLD=$'\033[1m'
readonly DIM=$'\033[2m'
readonly RESET=$'\033[0m'

API_BASE="${API_BASE:-http://localhost:8080}"
WEB_BASE="${WEB_BASE:-http://localhost:5174}"
LIVEKIT_WS="${LIVEKIT_WS:-ws://localhost:7880}"
MODE="ui"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --flow) MODE="flow"; shift ;;
    --tenant) shift; TENANT_ID="${1:-}"; shift ;;
    -h|--help)
      cat <<EOF
Uso: $(basename "$0") [opcoes]

Opcoes:
  --flow            Roda create + list + health (sem abrir UI)
  --tenant <uuid>   Usa tenant especifico (default: aleatorio)
  -h, --help        Mostra esta ajuda

Variaveis de ambiente:
  API_BASE     URL do room-service (default ${API_BASE})
  WEB_BASE     URL do teleconf-web (default ${WEB_BASE})
EOF
      exit 0
      ;;
    *) printf "%sopcao desconhecida: %s%s\n" "${RED}" "$1" "${RESET}" >&2; exit 2 ;;
  esac
done

# ---------- helpers ----------
die() {
  printf "%s✗ %s%s\n" "${RED}" "$1" "${RESET}" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "comando '$1' nao encontrado (instale antes)"
}

require_cmd curl
require_cmd uuidgen
require_cmd jq

TENANT_ID="${TENANT_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"
APPOINTMENT="appt-$(date +%s)"
DOCTOR_ID="doctor-$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8)"
PATIENT_ID="patient-$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8)"

# ---------- pre-flight ----------
printf "\n%s%s▶ Pre-flight%s\n" "${BOLD}" "${CYAN}" "${RESET}"
if ! curl -sf -o /dev/null "${API_BASE}/health"; then
  printf "%s✗%s room-service nao responde em %s/health\n" "${RED}" "${RESET}" "${API_BASE}"
  printf "  %sRode: %smake up%s\n\n" "${DIM}" "${BOLD}" "${RESET}"
  exit 1
fi
printf "  %s✓%s room-service OK em %s\n" "${GREEN}" "${RESET}" "${API_BASE}"

# ---------- create room ----------
printf "\n%s%s▶ Criando sala%s\n" "${BOLD}" "${CYAN}" "${RESET}"
printf "  tenant_id   = %s\n" "${TENANT_ID}"
printf "  appointment = %s\n" "${APPOINTMENT}"
printf "  doctor      = %s\n" "${DOCTOR_ID}"
printf "  patient     = %s\n\n" "${PATIENT_ID}"

PAYLOAD=$(cat <<EOF
{
  "appointment_id": "${APPOINTMENT}",
  "host_identity": "${DOCTOR_ID}",
  "guest_identity": "${PATIENT_ID}",
  "max_duration_min": 60,
  "max_participants": 2,
  "recording": false
}
EOF
)

RESPONSE=$(curl -sf -X POST "${API_BASE}/api/v1/rooms" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -d "${PAYLOAD}") || die "POST /api/v1/rooms falhou (verifique logs: make logs)"

ROOM_ID=$(echo "${RESPONSE}" | jq -r '.room_id')
LIVEKIT_NAME=$(echo "${RESPONSE}" | jq -r '.livekit_name')
HOST_TOKEN=$(echo "${RESPONSE}" | jq -r '.host_token')
GUEST_TOKEN=$(echo "${RESPONSE}" | jq -r '.guest_token')
EXPIRES_AT=$(echo "${RESPONSE}" | jq -r '.expires_at')

printf "  %s✓%s sala criada\n" "${GREEN}" "${RESET}"
printf "    room_id      = %s\n" "${ROOM_ID}"
printf "    livekit_name = %s\n" "${LIVEKIT_NAME}"
printf "    expires_at   = %s\n" "${EXPIRES_AT}"

# ---------- flow mode: list + verify ----------
if [[ "${MODE}" == "flow" ]]; then
  printf "\n%s%s▶ Listando salas do tenant%s\n" "${BOLD}" "${CYAN}" "${RESET}"
  LIST=$(curl -sf "${API_BASE}/api/v1/rooms?limit=10" -H "X-Tenant-Id: ${TENANT_ID}") || die "GET /api/v1/rooms falhou"
  COUNT=$(echo "${LIST}" | jq -r '.rooms | length' 2>/dev/null || echo "?")
  printf "  %s✓%s %s salas retornadas\n" "${GREEN}" "${RESET}" "${COUNT}"

  printf "\n%s%s▶ Verificando que a sala recem-criada esta na lista%s\n" "${BOLD}" "${CYAN}" "${RESET}"
  # GET /rooms expoe o id da entidade como `id` (POST devolve `room_id`).
  if echo "${LIST}" | jq -e --arg id "${ROOM_ID}" '.rooms[] | select(.id == $id)' >/dev/null 2>&1; then
    printf "  %s✓%s sala %s encontrada\n" "${GREEN}" "${RESET}" "${ROOM_ID}"
  else
    die "sala criada nao aparece em GET /api/v1/rooms (resposta: $(echo "${LIST}" | head -c 200))"
  fi

  printf "\n%s%s✓ Smoke E2E concluido com sucesso%s\n\n" "${GREEN}" "${BOLD}" "${RESET}"
  exit 0
fi

# ---------- ui mode: gera URL para o teleconf-web ----------
printf "\n%s%s▶ URLs prontas%s\n" "${BOLD}" "${CYAN}" "${RESET}"

if ! curl -sf -o /dev/null "${WEB_BASE}/"; then
  printf "  %s!%s teleconf-web nao responde em %s — suba com: %smake dev-web%s\n" "${YELL}" "${RESET}" "${WEB_BASE}" "${BOLD}" "${RESET}"
  printf "    (mostrando URLs mesmo assim)\n\n"
fi

# Codifica tokens para URL.
HOST_URL="${WEB_BASE}/#/room/${LIVEKIT_NAME}?token=${HOST_TOKEN}&role=doctor"
GUEST_URL="${WEB_BASE}/#/room/${LIVEKIT_NAME}?token=${GUEST_TOKEN}&role=patient"

printf "  %sDoctor (host):%s\n  %s\n\n" "${BOLD}" "${RESET}" "${HOST_URL}"
printf "  %sPatient (guest):%s\n  %s\n\n" "${BOLD}" "${RESET}" "${GUEST_URL}"

printf "%sDica:%s abra as duas URLs em janelas anonimas diferentes para simular duas pessoas.\n" "${DIM}" "${RESET}"
printf "%sLiveKit WS:%s %s\n\n" "${DIM}" "${RESET}" "${LIVEKIT_WS}"

# Auto-open no host (best-effort).
if command -v open >/dev/null 2>&1; then
  open "${HOST_URL}" 2>/dev/null || true
fi
