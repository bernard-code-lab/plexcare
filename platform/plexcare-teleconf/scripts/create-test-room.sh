#!/usr/bin/env bash
# create-test-room.sh — cria uma sala de teste via room-service e imprime
# URLs prontas para o sandbox local em site/ (rota #/sandbox/room).
#
# Pré-req:
#   1. Backend:  docker compose -f docker-compose.dev.yml up -d
#   2. Frontend: cd ../../site && npm run dev   (http://localhost:5173)
#
# Uso:     ./scripts/create-test-room.sh
#          ./scripts/create-test-room.sh --tenant <uuid>
#
# Por que NÃO usamos https://meet.livekit.io:
#   1. Página HTTPS bloqueia ws:// localhost (mixed content) em alguns browsers.
#   2. Erro de hidratação React (#418) mata os onClick — botões de mic/cam não
#      respondem. O sandbox local é Vite dev (CSR puro) e não tem o problema.

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080}"
LIVEKIT_WS="${LIVEKIT_WS:-ws://localhost:7880}"
SITE_BASE="${SITE_BASE:-http://localhost:5173}"

TENANT_ID="${TENANT_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"
if [[ "${1:-}" == "--tenant" ]] && [[ -n "${2:-}" ]]; then
  TENANT_ID="$2"
fi

APPOINTMENT="appt-$(date +%s)"
DOCTOR_ID="doctor_$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8)"
PATIENT_ID="patient_$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8)"

# Pre-flight: confirma que backend e frontend estao no ar antes de gerar a sala.
if ! curl -sf -o /dev/null "$API_BASE/health"; then
  echo "ERRO: room-service nao responde em $API_BASE/health" >&2
  echo "      Rode: docker compose -f docker-compose.dev.yml up -d" >&2
  exit 1
fi
if ! curl -sf -o /dev/null "$SITE_BASE/"; then
  echo "AVISO: site nao responde em $SITE_BASE — a URL gerada nao vai abrir." >&2
  echo "       Rode em outro terminal: cd ../../site && npm run dev" >&2
  echo "       (continuando mesmo assim, mas voce vai precisar subir antes de usar)" >&2
  echo ""
fi

echo ">>> Criando sala para tenant=$TENANT_ID appt=$APPOINTMENT"

RESPONSE=$(curl -sf -X POST "$API_BASE/api/v1/rooms" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d "{
    \"appointment_id\":\"$APPOINTMENT\",
    \"host_identity\":\"$DOCTOR_ID\",
    \"guest_identity\":\"$PATIENT_ID\",
    \"max_duration_min\":60,
    \"max_participants\":4,
    \"recording\":false
  }")

ROOM_ID=$(echo "$RESPONSE" | jq -r .room_id)
LIVEKIT_NAME=$(echo "$RESPONSE" | jq -r .livekit_name)
HOST_TOKEN=$(echo "$RESPONSE" | jq -r .host_token)
GUEST_TOKEN=$(echo "$RESPONSE" | jq -r .guest_token)
EXPIRES_AT=$(echo "$RESPONSE" | jq -r .expires_at)

echo ""
echo "Room ID:       $ROOM_ID"
echo "LiveKit name:  $LIVEKIT_NAME"
echo "Expira em:     $EXPIRES_AT"
echo ""
echo "============================================================"
echo "Abra cada URL em uma janela/aba DIFERENTE do browser."
echo "Recomendado: navegadores ou perfis distintos (Chrome normal +"
echo "Chrome incognito) para não compartilhar localStorage."
echo "============================================================"
echo ""
echo "Pré-req: site/ rodando em $SITE_BASE (cd ../../site && npm run dev)"
echo ""
echo "MEDICO ($DOCTOR_ID):"
echo "$SITE_BASE/#/sandbox/room?token=$HOST_TOKEN&url=$LIVEKIT_WS"
echo ""
echo "PACIENTE ($PATIENT_ID):"
echo "$SITE_BASE/#/sandbox/room?token=$GUEST_TOKEN&url=$LIVEKIT_WS"
echo ""
echo "============================================================"
echo "Quando ambos entrarem, observe:"
echo "  - Kafka UI:    http://localhost:8090  (topic: room.events)"
echo "  - usage-metering logs: docker compose logs -f usage-metering"
echo "  - Postgres:    docker exec plexcare-platform-dev-postgres-1 \\"
echo "                   psql -U plexcare -d plexcare_dev \\"
echo "                   -c 'SELECT * FROM participant_sessions ORDER BY joined_at DESC LIMIT 5;'"
echo "============================================================"
