#!/usr/bin/env bash
# ============================================================================
# configure-providers.sh
# ----------------------------------------------------------------------------
# Aplica/atualiza credenciais OAuth dos Identity Providers no realm `plexcare`
# usando kcadm.sh dentro do container Keycloak. Idempotente: pode rodar várias
# vezes (rotação de secret, troca de cliente Google etc.).
#
# Pré-requisito: containers `plexcare-keycloak` e `plexcare-keycloak-db` rodando
# e o realm `plexcare` já importado.
#
# Uso:
#   ./scripts/configure-providers.sh
#
# Variáveis lidas do .env (carregadas pelo docker compose) já estão presentes
# no ambiente do container `plexcare-keycloak`.
# ============================================================================

set -euo pipefail

CONTAINER="${KC_CONTAINER:-plexcare-keycloak}"
REALM="${KC_REALM:-plexcare}"
KC_URL="${KC_URL:-http://localhost:8080/auth}"

log() { printf '\033[1;36m[configure-providers]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[configure-providers]\033[0m %s\n' "$*" >&2; }

require_env() {
  local missing=()
  for v in "$@"; do
    if ! docker exec "$CONTAINER" printenv "$v" >/dev/null 2>&1; then
      missing+=("$v")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    err "Variáveis faltando no container: ${missing[*]}"
    err "Preencha o .env e rode 'docker compose -f docker-compose.dev.yml up -d'."
    exit 1
  fi
}

kcadm() {
  docker exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh "$@"
}

log "Logando no admin CLI…"
docker exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh config credentials \
  --server "$KC_URL" \
  --realm master \
  --user "$(docker exec "$CONTAINER" printenv KC_BOOTSTRAP_ADMIN_USERNAME)" \
  --password "$(docker exec "$CONTAINER" printenv KC_BOOTSTRAP_ADMIN_PASSWORD)" \
  >/dev/null

# ----------------------------------------------------------------------------
# Helper: upsert de identity provider
# ----------------------------------------------------------------------------
upsert_idp() {
  local alias="$1" json="$2"
  log "Upsert IdP: $alias"
  if kcadm get "identity-provider/instances/$alias" -r "$REALM" >/dev/null 2>&1; then
    echo "$json" | kcadm update "identity-provider/instances/$alias" -r "$REALM" -f -
  else
    echo "$json" | kcadm create "identity-provider/instances" -r "$REALM" -f -
  fi
}

# ----------------------------------------------------------------------------
# Google
# ----------------------------------------------------------------------------
if [[ -n "$(docker exec "$CONTAINER" printenv GOOGLE_CLIENT_ID 2>/dev/null)" ]]; then
  GCID=$(docker exec "$CONTAINER" printenv GOOGLE_CLIENT_ID)
  GCSEC=$(docker exec "$CONTAINER" printenv GOOGLE_CLIENT_SECRET)
  upsert_idp google "$(cat <<EOF
{
  "alias": "google",
  "displayName": "Google",
  "providerId": "google",
  "enabled": true,
  "trustEmail": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "$GCID",
    "clientSecret": "$GCSEC",
    "syncMode": "IMPORT",
    "defaultScope": "openid profile email https://www.googleapis.com/auth/calendar.readonly",
    "useJwksUrl": "true"
  }
}
EOF
)"
else
  log "GOOGLE_CLIENT_ID vazio — pulando Google."
fi

# ----------------------------------------------------------------------------
# Apple
# ----------------------------------------------------------------------------
if [[ -n "$(docker exec "$CONTAINER" printenv APPLE_CLIENT_ID 2>/dev/null)" ]]; then
  ACID=$(docker exec "$CONTAINER" printenv APPLE_CLIENT_ID)
  ACSEC=$(docker exec "$CONTAINER" printenv APPLE_CLIENT_SECRET)
  ATID=$(docker exec "$CONTAINER" printenv APPLE_TEAM_ID)
  AKID=$(docker exec "$CONTAINER" printenv APPLE_KEY_ID)
  upsert_idp apple "$(cat <<EOF
{
  "alias": "apple",
  "displayName": "Apple",
  "providerId": "apple",
  "enabled": true,
  "trustEmail": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "$ACID",
    "clientSecret": "$ACSEC",
    "teamId": "$ATID",
    "keyId": "$AKID",
    "syncMode": "IMPORT",
    "defaultScope": "openid name email"
  }
}
EOF
)"
else
  log "APPLE_CLIENT_ID vazio — pulando Apple."
fi

# ----------------------------------------------------------------------------
# Facebook (Meta) — caminho oficial p/ "WhatsApp social login" via ecossistema
# ----------------------------------------------------------------------------
if [[ -n "$(docker exec "$CONTAINER" printenv FACEBOOK_CLIENT_ID 2>/dev/null)" ]]; then
  FCID=$(docker exec "$CONTAINER" printenv FACEBOOK_CLIENT_ID)
  FCSEC=$(docker exec "$CONTAINER" printenv FACEBOOK_CLIENT_SECRET)
  upsert_idp facebook "$(cat <<EOF
{
  "alias": "facebook",
  "displayName": "Facebook / Meta",
  "providerId": "facebook",
  "enabled": true,
  "trustEmail": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "$FCID",
    "clientSecret": "$FCSEC",
    "syncMode": "IMPORT",
    "defaultScope": "email public_profile"
  }
}
EOF
)"
else
  log "FACEBOOK_CLIENT_ID vazio — pulando Facebook/Meta."
fi

log "Pronto. Verifique no console: $KC_URL/admin/master/console/#/$REALM/identity-providers"
