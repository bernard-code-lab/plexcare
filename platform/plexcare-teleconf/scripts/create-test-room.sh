#!/usr/bin/env bash
# create-test-room.sh — cria uma sala de teste via room-service e imprime
# URLs prontas para o browser usando https://meet.livekit.io
#
# Pré-req: docker compose -f docker-compose.dev.yml up -d
# Uso:     ./scripts/create-test-room.sh
#          ./scripts/create-test-room.sh --tenant <uuid>

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080}"
LIVEKIT_WS="${LIVEKIT_WS:-ws://localhost:7880}"

TENANT_ID="${TENANT_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"
if [[ "${1:-}" == "--tenant" ]] && [[ -n "${2:-}" ]]; then
  TENANT_ID="$2"
fi

APPOINTMENT="appt-$(date +%s)"
DOCTOR_ID="doctor_$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8)"
PATIENT_ID="patient_$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8)"

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
echo "Abra cada URL em uma janela/aba DIFERENTE do browser:"
echo "============================================================"
echo ""
echo "🩺 MÉDICO ($DOCTOR_ID):"
echo "https://meet.livekit.io/custom?liveKitUrl=$LIVEKIT_WS&token=$HOST_TOKEN"
echo ""
echo "👤 PACIENTE ($PATIENT_ID):"
echo "https://meet.livekit.io/custom?liveKitUrl=$LIVEKIT_WS&token=$GUEST_TOKEN"
echo ""
echo "============================================================"
echo "Quando ambos entrarem, observe:"
echo "  - Kafka UI:    http://localhost:8090  (topic: room.events)"
echo "  - usage-metering logs: docker compose logs -f usage-metering"
echo "  - Postgres:    docker exec plexcare-platform-dev-postgres-1 \\"
echo "                   psql -U plexcare -d plexcare_dev \\"
echo "                   -c 'SELECT * FROM participant_sessions ORDER BY joined_at DESC LIMIT 5;'"
echo "============================================================"
