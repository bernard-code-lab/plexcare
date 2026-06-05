# plexcare-idp-api — Implementation Spec

> **For agentic workers:** Esta spec é executável em sequência. Cada **Etapa** vira **um commit pequeno**. Use `/tdd` para as etapas marcadas com 🔴 (regra de segurança ou contrato testado primeiro). Use `superpowers:subagent-driven-development` ou `superpowers:executing-plans` para conduzir a execução. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Construir o `plexcare-idp-api` — Authorization Server REST (NestJS 10 + Prisma + MySQL 8) que valida senha no Keycloak via Direct Grant, emite JWT Ed25519 próprio com claims `account_id/roles`, persiste sessões refresh-rotacionáveis e publica eventos via outbox→Kafka, conforme [discovery](idp-api-discovery.md) e [blueprint](idp-api-blueprint.md).

**Architecture:** NestJS modular "hexagonal-lite" — cada módulo tem `domain/` (entidades + value objects + erros), `application/` (use cases/services), `infrastructure/` (Prisma repos, HTTP adapters), `http/` (controllers + DTOs Zod). Outbox transacional drenada por worker poll. JWKS Ed25519 rotacionável.

**Tech Stack:** NestJS 10 (Fastify adapter), Prisma 5, MySQL 8, `jose` (Ed25519), `kafkajs`, `pino`, `zod` + `zod-to-openapi`, `helmet`, OpenTelemetry, Jest + Testcontainers, Vitest opcional para unit puros.

**Repositório:** `platform/backend/plexcare-idp-api/` (diretório vazio hoje).

**Branch:** criar `feat/idp-api` a partir de `main`.

---

## Goals & non-goals

### Goals

1. Endpoints REST OIDC-like: `/v1/auth/{signup,login,forgot,reset,change-password,email/verify}`, `/v1/token`, `/v1/token/refresh`, `/v1/token/revoke`, `/v1/me{,/roles,/sessions,/switch-account}`, `/.well-known/{jwks.json,openid-configuration}`, `/health`, `/ready`.
2. JWT Ed25519 com claims `sub, iss, aud, exp, iat, jti, client_id, account_id, account_customer_id, active_role, roles[], doctor_id?, client_id_party?, employee_id?, email, email_verified, locale`.
3. Refresh opaco em `idp_session` com rotação + detecção de reuso (OAuth 2.1 §6.1).
4. Outbox transacional → Kafka (CloudEvents 1.0) para os tópicos `idp.user.v1`, `idp.session.v1`, `idp.role.v1`.
5. Lockout anti-bruteforce em `lockout` (email + IP, 5 falhas / 5 min → bloqueia 15 min).
6. JWKS rotacionável (cron mensal, KMS para KEK em prod).
7. Cobertura ≥ 90% em `auth/`, `authorize/`, `token/` (TDD obrigatório nas regras de segurança — D8 do discovery).
8. OpenAPI 3.1 servido por `/openapi.json` e arquivo versionado em `openapi.yaml`.
9. Observabilidade: traces OTel (HTTP, Prisma, KafkaJS, axios), métricas Prometheus, logs pino estruturados.

### Non-goals (explícitos)

- **MFA** (TOTP/WebAuthn) — EXT-1 do blueprint, fora desta versão.
- **Social login** (Google/Apple callback) — EXT-2, fora desta versão.
- **Introspect endpoint** (RFC 7662) — EXT-5, fora desta versão.
- **mTLS client confidential** — EXT-3, fora.
- **Device authorization grant** — EXT-6, fora.
- **`plexcare-platform-web`** — não é dependência bloqueante; idp-api deve subir e ser testável e2e sem ela. O bridge cookie apex será **documentado** mas a SPA fica para release separada.
- **Migrar bancos de outros módulos para MySQL** — `teleconf-service` continua em PostgreSQL.

---

## Data model changes

Todas as alterações vão para `platform/database/db_plexcare_tenancy.sql` **e** Prisma `schema.prisma`. Não há tabela existente sendo dropada nem coluna existente sendo renomeada — apenas tabelas novas + 1 índice novo.

### Novas tabelas

| Tabela | Propósito | DDL referência |
|---|---|---|
| `idp_user_role` | Multi-papel por usuário (doctor/employee/client/admin) por account | Discovery §"Modelo de dados — delta proposto" |
| `idp_session` | Refresh token opaco (UUID v4) com TTL, rotação, revogação | Discovery §"Modelo de dados — delta proposto" |
| `idp_signing_key` | Rotação JWKS Ed25519 (kid, public/private encrypted, status) | Discovery §"Modelo de dados — delta proposto" |
| `idp_client` | OIDC clients registrados (`plexcare-platform-web`, etc.) + TTLs + redirect_uris | Blueprint §4.5 |
| `idp_cron_lock` | Lock distribuído MySQL para os jobs cron (substitui Redis no MVP) | Blueprint §4.5 |
| `idp_idempotency` | Cache de resposta para `Idempotency-Key` em writes | Blueprint §4.5 |

### Índices adicionais

- `idp_user_role`: `UNIQUE (idp_user_id, account_id, role)`, `(account_id, account_customer_id)` (FK composta).
- `idp_session`: `(idp_user_id)`, `(expires_at)` (para purge), `(revoked_at)` (opcional, para queries de "sessions ativas").
- `idp_signing_key`: `(status)`.
- `idp_cron_lock`: PK em `name`.
- `idp_idempotency`: PK composta `(key, route)`, `(expires_at)` para purge.

### Migrações

- **Estratégia:** Prisma Migrate em modo `migrate dev` em dev/CI; **estratégia de prod fica em aberto** — ainda não há cloud-target definido (AWS/Azure/DO), então o spec não trava decisão. Quando houver target, abrir ADR específica.
- Cada tabela nova vira **uma migration separada** (`20260604_xxxx_add_idp_user_role.sql`, etc.) para permitir rollback granular.
- Schema legado `db_plexcare_tenancy.sql` é mantido como **fonte de verdade documental** — atualizamos com os mesmos DDLs após cada migration aplicada (commit junto).
- **Conexão DB totalmente parametrizada via `DATABASE_URL`** — host/porta/usuário/senha/db NUNCA hardcoded; em dev local o default aponta para `mysql://...@localhost:3307/db_plexcare_tenancy` (compose), mas qualquer ambiente (CI, cloud) reescreve via env.

### Seeds dev

- 1 linha em `idp_client` com `client_id='plexcare-platform-web'`, `redirect_uris=['http://localhost:5176/callback']`, TTLs default.
- 1 linha em `idp_client` com `client_id='plexcare-login-web'` (o próprio login-web também consome `/auth/*`).
- 1 par Ed25519 inicial em `idp_signing_key` (kid=`dev-2026-06-01`, status=`active`, `private_jwk_encrypted` cifrada com KEK lida de `JWKS_KEK_DEV` em `.env`).

---

## Etapas implementáveis (em ordem)

Cada etapa = **um commit pequeno**. Mensagens seguem Conventional Commits, em pt-BR no corpo. Commits incluem migration + código + teste juntos quando a unidade lógica exige.

> **Convenção paths:** todos relativos a `platform/backend/plexcare-idp-api/` salvo indicação contrária.

> **Convenção testes:** TDD estrito (🔴 = red, 🟢 = green, 🔵 = refactor) nas etapas marcadas. Outras etapas escrevem teste depois ou inline conforme natureza (configuração, scaffolding).

---

### Etapa 1 — Scaffold NestJS 10 + Fastify + Prisma + ferramentas

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.eslintrc.cjs`, `.prettierrc`, `jest.config.ts`, `.gitignore`, `README.md`
- Create: `src/main.ts`, `src/app.module.ts`
- Create: `prisma/schema.prisma` (base, sem modelos)
- Create: `.env.example` (placeholders)
- Create: `Dockerfile`, `docker-compose.dev.yml` (mysql8 + mailhog)
- Create: `CLAUDE.md` (load-bearing files do módulo)

- [ ] **Step 1: Criar `package.json`** com deps fixadas

Versões mínimas: `@nestjs/core@^10`, `@nestjs/common@^10`, `@nestjs/platform-fastify@^10`, `@nestjs/config@^3`, `prisma@^5`, `@prisma/client@^5`, `zod@^3.23`, `@asteasolutions/zod-to-openapi@^7`, `jose@^5`, `kafkajs@^2.2`, `pino@^9`, `nestjs-pino@^4`, `helmet@^7`, `@nestjs/swagger@^7`, `axios@^1.7`, `argon2@^0.40`, `@opentelemetry/sdk-node@^0.52`, `@opentelemetry/auto-instrumentations-node@^0.49`, `prom-client@^15`.
Dev: `@nestjs/cli`, `@nestjs/testing`, `jest@^29`, `ts-jest`, `supertest`, `testcontainers@^10`, `@testcontainers/mysql`, `@testcontainers/kafka`, `typescript@^5.4`, `eslint`, `prettier`.

Scripts: `dev`, `build`, `start`, `test`, `test:e2e`, `prisma:generate`, `prisma:migrate`, `prisma:studio`, `lint`, `typecheck`.

- [ ] **Step 2: `tsconfig.json`** estrito

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Step 3: `src/main.ts`** bootstrap com Fastify + helmet + pino + global pipes

```ts
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  await app.register(import('@fastify/helmet'));
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalInterceptors(new OtelTracingInterceptor());
  app.enableCors({ origin: env.CORS_ALLOWED_ORIGINS, credentials: true });
  await app.listen(env.PORT, '0.0.0.0');
}
```

- [ ] **Step 4: `prisma/schema.prisma`** datasource + generator (sem modelos ainda)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "mysql"; url = env("DATABASE_URL") }
```

- [ ] **Step 5: `.env.example`** com todas as envs documentadas

```env
PORT=4000
NODE_ENV=development

# DATABASE — totalmente parametrizado; default aponta para o compose local na porta 3307.
# Em cloud, reescrever para o endpoint gerenciado correspondente.
DATABASE_URL=mysql://plexcare:plexcare@localhost:3307/db_plexcare_tenancy

# KEYCLOAK
KEYCLOAK_BASE_URL=http://localhost:8088
KEYCLOAK_REALM=plexcare
KEYCLOAK_ADMIN_CLIENT_ID=idp-api-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=changeme

# KAFKA
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=plexcare-idp-api

# SMTP
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@plexcare.com.br

# JWKS — em dev usa KEK de env; em prod usa adapter KMS (ver gate abaixo).
JWKS_KEK_PROVIDER=env              # env | kms
JWKS_KEK_DEV=base64-32bytes-aqui   # usado quando JWKS_KEK_PROVIDER=env
JWKS_KMS_KEY_ID=                   # usado quando JWKS_KEK_PROVIDER=kms (placeholder)

ISSUER_URL=http://localhost:4000
CORS_ALLOWED_ORIGINS=http://localhost:5175,http://localhost:5176

# TTLs
PKCE_STATE_TTL_SECONDS=300
RESET_TOKEN_TTL_SECONDS=1800
EMAIL_VERIFY_TTL_SECONDS=86400
IDEMPOTENCY_TTL_SECONDS=900

# LOCKOUT
LOCKOUT_WINDOW_SECONDS=300
LOCKOUT_THRESHOLD=5
LOCKOUT_BLOCK_SECONDS=900

# OBSERVABILIDADE
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
LOG_LEVEL=info
```

- [ ] **Step 6: `docker-compose.dev.yml`** com `mysql:8.0` (porta `3307` no host, parametrizável via `MYSQL_HOST_PORT` no compose), `mailhog:1025/8025`

(Reaproveita Keycloak/Kafka da stack existente em `platform/plexcare-teleconf-service/docker-compose.dev.yml` — documentar no README a dependência da outra stack subindo primeiro.)

> **Nota:** o compose é só **conveniência local**. O app não depende dele — qualquer MySQL acessível via `DATABASE_URL` funciona (CI usa Testcontainers; cloud futuro usa endpoint gerenciado).

- [ ] **Step 7: `Dockerfile`** multi-stage Node 22-alpine, copy dist, run as non-root, healthcheck `/health`

- [ ] **Step 8: `CLAUDE.md`** do módulo (load-bearing: `src/main.ts`, `prisma/schema.prisma`, `src/modules/token`, `src/modules/authorize`, `src/shared/crypto`, `openapi.yaml`)

- [ ] **Step 9: Smoke test** — `npm install && npm run build && npm test -- --passWithNoTests`

- [ ] **Step 10: Commit**

```bash
git checkout -b feat/idp-api
git add platform/backend/plexcare-idp-api/
git commit -m "feat(idp-api): scaffold NestJS + Prisma + Fastify

Esqueleto mínimo do plexcare-idp-api. Sem modelos nem endpoints —
ferramentas, configs e bootstrap apenas. Próximas etapas adicionam
schema, módulos e contratos."
```

**Critérios de aceite:**
- `npm run build` passa sem erro
- `npm test` passa (0 testes, exit 0)
- `docker compose -f docker-compose.dev.yml up -d` sobe mysql + mailhog
- `curl http://localhost:4000/` retorna 404 (app responde)

---

### Etapa 2 — Schema Prisma + migrations das 6 novas tabelas

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260604000001_add_idp_user_role/migration.sql`
- Create: `prisma/migrations/20260604000002_add_idp_session/migration.sql`
- Create: `prisma/migrations/20260604000003_add_idp_signing_key/migration.sql`
- Create: `prisma/migrations/20260604000004_add_idp_client/migration.sql`
- Create: `prisma/migrations/20260604000005_add_idp_cron_lock/migration.sql`
- Create: `prisma/migrations/20260604000006_add_idp_idempotency/migration.sql`
- Modify: `platform/database/db_plexcare_tenancy.sql` (append DDLs documentais)
- Test: `test/integration/schema.spec.ts`

- [ ] **Step 1: 🔴 Escrever teste integração que verifica todas as tabelas e UNIQUEs**

`test/integration/schema.spec.ts` — sobe MySQL via Testcontainers, roda `prisma migrate deploy`, faz `SHOW TABLES` e verifica que as 6 novas existem; faz `SHOW INDEX FROM idp_user_role` e verifica `uq_idp_user_role`.

- [ ] **Step 2: 🔴 Rodar — deve falhar com "table not found"**

```bash
npm run test:integration -- schema.spec
```

- [ ] **Step 3: 🟢 Adicionar modelos Prisma**

Modelos: `IdpUser` (apenas mapping da tabela existente, sem migration), `IdpUserRole`, `IdpSession`, `IdpSigningKey`, `IdpClient`, `IdpCronLock`, `IdpIdempotency`, `AuthorizeState` (mapping da tabela existente), `Outbox` (mapping), `Lockout` (mapping), `Account` (mapping), `Customer` (mapping).

Mapping de tabelas pré-existentes usa `@@map` apontando para o nome real e **não gera migration** (configurar `prisma migrate dev --create-only` e remover sections relevantes, ou usar `prisma db pull` antes para baseline).

- [ ] **Step 4: Gerar 6 migrations separadas**

```bash
npx prisma migrate dev --create-only --name add_idp_user_role
# editar SQL para corresponder exato ao DDL do discovery; repetir para cada
```

Cada migration contém só o `CREATE TABLE` da sua tabela.

- [ ] **Step 5: 🟢 Rodar — deve passar**

```bash
npm run test:integration -- schema.spec
```

- [ ] **Step 6: Atualizar `db_plexcare_tenancy.sql`** com os DDLs idênticos ao final do arquivo (seção `-- IDP module — added 2026-06-04`).

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/shared/prisma/ test/integration/schema.spec.ts platform/database/db_plexcare_tenancy.sql
git commit -m "feat(idp-api): adicionar schema Prisma e migrations das 6 tabelas IdP

Cria idp_user_role, idp_session, idp_signing_key, idp_client,
idp_cron_lock, idp_idempotency. Tabelas existentes (idp_user,
authorize_state, outbox, lockout, account, customer) são apenas
mapeadas. Teste integração via Testcontainers valida UNIQUEs e PKs."
```

**Critérios de aceite:**
- `prisma migrate deploy` aplica as 6 migrations em DB limpo sem erro
- Teste de integração verifica existência das tabelas + chaves
- `db_plexcare_tenancy.sql` contém os mesmos DDLs

---

### Etapa 3 — Config validation com Zod + ConfigService

**Files:**
- Create: `src/config/env.schema.ts`
- Create: `src/config/env.service.ts`
- Modify: `src/app.module.ts`
- Test: `test/unit/config/env.schema.spec.ts`

- [ ] **Step 1: 🔴 Teste — schema rejeita `PORT` não-numérico, exige `DATABASE_URL`, gera erro legível**

- [ ] **Step 2: 🟢 Implementar `env.schema.ts`** com Zod cobrindo todas as envs do `.env.example`

Coerções: `PORT z.coerce.number().int().positive()`, `CORS_ALLOWED_ORIGINS z.string().transform(s => s.split(','))`, `LOCKOUT_THRESHOLD z.coerce.number()`, etc.

- [ ] **Step 3: 🟢 `EnvService`** injectable que expõe `env` parseado tipado.

- [ ] **Step 4: Wire no `AppModule`** via `ConfigModule.forRoot({ validate: zodValidate })`.

- [ ] **Step 5: 🔵 Refactor** — extrair `zodValidate` para helper testado.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(idp-api): validação de env com Zod (boot falha cedo)"
```

---

### Etapa 4 — Shared: Prisma, error filter (problem+json), logger, OTel

**Files:**
- Create: `src/shared/prisma/prisma.service.ts`, `src/shared/prisma/prisma.module.ts`
- Create: `src/shared/errors/app-exception.ts`, `src/shared/errors/app-exception.filter.ts`, `src/shared/errors/error-codes.ts`
- Create: `src/shared/logging/logger.module.ts`
- Create: `src/shared/otel/otel.module.ts`, `src/shared/otel/tracing.interceptor.ts`
- Create: `src/shared/metrics/metrics.module.ts`, `src/shared/metrics/metrics.controller.ts`
- Test: `test/unit/shared/app-exception.filter.spec.ts`

- [ ] **Step 1: 🔴 Teste filter — `throw new AppException('login_invalid_credentials')` vira body `application/problem+json` com `code: 'login_invalid_credentials'`, `status: 401`, `trace_id` populado a partir do contexto OTel**

- [ ] **Step 2: 🟢 `error-codes.ts`** — enum/dict de todos os 17 códigos do Blueprint §4.2 com `{ status, code, defaultDetail, defaultTitle }`.

- [ ] **Step 3: 🟢 `AppException`** classe + `AppExceptionFilter` (Catch all, mapeia AppException → 7807, demais → 500 genérico com `code='internal_error'`).

- [ ] **Step 4: `PrismaService`** estende `PrismaClient`, hook `onModuleInit/Destroy`, configurações de log. Recebe `DATABASE_URL` do `EnvService` — nada hardcoded.

- [ ] **Step 5: `LoggerModule`** wrap de `nestjs-pino` com redaction de `password`, `current_password`, `new_password`, `Authorization`, `cookie`.

- [ ] **Step 6: `OtelModule`** inicializa SDK no boot (auto-instrumentations: http, fastify, pg, prisma — confirmar plugin Prisma; senão usar tracer manual em `PrismaService`).

- [ ] **Step 7: `MetricsModule`** Prometheus registry global + `/metrics` (Prom client) — primeiras métricas vazias, populadas conforme módulos chegam.

- [ ] **Step 8: 🔵 Refactor** — extrair `traceIdFromContext()` em helper testado.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(idp-api): infra compartilhada — Prisma, errors RFC 7807, pino, OTel, Prometheus"
```

**Critérios de aceite:**
- `GET /metrics` retorna 200 com `process_*` defaults
- `throw new AppException('login_invalid_credentials')` em qualquer controller produz body 7807 com `trace_id`
- Logs pino têm `password` redatado

---

### Etapa 5 — Shared: Crypto (Ed25519 signer + JWKS) 🔴 TDD obrigatório (D8)

**Files:**
- Create: `src/shared/crypto/jwt-signer.service.ts`, `src/shared/crypto/jwt-signer.module.ts`
- Create: `src/shared/crypto/key-encryption.service.ts` (KEK wrap/unwrap)
- Create: `src/shared/crypto/key-loader.service.ts` (lê `idp_signing_key` + cache TTL 60s)
- Test: `test/unit/shared/jwt-signer.spec.ts`
- Test: `test/integration/key-loader.spec.ts`

- [ ] **Step 1: 🔴 Teste — `JwtSignerService.sign(claims)` retorna JWT com header `{ alg: 'EdDSA', typ: 'JWT', kid: <active_kid> }`, claims incluem `iss/aud/exp/iat/sub/jti`, `exp - iat == 900`**

- [ ] **Step 2: 🔴 Teste — `JwtSignerService.verify(jwt)` valida assinatura com `active`; aceita `previous` (grace); rejeita `retired` ou `kid` desconhecido com `AppException('token_invalid')`**

- [ ] **Step 3: 🔴 Teste — JWT alg `none` ou `HS256` é REJEITADO mesmo com `kid` válido (alg pinning)**

- [ ] **Step 4: 🟢 Implementar** com `jose` (`SignJWT`, `jwtVerify`); chave privada decifrada com `KeyEncryptionService` que **resolve adapter pelo gate `JWKS_KEK_PROVIDER`**:
  - `env` → `EnvKekAdapter` (AES-256-GCM com KEK lida de `JWKS_KEK_DEV`)
  - `kms` → `AwsKmsAdapter` placeholder que lança `NotImplementedError` ("KMS adapter pendente — implementar quando cloud target for definido")
  - Boot **falha fast** se `NODE_ENV=production` e `JWKS_KEK_PROVIDER=env`.

- [ ] **Step 5: 🔴 Teste KEK — `wrap(priv)` produz ciphertext diferente em chamadas distintas (IV random); `unwrap(wrap(priv)) == priv`**

- [ ] **Step 6: 🟢 `KeyLoaderService`** — `loadActive()` + cache 60s (Map em memória); `getKey(kid)` busca `previous|active`; expõe `getJwks()` para o controller.

- [ ] **Step 7: 🔴 Teste integration — KeyLoader em DB real lê 2 keys (active + previous), expõe ambas no JWKS**

- [ ] **Step 8: 🔵 Refactor** — extrair `parseClaims(jwt)` helper para reuso em outros lugares.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(idp-api): JWT Ed25519 signer/verifier + JWKS loader com rotação

Pinning de alg=EdDSA, rejeita kid desconhecido e retired.
KeyEncryption AES-GCM com KEK env (dev) — adapter KMS placeholder."
```

**Critérios de aceite:**
- Cobertura 100% em `jwt-signer.service.ts`
- Mutation tests (manual): trocar `EdDSA` por `HS256` no header e ver verify falhar

---

### Etapa 6 — Shared: Kafka producer + Outbox service (sem worker ainda)

**Files:**
- Create: `src/shared/kafka/kafka-producer.service.ts`, `src/shared/kafka/kafka.module.ts`
- Create: `src/modules/outbox/outbox.service.ts`, `src/modules/outbox/outbox.module.ts`
- Create: `src/modules/outbox/cloudevents.ts` (envelope builder)
- Test: `test/unit/outbox/cloudevents.spec.ts`
- Test: `test/integration/outbox.service.spec.ts`

- [ ] **Step 1: 🔴 Teste — `buildCloudEvent({ type, subject, data, tenantId })` produz envelope 1.0 com `id`, `specversion: '1.0'`, `source: 'plexcare-idp-api'`, `time` ISO 8601, `datacontenttype: 'application/json'`**

- [ ] **Step 2: 🟢 `cloudevents.ts`** implementa.

- [ ] **Step 3: 🔴 Teste integração — `OutboxService.publish(prismaTx, { type, subject, data, tenantId })` insere uma linha em `outbox` com `event_id` UUID, `published_at NULL`, `attempts=0`. Recebe `prismaTx` para participar de transação externa.**

- [ ] **Step 4: 🟢 `OutboxService.publish(tx, evt)`** — INSERT na mesma transação passada.

- [ ] **Step 5: `KafkaProducer.connect()/produce(batch)`** — kafkajs idempotent, acks=all, retries 5, backoff exponencial. Sem worker ainda — só o wrapper.

- [ ] **Step 6: 🔵 Refactor** — tipo `IdpEvent` discriminated union (type literal + payload tipado por evento, Blueprint §4.4).

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(idp-api): outbox transacional + envelope CloudEvents 1.0 + producer Kafka"
```

---

### Etapa 7 — Keycloak adapter (Direct Grant + Admin)

**Files:**
- Create: `src/modules/keycloak/keycloak.service.ts`, `src/modules/keycloak/keycloak.module.ts`
- Create: `src/modules/keycloak/keycloak.errors.ts`
- Create: `src/modules/keycloak/keycloak-admin-token.service.ts` (cache token admin)
- Test: `test/unit/keycloak/keycloak.service.spec.ts` (mock axios)
- Test: `test/integration/keycloak/keycloak.it.spec.ts` (Testcontainers ou skip se KC não disponível)

- [ ] **Step 1: 🔴 Teste — `directGrant(email, password)` chama `POST /realms/plexcare/protocol/openid-connect/token` com `grant_type=password`; 200 retorna `{ kc_access_token, email_verified }`; 401 lança `AppException('login_invalid_credentials')`; KC 5xx lança `AppException('service_unavailable')`**

- [ ] **Step 2: 🔴 Teste — `directGrant` NÃO loga password (assert no transport log)**

- [ ] **Step 3: 🟢 `KeycloakService.directGrant`** — axios + decode JWT do KC para extrair `email_verified` (sem validar assinatura — confiamos no transporte HTTPS para o KC).

- [ ] **Step 4: 🔴 Teste — `createUser({ email, password, fullName })` chama Admin API; 409 → `AppException('signup_email_taken')`; sucesso retorna `kc_user_id`**

- [ ] **Step 5: 🟢 `createUser`** + `KeycloakAdminTokenService` (client_credentials cache 60s pre-expiry).

- [ ] **Step 6: 🔴 Teste — `executeActionsEmail(kcUserId, ['VERIFY_EMAIL'], redirectUri)` chama endpoint correto**

- [ ] **Step 7: 🟢 Adicionar `executeActionsEmail`, `resetPassword`, `verifyActionToken`** (mínimo necessário para signup/reset/verify).

- [ ] **Step 8: 🔵 Refactor** — extrair `apiCall<T>()` com retry + backoff (3 tentativas, 100/500/2000 ms) só para 5xx; 4xx **não** retry.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(idp-api): adapter Keycloak — Direct Grant + Admin API com retry seletivo"
```

**Critérios de aceite:**
- Mock axios cobre cada path (200, 401, 409, 5xx)
- Senha nunca aparece em log (teste assertivo)

---

### Etapa 8 — Lockout service 🔴 TDD obrigatório (D8)

**Files:**
- Create: `src/modules/lockout/lockout.service.ts`, `src/modules/lockout/lockout.module.ts`
- Create: `src/modules/lockout/lockout.errors.ts`
- Test: `test/integration/lockout.service.spec.ts`

- [ ] **Step 1: 🔴 Teste — primeira chamada `check('email:a@b.com')` retorna `{ blocked: false }`**

- [ ] **Step 2: 🔴 Teste — após 5 `registerFailure('email:a@b.com')` em janela < 5min, próxima `check` retorna `{ blocked: true, until: now+15min }`**

- [ ] **Step 3: 🔴 Teste — falhas fora da janela (mock clock +6min) não contam**

- [ ] **Step 4: 🔴 Teste — `reset('email:a@b.com')` zera `failures_json`**

- [ ] **Step 5: 🔴 Teste — chave `ip:1.2.3.4` é independente de `email:a@b.com`**

- [ ] **Step 6: 🟢 Implementar** com UPSERT em `lockout` (JSON `failures_json`), parâmetros via `EnvService` (`LOCKOUT_WINDOW_SECONDS`, `LOCKOUT_THRESHOLD`, `LOCKOUT_BLOCK_SECONDS`).

- [ ] **Step 7: 🔵 Refactor** — extrair `pruneOldFailures(json, windowSec)` helper.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(idp-api): lockout anti-bruteforce — janela 5min/5 falhas/bloqueio 15min"
```

**Critérios de aceite:**
- Cobertura 100%
- Teste rodando contra MySQL real (Testcontainers)

---

### Etapa 9 — PKCE service 🔴 TDD obrigatório (D8)

**Files:**
- Create: `src/modules/authorize/pkce.service.ts`, `src/modules/authorize/authorize.errors.ts`
- Test: `test/integration/pkce.service.spec.ts`
- Test: `test/unit/authorize/pkce.spec.ts`

- [ ] **Step 1: 🔴 Teste unit — `verifyChallenge(verifier, challenge)` retorna true quando `base64url(sha256(verifier)) === challenge`; false caso contrário**

- [ ] **Step 2: 🔴 Teste integração — `createState({ audience, challenge, method: 'S256', redirectUri, nonce })` INSERT em `authorize_state` com `expires_at = now + 5min`, retorna `state` 16+ chars + `code` 32 bytes base64url**

- [ ] **Step 3: 🔴 Teste integração — `consumeState(state, codeVerifier)`: state válido + verifier correto retorna `{ audience, redirectUri, nonce }` E deleta a linha (single-use); state inexistente → `pkce_state_invalid`; expirado → `pkce_state_invalid`; verifier errado → `pkce_verifier_mismatch`**

- [ ] **Step 4: 🔴 Teste — race condition: 2 chamadas concorrentes a `consumeState` com mesmo state — apenas uma vence (SELECT FOR UPDATE), outra recebe `pkce_state_invalid`**

- [ ] **Step 5: 🟢 Implementar** — `crypto.randomBytes` para `state` e `code`, `crypto.createHash('sha256')` para verify, transação serializável para `consumeState` (`SELECT ... FOR UPDATE` + DELETE).

- [ ] **Step 6: 🔵 Refactor** — extrair `generateUrlSafe(bytes)` helper.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(idp-api): PKCE (S256) com state opaco single-use e detecção de race"
```

---

### Etapa 10 — Session service 🔴 TDD obrigatório (D8)

**Files:**
- Create: `src/modules/sessions/session.service.ts`, `src/modules/sessions/session.module.ts`
- Test: `test/integration/session.service.spec.ts`

- [ ] **Step 1: 🔴 Teste — `issueRefresh({ idpUserId, accountId, clientId, ua, ip })` insere `idp_session` com `id` UUID v4, `expires_at = now + 30d` (configurável por `idp_client.refresh_token_ttl_seconds`), retorna `{ refreshToken: id }`**

- [ ] **Step 2: 🔴 Teste — `rotate(oldRefresh)` em uma TX: marca `oldRefresh` como `revoked_at=now, reason='rotated'`, insere novo session com TTL renovado, retorna novo refresh**

- [ ] **Step 3: 🔴 Teste — `rotate(refreshAlreadyRevoked)`: detecta reuso → revoga toda família do mesmo `idp_user_id + client_id`, lança `AppException('refresh_reuse_detected')`, emite N `idp.session.revoked(reason=reuse_detected)` no outbox da mesma TX**

- [ ] **Step 4: 🔴 Teste — `rotate(refreshExpired)` lança `refresh_invalid`**

- [ ] **Step 5: 🔴 Teste — `revoke(refresh, reason)` idempotente: chamadas seguintes em sessão já revogada retornam sem erro, mas só publicam `idp.session.revoked` UMA vez (affected_rows=1)**

- [ ] **Step 6: 🔴 Teste — `revokeAllForUser(idpUserId, reason)` usado em reset-password marca todas e publica N eventos**

- [ ] **Step 7: 🟢 Implementar** com transação Prisma (`prisma.$transaction`).

- [ ] **Step 8: 🔵 Refactor** — separar `rotate` em `_validate`, `_revoke`, `_create` privates.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(idp-api): session refresh rotation + reuse detection (OAuth 2.1 §6.1)"
```

**Critérios de aceite:**
- Cobertura 100% em `session.service.ts`
- Teste de reuso valida que TODAS as sessões da família caem (não só a reusada)

---

### Etapa 11 — Role resolver

**Files:**
- Create: `src/modules/roles/role-resolver.service.ts`, `src/modules/roles/role-resolver.module.ts`
- Test: `test/integration/role-resolver.spec.ts`

- [ ] **Step 1: 🔴 Teste — usuário com 1 role retorna `{ active: <role>, all: [<role>] }`**

- [ ] **Step 2: 🔴 Teste — usuário com 3 roles (account A:doctor, account A:employee, account B:doctor) e `requestedAccount=A`, `requestedRole='employee'` → `active=employee@A`, `all=[doctor@A,employee@A,doctor@B]`**

- [ ] **Step 3: 🔴 Teste — `requestedAccount=B` sem role nesse account → `AppException('account_not_allowed')`**

- [ ] **Step 4: 🔴 Teste — usuário sem nenhum `idp_user_role` válido (revoked_at not null) → `AppException('me_no_active_role')`**

- [ ] **Step 5: 🔴 Teste — default selection: sem `requestedAccount`, escolhe roles do `default_account_id` do `idp_user` (coluna existente); se não houver default, escolhe a mais antiga (`MIN(created_at)`)**

- [ ] **Step 6: 🟢 Implementar**.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(idp-api): role resolver — escolhe active_role + monta roles[] para claims JWT"
```

---

### Etapa 12 — JWKS + OIDC Discovery endpoints

**Files:**
- Create: `src/modules/jwks/jwks.controller.ts`, `src/modules/jwks/jwks.module.ts`
- Test: `test/e2e/jwks.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste e2e — `GET /.well-known/jwks.json` retorna 200 com `keys[]` contendo `kty/crv/x/kid/use/alg` para chaves `active` + `previous`**

- [ ] **Step 2: 🔴 Teste — header `Cache-Control: public, max-age=600`**

- [ ] **Step 3: 🔴 Teste — chaves `retired` NÃO aparecem**

- [ ] **Step 4: 🔴 Teste — `GET /.well-known/openid-configuration` retorna 200 com `issuer`, `token_endpoint`, `jwks_uri`, `userinfo_endpoint`, `response_types_supported: ["code"]`, etc. (Blueprint §4.3.8)**

- [ ] **Step 5: 🟢 Implementar** controllers usando `KeyLoaderService`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(idp-api): /.well-known/jwks.json e /.well-known/openid-configuration"
```

---

### Etapa 13 — Health + Ready endpoints

**Files:**
- Create: `src/modules/health/health.controller.ts`, `src/modules/health/health.module.ts`
- Test: `test/e2e/health.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste — `GET /health` sempre 200 (process alive)**

- [ ] **Step 2: 🔴 Teste — `GET /ready` 200 se mysql+keycloak+kafka OK; 503 se qualquer um down**

- [ ] **Step 3: 🔴 Teste — `signing_key_age_days` no body de `/ready`**

- [ ] **Step 4: 🟢 Implementar** com `@nestjs/terminus` ou checks manuais.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(idp-api): /health (liveness) e /ready (readiness com DB/KC/Kafka)"
```

---

### Etapa 14 — Auth Module: `POST /v1/auth/signup` 🔴 TDD

**Files:**
- Create: `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.module.ts`
- Create: `src/modules/auth/dto/signup.dto.ts` (Zod schema)
- Create: `src/modules/auth/application/signup.use-case.ts`
- Create: `src/modules/auth/domain/errors.ts`
- Test: `test/e2e/auth/signup.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste e2e — `POST /v1/auth/signup` válido: 202 `{ idp_user_id, verification_sent_to, message }`, cria linha em `idp_user`, KC mockado chamado com `email_verified=false`, outbox tem `idp.user.signed_up`**

- [ ] **Step 2: 🔴 Teste — email já existe (KC 409): 409 `signup_email_taken`, **nada persiste** em `idp_user`, nada em outbox**

- [ ] **Step 3: 🔴 Teste — senha 11 chars: 422 `signup_password_weak` (validação Zod backend-side)**

- [ ] **Step 4: 🔴 Teste — `accept_terms: false`: 422 (Zod enum [true])**

- [ ] **Step 5: 🔴 Teste — CPF inválido (10 chars): 422**

- [ ] **Step 6: 🔴 Teste — KC 5xx: 503, nada persiste**

- [ ] **Step 7: 🔴 Teste — `Idempotency-Key` igual em 2 calls dentro de 15min: segundo call retorna mesmo response sem chamar KC**

- [ ] **Step 8: 🟢 Implementar** — `SignupUseCase` orquestra: validar → KC.createUser → `prisma.$transaction { INSERT customer (se PF/PJ novo), INSERT idp_user, INSERT outbox }` → KC.executeActionsEmail.

- [ ] **Step 9: 🟢 Implementar `IdempotencyInterceptor`** que persiste/lê de `idp_idempotency`.

- [ ] **Step 10: 🔵 Refactor** — separar validação de password policy em service `PasswordPolicy.validate(pwd)` (reuso em reset/change).

- [ ] **Step 11: Commit**

```bash
git commit -m "feat(idp-api): POST /v1/auth/signup com idempotency e outbox"
```

---

### Etapa 15 — Authorize Module: `POST /v1/auth/login` 🔴 TDD

**Files:**
- Create: `src/modules/authorize/authorize.controller.ts`, `src/modules/authorize/authorize.module.ts`
- Create: `src/modules/authorize/dto/login.dto.ts`
- Create: `src/modules/authorize/application/login.use-case.ts`
- Test: `test/e2e/authorize/login.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste e2e — `POST /v1/auth/login` válido: 200 `{ code, state, redirect_uri }`, `authorize_state` populado, `lockout` resetado, outbox vazio (login bem-sucedido só publica `idp.session.created` no `/token`)**

- [ ] **Step 2: 🔴 Teste — senha errada: 401 `login_invalid_credentials`, `lockout.registerFailure(email)` + `registerFailure(ip)`, outbox tem `idp.session.login_failed(bad_credentials)`**

- [ ] **Step 3: 🔴 Teste — 5 falhas em 5min: 6º call 423 `login_locked` SEM chamar KC**

- [ ] **Step 4: 🔴 Teste — `email_verified=false` do KC: 403 `login_email_not_verified`, lockout NÃO incrementa**

- [ ] **Step 5: 🔴 Teste — `client_id` desconhecido (não em `idp_client`): 400 `pkce_state_invalid` (ou criar code dedicado `client_unknown`? — **decisão:** reusar `pkce_state_invalid` por brevidade do MVP; documentar)**

- [ ] **Step 6: 🔴 Teste — `redirect_uri` não-whitelisted no `idp_client.redirect_uris`: 400**

- [ ] **Step 7: 🟢 Implementar** — `LoginUseCase` chama `LockoutService.check` → `KeycloakService.directGrant` → `PkceService.createState` → response.

- [ ] **Step 8: 🟢 Métrica** `idp_login_total{result="success|failure|locked|kc_down"}` incrementada no use case.

- [ ] **Step 9: 🔵 Refactor** — extrair `validateClient(clientId, redirectUri)` no `IdpClientRepository`.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(idp-api): POST /v1/auth/login com PKCE + lockout + métricas"
```

---

### Etapa 16 — Token Module: `POST /v1/token` (code exchange) 🔴 TDD

**Files:**
- Create: `src/modules/token/token.controller.ts`, `src/modules/token/token.module.ts`
- Create: `src/modules/token/dto/token-request.dto.ts`
- Create: `src/modules/token/application/exchange-code.use-case.ts`
- Test: `test/e2e/token/exchange.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste e2e fluxo completo — signup → verify email (mock) → login → exchange. Verificar que JWT emitido tem claims completos: `sub, account_id, active_role, roles[], doctor_id?, email, email_verified=true, exp-iat=900`**

- [ ] **Step 2: 🔴 Teste — `code_verifier` errado: 400 `pkce_verifier_mismatch`, NÃO emite JWT, NÃO cria session**

- [ ] **Step 3: 🔴 Teste — `code` reused (chamada 2x): 400 `pkce_state_invalid` (consumeState já deletou)**

- [ ] **Step 4: 🔴 Teste — `redirect_uri` no body diferente do salvo no `authorize_state`: 400**

- [ ] **Step 5: 🔴 Teste — outbox tem `idp.session.created`**

- [ ] **Step 6: 🔴 Teste — métrica `idp_token_issued_total{client_id="plexcare-platform-web"}` += 1**

- [ ] **Step 7: 🔴 Teste — `account_id` no request: força esse tenant; se usuário não tem role nesse account → 403 `account_not_allowed`**

- [ ] **Step 8: 🟢 Implementar** — `ExchangeCodeUseCase`: `PkceService.consumeState` → load user/roles → `RoleResolver.resolveActive` → `JwtSigner.sign` → `SessionService.issueRefresh` → outbox → response.

- [ ] **Step 9: 🔵 Refactor** — `JwtClaimsBuilder` helper para montar claims a partir de `{ user, role, client, session }`.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(idp-api): POST /v1/token — exchange code → JWT + refresh + id_token"
```

---

### Etapa 17 — Token Module: `POST /v1/token/refresh` 🔴 TDD

**Files:**
- Create: `src/modules/token/application/refresh-token.use-case.ts`
- Test: `test/e2e/token/refresh.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste — refresh válido R1 → 200 com novo `access_token` e `refresh_token=R2`. R1 fica `revoked_at NOT NULL, reason='rotated'`**

- [ ] **Step 2: 🔴 Teste — refresh R2 imediatamente após (válido) → R3, R2 revogado**

- [ ] **Step 3: 🔴 Teste — REUSO: chamar refresh com R1 (já rotacionado): 401 `refresh_reuse_detected`. R2, R3 todos revogados com `reason='reuse_detected'`. Outbox tem N `idp.session.revoked`**

- [ ] **Step 4: 🔴 Teste — refresh expirado: 401 `refresh_invalid`**

- [ ] **Step 5: 🔴 Teste — refresh de outro `client_id`: 401 `refresh_invalid`**

- [ ] **Step 6: 🔴 Teste — roles atualizados desde último issue: claims do novo JWT refletem (lookup `idp_user_role` no refresh)**

- [ ] **Step 7: 🟢 Implementar** — usa `SessionService.rotate`.

- [ ] **Step 8: 🔴 Teste — métrica `idp_refresh_rotation_total += 1`**

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(idp-api): POST /v1/token/refresh com rotação + reuse detection"
```

---

### Etapa 18 — Token Module: `POST /v1/token/revoke` (logout)

**Files:**
- Create: `src/modules/token/application/revoke-token.use-case.ts`
- Test: `test/e2e/token/revoke.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste — revoke válido: 204, session `revoked_at=now, reason='logout'`, outbox tem `idp.session.revoked(logout)` UMA vez**

- [ ] **Step 2: 🔴 Teste — revoke idempotente: segunda chamada 204, NÃO duplica evento outbox**

- [ ] **Step 3: 🔴 Teste — refresh inexistente: 204 (idempotente, não vaza existência)**

- [ ] **Step 4: 🟢 Implementar**.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(idp-api): POST /v1/token/revoke (logout) idempotente"
```

---

### Etapa 19 — Auth Module: forgot/reset/change-password + email/verify 🔴 TDD parcial

**Files:**
- Create: `src/modules/auth/application/forgot-password.use-case.ts`
- Create: `src/modules/auth/application/reset-password.use-case.ts`
- Create: `src/modules/auth/application/change-password.use-case.ts`
- Create: `src/modules/auth/application/verify-email.use-case.ts`
- Create: `src/modules/email/email.service.ts`, `src/modules/email/email.module.ts`
- Test: `test/e2e/auth/password.e2e-spec.ts`
- Test: `test/e2e/auth/verify.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste — `forgot-password` email existente: 204, KC `executeActionsEmail(UPDATE_PASSWORD)` chamado, total time ≥ 300ms**

- [ ] **Step 2: 🔴 Teste — `forgot-password` email inexistente: 204, KC NÃO chamado, total time ≥ 300ms (anti-enumeration)**

- [ ] **Step 3: 🔴 Teste — `reset-password` token válido + senha forte: 204, KC reset chamado, TODAS sessões revogadas (`reason='reset'`), outbox tem `idp.user.password_changed(reset)` + N `idp.session.revoked(reset)`**

- [ ] **Step 4: 🔴 Teste — `reset-password` token inválido: 400 `reset_token_invalid`**

- [ ] **Step 5: 🔴 Teste — `reset-password` senha fraca: 422 `password_policy_violation`**

- [ ] **Step 6: 🔴 Teste — `change-password` autenticado: 204, KC reset, OUTRAS sessões revogadas mas a atual (do JWT) mantida**

- [ ] **Step 7: 🔴 Teste — `change-password` `current_password` errado: 401**

- [ ] **Step 8: 🔴 Teste — `email/verify` token válido: 200 com `email_verified: true`, outbox tem `idp.user.email_verified`**

- [ ] **Step 9: 🟢 Implementar** todos os use cases.

- [ ] **Step 10: 🟢 EmailService stub** — em dev, escreve em MailHog (SMTP 1025); em prod, AWS SES SMTP relay. **Mas:** os emails de reset/verify são enviados pelo Keycloak (não pelo idp-api), via `executeActionsEmail`. O `EmailService` fica para emails operacionais futuros (security alerts) — sem cobertura agora.

- [ ] **Step 11: Commit (pode ser dividido em 4 commits menores se a etapa ficar grande — 1 por endpoint)**

```bash
git commit -m "feat(idp-api): forgot/reset/change-password + email/verify

Forgot tem resposta neutra com timing budget 300ms.
Reset revoga todas sessões; change revoga outras mas mantém atual.
Emails são enviados pelo Keycloak via executeActionsEmail."
```

---

### Etapa 20 — JwtAuthGuard + RolesGuard + Me Module

**Files:**
- Create: `src/shared/auth/jwt-auth.guard.ts`, `src/shared/auth/roles.guard.ts`, `src/shared/auth/auth.module.ts`
- Create: `src/shared/auth/decorators.ts` (`@CurrentUser()`, `@Roles()`)
- Create: `src/modules/me/me.controller.ts`, `src/modules/me/me.module.ts`
- Create: `src/modules/me/application/get-me.use-case.ts`, `src/modules/me/application/get-roles.use-case.ts`, `src/modules/me/application/switch-account.use-case.ts`, `src/modules/me/application/list-sessions.use-case.ts`, `src/modules/me/application/revoke-session.use-case.ts`
- Test: `test/e2e/me/me.e2e-spec.ts`

- [ ] **Step 1: 🔴 Teste — `JwtAuthGuard` sem header → 401 `token_invalid`; com JWT válido → injeta `req.user = { idpUserId, accountId, activeRole, roles[], clientId }`**

- [ ] **Step 2: 🔴 Teste — JWT expirado → 401**

- [ ] **Step 3: 🔴 Teste — JWT com `kid` desconhecido → 401**

- [ ] **Step 4: 🔴 Teste — `GET /v1/me` autenticado → 200 com `MeResponse` (Blueprint §4.3.7)**

- [ ] **Step 5: 🔴 Teste — `GET /v1/me/roles` → 200 com `[UserRole]` incluindo `is_default`**

- [ ] **Step 6: 🔴 Teste — `POST /v1/me/switch-account` para account válido → 200 com novo `{access_token, refresh_token}`, sessão atual revogada (`reason='switch'`), nova sessão criada**

- [ ] **Step 7: 🔴 Teste — `POST /v1/me/switch-account` para account sem role → 403 `account_not_allowed`**

- [ ] **Step 8: 🔴 Teste — `GET /v1/me/sessions` → 200 lista, com `is_current=true` para sessão do JWT**

- [ ] **Step 9: 🔴 Teste — `DELETE /v1/me/sessions/:id` própria → 204; de outro user → 404 (não vaza existência)**

- [ ] **Step 10: 🟢 Implementar**.

- [ ] **Step 11: Commit**

```bash
git commit -m "feat(idp-api): /v1/me endpoints + JwtAuthGuard + switch-account"
```

---

### Etapa 21 — Outbox Worker + JwksRotator + Session/State Purger (jobs cron)

**Files:**
- Create: `src/modules/outbox/outbox.worker.ts`
- Create: `src/modules/crypto/jwks-rotator.worker.ts`
- Create: `src/modules/cleanup/purger.worker.ts`
- Create: `src/shared/cron/cron-lock.service.ts`
- Test: `test/integration/outbox.worker.spec.ts`
- Test: `test/integration/jwks-rotator.spec.ts`
- Test: `test/integration/purger.spec.ts`
- Test: `test/integration/cron-lock.spec.ts`

- [ ] **Step 1: 🔴 Teste — `CronLockService.acquire('name', ttl)` retorna true; segunda call em outra "instância" retorna false; após `ttl`, próxima call retorna true (lock expirou)**

- [ ] **Step 2: 🟢 `CronLockService`** com `SELECT ... FOR UPDATE` em `idp_cron_lock`.

- [ ] **Step 3: 🔴 Teste — `OutboxWorker.tick()` com 10 linhas `published_at IS NULL` → produce em Kafka (mock), marca `published_at`; com 0 linhas → no-op**

- [ ] **Step 4: 🔴 Teste — produce falha → `attempts++`, `last_error` populado, NÃO marca published_at**

- [ ] **Step 5: 🟢 `OutboxWorker`** com `@Cron('*/500ms')` (ou setInterval), batch 100, `FOR UPDATE SKIP LOCKED`.

- [ ] **Step 6: 🔴 Teste — `JwksRotator.tick()`: cria nova key Ed25519, marca antiga active→previous, marca old previous (>180d)→retired**

- [ ] **Step 7: 🟢 `JwksRotator`** com `@Cron('0 3 1 * *')` + lock.

- [ ] **Step 8: 🔴 Teste — `Purger.tick()`: deleta `authorize_state` expirado, `idp_session.revoked_at < now-30d`, `idp_idempotency.expires_at < now`**

- [ ] **Step 9: 🟢 `Purger`** com `@Cron('*/1 * * * *')`.

- [ ] **Step 10: 🟢 Métrica `idp_outbox_lag_seconds`** gauge: `now - MIN(occurred_at WHERE published_at IS NULL)`.

- [ ] **Step 11: Commit**

```bash
git commit -m "feat(idp-api): workers — outbox poll, JWKS rotator mensal, purger de expirados

Lock distribuído via idp_cron_lock (SELECT FOR UPDATE) evita
duplicação quando replicas > 1."
```

---

### Etapa 22 — OpenAPI 3.1 + Swagger UI + bridge PKCE doc

**Files:**
- Create: `openapi.yaml` (gerado e versionado)
- Create: `src/openapi/openapi.builder.ts`
- Modify: `src/main.ts` (mount `/openapi.json` + `/docs`)
- Create: `docs/idp-api-pkce-bridge.md` (decisão final cookie apex vs alternativa)

- [ ] **Step 1: Materializar `openapi.yaml`** a partir dos esqueletos da §4.3 do blueprint, com todos os DTOs Zod traduzidos via `zod-to-openapi`.

- [ ] **Step 2: Mount no Nest** — `SwaggerModule.setup('/docs', app, document)`; expor JSON em `/openapi.json`.

- [ ] **Step 3: Teste e2e** — `GET /openapi.json` valida via `@apidevtools/swagger-parser`.

- [ ] **Step 4: Documento `docs/idp-api-pkce-bridge.md`** decidindo cookie apex `__Host-pkce-verifier` SameSite=Lax, Secure, Path=/, host-only. Documenta limitação dev (sem TLS → fallback localStorage com warning).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(idp-api): OpenAPI 3.1 servido em /openapi.json + Swagger UI + decisão bridge PKCE"
```

---

### Etapa 23 — ADRs

**Files:**
- Create: `docs/adr/0004-idp-proprio-keycloak-oculto.md`
- Create: `docs/adr/0005-outbox-worker-poll.md`

- [ ] **Step 1: ADR-0004** consolidando TO-1 do blueprint (IdP próprio + KC oculto) — alternativas avaliadas, decisão, consequências, riscos R1+R2.

- [ ] **Step 2: ADR-0005** consolidando TO-4 (outbox + worker poll vs Debezium vs publish direto) — embora ADR-0001 cubra Kafka como bus, este ADR documenta o **mecanismo** de delivery transacional.

- [ ] **Step 3: Atualizar `docs/adr/README.md`** e raiz `CLAUDE.md` com novos ADRs.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(adr): ADR-0004 IdP próprio + KC oculto; ADR-0005 outbox + worker poll"
```

---

### Etapa 24 — Seeds dev + smoke e2e completo

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed`)
- Create: `test/e2e/journey.e2e-spec.ts`

- [ ] **Step 1: `seed.ts`** insere `idp_client` (`plexcare-platform-web`, `plexcare-login-web`) + 1 par Ed25519 cifrado com `JWKS_KEK_DEV`.

- [ ] **Step 2: 🔴 Teste e2e jornada completa**: signup → verify (mock KC) → login → exchange → me → refresh → switch-account → logout. Mesma suite usa Testcontainers (MySQL + Kafka + KC dev pre-seedado).

- [ ] **Step 3: 🟢 Ajustar** o que faltar.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(idp-api): seed dev + teste e2e jornada completa (signup→logout)"
```

---

### Etapa 25 — README + module CLAUDE.md final + tasklist execução

**Files:**
- Modify: `README.md` (do módulo)
- Modify: `CLAUDE.md` (do módulo)
- Modify: `platform/backend/CLAUDE.md` (criar se não existe, sumarizando os 3 backends)
- Modify: `CLAUDE.md` raiz (apontar para o novo módulo)
- Create: `tasks/idp-api-execution-tasklist.md` (resumo das 25 etapas para o agente executor)

- [ ] **Step 1: README** do módulo — quickstart, env, scripts, links para ADRs + spec.

- [ ] **Step 2: `CLAUDE.md`** do módulo (load-bearing): `src/main.ts`, `src/app.module.ts`, `prisma/schema.prisma`, `src/modules/token`, `src/modules/authorize`, `src/modules/auth`, `src/shared/crypto`, `src/shared/auth`, `openapi.yaml`. + gotchas (KEK em dev é env, prod é KMS; KC SMTP envia emails; cookie apex bridge).

- [ ] **Step 3: Atualizar root `CLAUDE.md`** — adicionar entrada no mapa do monorepo e na lista de "Antes de explorar o código".

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(idp-api): README do módulo, CLAUDE.md load-bearing, atualização root"
```

---

### Etapa 26 — PR draft + verificação CI local

- [ ] **Step 1: Rodar a suite completa local** — `npm run lint && npm run typecheck && npm run build && npm test && npm run test:e2e`. Tudo verde.

- [ ] **Step 2: Verificar cobertura ≥ 90%** em `auth/`, `authorize/`, `token/`, `shared/crypto/`, `modules/lockout/`, `modules/sessions/`.

- [ ] **Step 3: `git push -u origin feat/idp-api`**

- [ ] **Step 4: `gh pr create --draft`** com body referenciando discovery, blueprint e este spec.

---

## Plano de teste — visão consolidada

| Camada | Stack | O que cobre | Onde | Cobertura mínima |
|---|---|---|---|---|
| **Unit** | Jest puro + jest-mock-extended | regras de domínio (PKCE verify, password policy, CloudEvents builder, JWT claims builder, alg pinning) | `test/unit/` | 100% nas regras de segurança |
| **Integration** | Jest + Testcontainers MySQL | repos + services que tocam DB (lockout, PKCE state, session rotation, outbox INSERT atomicidade, schema migration) | `test/integration/` | ≥ 95% em `infrastructure/` |
| **e2e** | Jest + SuperTest + Testcontainers (MySQL + Kafka + Keycloak dev) | jornadas REST end-to-end + interação com KC real e Kafka real | `test/e2e/` | jornadas críticas 100% |
| **Contract** | Validação `openapi.yaml` via `@apidevtools/swagger-parser` + tests checam DTOs vs schema | OpenAPI sempre válido e refletindo controllers | `test/contract/` | 100% endpoints publicados |
| **Security checks** | Manual: alg pinning, kid pinning, body sem password, rate limit, reuse detection | — | inline em e2e | 100% dos 17 codes do §4.2 testados |

**Comandos:**

```bash
npm test                  # unit + integration (Testcontainers leve)
npm run test:e2e          # e2e (todos os containers)
npm run test:coverage     # gera relatório coverage
npm run test:contract     # valida openapi
```

**CI obrigatório (GitHub Actions):** `lint` + `typecheck` + `test` + `test:e2e` + `test:contract`. Bloqueia merge se falhar.

**Casos prioritários TDD (recap, ordem de implementação):**

1. JWT alg pinning + kid pinning (E5)
2. Lockout janela + threshold + reset (E8)
3. PKCE verify + race condition consumeState (E9)
4. Session rotation + reuse detection (E10)
5. Signup happy path + KC 409 + idempotency (E14)
6. Login + lockout integration (E15)
7. Exchange code happy + verifier mismatch (E16)
8. Refresh rotation + reuse detection (E17)
9. Reset password revoga todas sessões (E19)
10. Switch-account com role inválido → 403 (E20)

---

## Plano de rollback

### Por etapa (granularidade commit)

Cada etapa = 1 commit pequeno. Reverter uma etapa = `git revert <sha>`.

### Por feature (módulo inteiro)

> **Nota:** ainda não há cloud target definido — esta seção é o **plano que será aplicado quando houver prod**. Em dev/CI, rollback = drop do volume MySQL ou rodar contra DB efêmero novo.

1. **Migrações:** todas as 6 novas tabelas são **aditivas** — nenhuma altera schema existente. `prisma migrate resolve --rolled-back <name>` + `DROP TABLE` em ordem inversa (FKs primeiro, depois tabelas independentes).

```sql
DROP TABLE idp_idempotency;
DROP TABLE idp_cron_lock;
DROP TABLE idp_client;
DROP TABLE idp_signing_key;
DROP TABLE idp_session;
DROP TABLE idp_user_role;
```

2. **Eventos publicados:** tópicos `idp.*.v1` continuam existindo no Kafka — consumers devem ser idempotentes pelo `event_id` (já são por design). Sem rollback necessário.

3. **Sessões emitidas (JWT):** access tokens já em circulação expiram naturalmente em 15 min. Para invalidação imediata: rotacionar `idp_signing_key` (`UPDATE status='retired'` em todas) — todos os tokens param de validar via JWKS. Refresh tokens deixam de funcionar pois `idp_session` foi dropada.

4. **DNS / tráfego:** apontar `idp.<dominio>` para endpoint de manutenção — só relevante quando houver prod.

5. **login-web fallback:** flag `VITE_AUTH_PROVIDER=keycloak-direct` (fallback direto ao KC, UX padrão KC). Fora do escopo deste spec; tarefa do time `plexcare-login-web` quando prod existir.

### Rollback por incidente — runbook resumido

| Sintoma | Ação imediata | Investigação |
|---|---|---|
| `idp_login_total{result="kc_down"}` > 50% | escalar KC; alternar `idp_signing_key.active` se suspeita de chave vazada | logs KC + métricas |
| `idp_outbox_lag_seconds` > 60s | restart worker; checar broker Kafka | logs worker + Kafka |
| `refresh_reuse_detected` em massa para mesmo user | revogar sessões dele explicitamente; investigar device | audit log via outbox consumer |
| `signing_key_age_days` > 100 | rotacionar manualmente: `POST /admin/rotate-jwks` (admin endpoint a criar em etapa futura, fora deste spec — workaround: rodar o cron na mão) | — |

---

## Observabilidade

### Logs (pino, JSON estruturado, redaction automática)

Campos obrigatórios em todo log: `level`, `time`, `trace_id`, `span_id`, `service: 'plexcare-idp-api'`, `version`, `env`. Em request logs: `request_id`, `method`, `path`, `status`, `latency_ms`, `client_id`, `idp_user_id?`. **Redatar**: `password`, `current_password`, `new_password`, `Authorization`, `cookie`, `code_verifier`, `private_jwk`, `kek`.

### Métricas Prometheus (`/metrics`)

| Métrica | Tipo | Labels | Etapa |
|---|---|---|---|
| `idp_login_total` | Counter | `result={success,failure,locked,kc_down,email_not_verified}` | E15 |
| `idp_token_issued_total` | Counter | `client_id, grant_type={code,refresh}` | E16/E17 |
| `idp_refresh_rotation_total` | Counter | `client_id` | E17 |
| `idp_refresh_reuse_detected_total` | Counter | — | E17 |
| `idp_session_revoked_total` | Counter | `reason` | E10/E17/E18 |
| `idp_outbox_lag_seconds` | Gauge | — | E21 |
| `idp_outbox_pending` | Gauge | — | E21 |
| `idp_kc_request_duration_seconds` | Histogram | `endpoint={token,admin_users,admin_email}` | E7 |
| `idp_signing_key_age_days` | Gauge | `status={active,previous}` | E21 |
| `idp_lockout_blocks_total` | Counter | `key_kind={email,ip}` | E8 |
| `http_request_duration_seconds` | Histogram | `method, route, status` | E4 (auto via OTel) |

### Traces OpenTelemetry

Auto-instrumentation: `@opentelemetry/instrumentation-http`, `instrumentation-fastify`, `instrumentation-pino`. Manual: spans em `KeycloakService.directGrant`, `JwtSigner.sign`, `OutboxWorker.tick`. Atributos: `idp.user_id`, `idp.client_id`, `idp.active_role` (NUNCA `idp.password`, `idp.refresh_token`).

### Alertas (Prometheus rules — incluir em `monitoring/alerts.yaml` futuro)

| Alerta | Condição | Severity | Runbook |
|---|---|---|---|
| `IdpHighLoginFailureRate` | `rate(idp_login_total{result="failure"}[5m]) / rate(idp_login_total[5m]) > 0.30` por 5min | warning | investigar ataque vs incidente UX |
| `IdpKeycloakDown` | `idp_login_total{result="kc_down"} > 0` em 1min | critical | escalar para SRE KC |
| `IdpOutboxLag` | `idp_outbox_lag_seconds > 60` por 2min | warning | restart worker + checar Kafka |
| `IdpKeySigningStale` | `idp_signing_key_age_days{status="active"} > 100` | warning | rotacionar manualmente |
| `IdpKcLatency` | `histogram_quantile(0.95, idp_kc_request_duration_seconds) > 0.5` por 5min | warning | investigar rede KC |
| `IdpRefreshReuseSpike` | `rate(idp_refresh_reuse_detected_total[10m]) > 0.1` | critical | possível roubo de token — audit + comunicação |

### Health endpoints

- `/health` — process alive (200 fixo)
- `/ready` — `mysql:ok`, `keycloak:ok`, `kafka:ok|lagging|down`, `signing_key_age_days:int`. K8s readinessProbe usa `/ready`.

---

## Riscos remanescentes e mitigações dentro deste spec

| Risco | Mitigação no spec |
|---|---|
| **Cobertura social login (R8 discovery)** | Out-of-scope; etapa futura. Documentado em ADR-0004 como follow-up. |
| **plexcare-platform-web inexistente (R4)** | Bridge PKCE documentada (Etapa 22); idp-api e2e testa o exchange direto sem precisar do platform-web rodando. |
| **KEK em dev = env var (R3)** | Dev only — claramente sinalizado em `.env.example`; prod usa KMS adapter (placeholder + flag para falhar boot se `NODE_ENV=production` e KEK vier de env). |
| **Idempotency em DB ao invés de Redis** | Implementação MySQL aceita até ~100 req/min sem stress (medido em Etapa 24); se virar gargalo, swap para Redis é trocar repo (interface estável). |
| **Tópicos Kafka não criados em prod** | Etapa 21 valida no boot e falha fast com erro claro; DevOps cria antes do deploy. |
| **Hexagonal-lite pode degenerar** | TO-6 do blueprint manda pasta `domain/` separada; revisar em /review se serviços começarem a importar Prisma diretamente. |

---

## Checkpoint /feature

- [x] `/discovery` ([idp-api-discovery.md](idp-api-discovery.md))
- [x] `/blueprint` ([idp-api-blueprint.md](idp-api-blueprint.md))
- [x] `/spec` — **este documento**
- [ ] `/tdd` — pendente revisão humana antes de iniciar
- [ ] `/review`
- [ ] `/qa`

---

## Decisões confirmadas pelo usuário (2026-06-04)

1. ✅ Path do módulo: `platform/backend/plexcare-idp-api/`
2. ✅ MySQL dev em `3307` no compose, **mas tudo parametrizado via `DATABASE_URL`** — host/porta/credenciais nunca hardcoded; cloud futuro só reescreve a env
3. ✅ Branch `feat/idp-api`
4. ✅ Etapas grandes (E14/E19/E20) podem ser sub-commitadas durante execução
5. ⏸ **Migration em prod fica em aberto** — não há cloud target ainda; spec não trava decisão; abrir ADR quando target for escolhido (AWS/Azure/DO)
6. ✅ KMS placeholder com gate `JWKS_KEK_PROVIDER=env|kms` — `AwsKmsAdapter` lança `NotImplementedError`; boot falha fast se `NODE_ENV=production && provider=env`

## Próximo passo

Pronto para `/tdd` a partir da **Etapa 1** (scaffold) ou `/feature` para encadear todas as etapas com checkpoints.
