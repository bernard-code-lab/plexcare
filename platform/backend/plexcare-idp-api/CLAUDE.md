# plexcare-idp-api — Module Context

> Authorization Server REST (NestJS + Prisma + MySQL) — emite JWT próprio Ed25519 com claims `account_id/roles`. Keycloak fica oculto atrás dele (Direct Grant para senha).

## Antes de explorar o código — load-bearing files

Leia nesta ordem se está chegando agora:

1. [`src/main.ts`](./src/main.ts) — bootstrap Fastify + helmet + CORS
2. [`src/app.module.ts`](./src/app.module.ts) — wiring dos módulos
3. [`prisma/schema.prisma`](./prisma/schema.prisma) — modelo de dados (idp_user, idp_user_role, idp_session, idp_signing_key, idp_client, outbox, authorize_state)
4. `src/shared/crypto/` — JwtSigner Ed25519 + KeyLoader rotacionável
5. `src/shared/auth/` — JwtAuthGuard + decorators
6. `src/modules/authorize/` — `POST /v1/auth/login` (PKCE state)
7. `src/modules/token/` — `POST /v1/token` (code → JWT), `/refresh` (rotação + reuse detection), `/revoke`
8. `src/modules/auth/` — signup, forgot, reset, change-password, email/verify
9. `src/modules/me/` — `/v1/me`, `/me/roles`, `/me/sessions`, `/me/switch-account`
10. `src/modules/outbox/` — outbox service + worker poll → Kafka
11. [`openapi.yaml`](./openapi.yaml) — contrato (gerado e versionado)

## Gotchas

- **DATABASE_URL é a única fonte de verdade de conexão** — nada hardcoded. Em CI/cloud, reescreva a env, **não** o `docker-compose.dev.yml`.
- **JWKS KEK por gate `JWKS_KEK_PROVIDER`**: `env` (dev) ou `kms` (prod). Boot **falha-fast** se `NODE_ENV=production && provider=env`.
- **Senha never-touch**: `KeycloakService.directGrant` é o único lugar que toca senha; nunca persistimos, nunca logamos (pino redaction obrigatório).
- **Refresh rotação + reuse detection** (OAuth 2.1 §6.1): qualquer refresh já rotacionado invalida **toda a família** de sessões do mesmo usuário/client.
- **PKCE state single-use**: `consumeState` usa `SELECT FOR UPDATE` + DELETE atômico — protege contra race.
- **Outbox transacional**: `OutboxService.publish(tx, evt)` participa da TX de negócio. Worker drena com `FOR UPDATE SKIP LOCKED` e marca `published_at`.
- **Lockout**: chaves `email:<x>` e `ip:<x>` independentes. Janela 5min, threshold 5, bloqueio 15min — parametrizado por env.
- **Cron lock distribuído**: `idp_cron_lock` (`SELECT FOR UPDATE`) evita duplicação quando replicas > 1 (sem dependência de Redis no MVP).
- **`tenantid`** no envelope CloudEvents é `account_id` — partition key Kafka é `idp_user_id` para ordenação por usuário.
- **Tabelas pré-existentes em `db_plexcare_tenancy`** (`idp_user`, `authorize_state`, `outbox`, `lockout`, `account`, `customer`, etc.) são apenas mapeadas no Prisma — as 6 novas (`idp_user_role`, `idp_session`, `idp_signing_key`, `idp_client`, `idp_cron_lock`, `idp_idempotency`) vêm via migration.

## Compliance

- LGPD: PII em logs com hash (`email → sha256[0:16]`); audit trail via outbox.
- OWASP ASVS L1: senha ≥ 12 chars validada backend-side; nunca confiar só na UI.
- Resposta neutra em `/auth/forgot-password` (não enumera contas) — timing budget 300ms.
- Multi-tenancy: todo claim do JWT carrega `account_id`; serviços downstream validam offline via JWKS.

## Convenções

- TDD obrigatório (D8 do discovery) nas regras: PKCE, lockout, JWT issuance/verify, refresh rotation, session reuse detection.
- Cobertura ≥ 90% em `auth/`, `authorize/`, `token/`, `shared/crypto/`.
- Erros via `AppException` mapeados para RFC 7807 (`application/problem+json`).
- Validação de DTOs com Zod; OpenAPI gerada via `zod-to-openapi`.

## Comandos úteis

```bash
docker compose -f docker-compose.dev.yml up -d
npm install
npm run prisma:migrate
npm run dev
npm test
npm run test:e2e
```
