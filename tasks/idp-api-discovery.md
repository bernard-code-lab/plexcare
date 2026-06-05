# Discovery — `plexcare-idp-api`

> Etapa 1/6 do pipeline `/feature`. Estado: **discovery concluído — aguardando `/blueprint`**.
> Próximo: `/clear` + `/blueprint crie a api do idp …` carregando este doc como contexto.

## Contexto

A PlexCare precisa de uma API REST de identidade — **não BFF** — que:

- Receba requisições do `plexcare-login-web` e, no futuro, do `plexcare-platform-app` (mobile/web)
- Autentique credenciais usando o Keycloak como source-of-truth de senha
- Emita tokens próprios enriquecidos com `account_id`, `roles[]` e papel ativo (doctor, employee, client)
- Persista o vínculo `keycloak_user_id ↔ customer ↔ account` (multi-tenant)
- Publique eventos transacionais (signup, login, role assignment) para os demais microserviços via Kafka

Fluxo macro do login:

```
usuário → login-web (preenche email+senha)
       → POST /auth/login (idp-api)
       → idp-api valida no Keycloak (Direct Grant)
       → idp-api devolve { code, state, redirect_uri }
       → login-web window.location.assign(redirect_uri?code=X&state=Y)
       → platform-web /callback → POST /token (idp-api)
       → platform-web recebe JWT + refresh, renderiza dashboard
```

## Arquivos consultados

- `platform/database/db_plexcare_party.sql` — customer, customer_document, document_type, person_type
- `platform/database/db_plexcare_tenancy.sql` — account, idp_user, authorize_state, lockout, outbox, client, client_profile, employee
- Diagrama ER (anexo enviado pelo usuário) — propõe `IDP + user` separados, mas decidimos preservar `idp_user` e estender com `idp_user_role`
- `CLAUDE.md` raiz — convenção monorepo, compliance, hexagonal+DDD adotado pelo `teleconf-service` Go

## Estado atual do schema (já existe)

`db_plexcare_tenancy`:

| Tabela | Papel |
|---|---|
| `account` | tenant B2B (FK lógica `customer_id` → `db_plexcare_party.customer`) |
| `idp_user (id, login, keycloak_user_id UNIQUE, account_id, account_customer_id)` | vínculo KC ↔ account (1:1 hoje) |
| `authorize_state (state PK, audience, pkce_challenge, pkce_method, redirect_uri, nonce, created_at, expires_at)` | PKCE state do OAuth |
| `lockout (key_name PK, failures_json, updated_at)` | anti-bruteforce por chave (email, IP) |
| `outbox (id, event_id UNIQUE, type, payload JSON, occurred_at, enqueued_at, published_at, attempts, last_error)` | transactional outbox |
| `client`, `client_profile`, `employee` | papéis dentro de um account |

## Decisões fechadas

| # | Tema | Decisão | Justificativa |
|---|---|---|---|
| D1 | Escopo da IdP | Authorization Server completo (SPAs ↔ IdP, KC oculto) | Atende login-web + futuros apps; KC fica como motor de credencial |
| D2 | Modelo de dados | Manter `idp_user` + adicionar `idp_user_role (idp_user_id, account_id, role, doctor_id?, customer_id?)` | Zero migration destrutiva, multi-papel desbloqueado |
| D3 | Validação de senha | Direct Grant `POST /realms/plexcare/protocol/openid-connect/token grant_type=password` | Senha nunca persiste fora do KC; aproveita políticas KC out-of-box |
| D4 | Handoff pós-login | Authorization Code + PKCE (usa `authorize_state` já existente) | OIDC-style, seguro, suporta multi-cliente (login-web, platform-web, mobile) |
| D5 | Token | JWT próprio Ed25519 + JWKS rotacionável + refresh opaco em `idp_session` | Claims `account_id/roles/doctor_id` no token; microserviços validam offline via JWKS; refresh revogável |
| D6 | Eventos | Outbox → Kafka, schema CloudEvents 1.0 | Padronização; consumers atuais (teleconf-service) e futuros |
| D7 | Arquitetura | NestJS modular clássico + Prisma + MySQL 8 | DX rápido; **divergência consciente** do padrão hexagonal do `teleconf-service` Go (registrada como risco R1) |
| D8 | TDD | Obrigatório nas regras PKCE, lockout, emissão JWT, refresh+revogação | Convenção PlexCare; superfície de segurança |

## Modelo de dados — delta proposto

Nova tabela em `db_plexcare_tenancy`:

```sql
CREATE TABLE `idp_user_role` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `idp_user_id` BIGINT UNSIGNED NOT NULL,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `account_customer_id` BIGINT UNSIGNED NOT NULL,
  `role` VARCHAR(64) NOT NULL,                -- 'doctor' | 'employee' | 'client' | 'admin'
  `doctor_id` BIGINT UNSIGNED NULL,           -- FK lógica db_plexcare_care.doctor
  `client_id` BIGINT UNSIGNED NULL,           -- FK lógica db_plexcare_tenancy.client
  `employee_id` BIGINT UNSIGNED NULL,         -- FK lógica db_plexcare_tenancy.employee
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_idp_user_role` (`idp_user_id`,`account_id`,`role`),
  KEY `fk_idp_user_role_idp_user` (`idp_user_id`),
  KEY `fk_idp_user_role_account` (`account_id`,`account_customer_id`),
  CONSTRAINT `fk_idp_user_role_idp_user` FOREIGN KEY (`idp_user_id`) REFERENCES `idp_user`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_idp_user_role_account` FOREIGN KEY (`account_id`,`account_customer_id`) REFERENCES `account`(`id`,`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Nova tabela `idp_session` (refresh opaco):

```sql
CREATE TABLE `idp_session` (
  `id` CHAR(36) NOT NULL,                     -- UUID v4 = refresh_token (opaco)
  `idp_user_id` BIGINT UNSIGNED NOT NULL,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `client_id` VARCHAR(64) NOT NULL,           -- 'plexcare-platform-web' | 'plexcare-mobile' | ...
  `user_agent` VARCHAR(512) NULL,
  `ip_address` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `revoke_reason` VARCHAR(64) NULL,           -- 'logout' | 'password_changed' | 'admin_revoke' | 'reset'
  PRIMARY KEY (`id`),
  KEY `idx_idp_session_user` (`idp_user_id`),
  KEY `idx_idp_session_expires` (`expires_at`),
  CONSTRAINT `fk_idp_session_user` FOREIGN KEY (`idp_user_id`) REFERENCES `idp_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Nova tabela `idp_signing_key` (rotação de chave JWKS):

```sql
CREATE TABLE `idp_signing_key` (
  `kid` VARCHAR(64) NOT NULL,                 -- key id (JWKS)
  `alg` VARCHAR(16) NOT NULL DEFAULT 'EdDSA',
  `public_jwk` JSON NOT NULL,
  `private_jwk_encrypted` BLOB NOT NULL,      -- AES-GCM com KEK do KMS / env var em dev
  `status` VARCHAR(16) NOT NULL,              -- 'active' | 'previous' | 'retired'
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rotated_at` DATETIME(3) NULL,
  PRIMARY KEY (`kid`),
  KEY `idx_idp_key_status` (`status`)
) ENGINE=InnoDB;
```

## Arquitetura — NestJS modular + Prisma

```
platform/backend/plexcare-idp-api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts                  bootstrap (helmet, cors, otel, validation pipe)
│   ├── app.module.ts
│   ├── config/                  env validation (zod)
│   ├── modules/
│   │   ├── auth/                signup, forgot, reset, change-password
│   │   ├── authorize/           POST /auth/login → PKCE code (usa authorize_state)
│   │   ├── token/               POST /token (code→jwt), refresh, revoke
│   │   ├── jwks/                /.well-known/jwks.json (Ed25519 público)
│   │   ├── users/               /me, /me/roles, /me/switch-account
│   │   ├── sessions/            listar/revogar idp_session
│   │   ├── keycloak/            adapter HTTP Admin API + Direct Grant
│   │   ├── outbox/              worker poll → Kafka (CloudEvents 1.0)
│   │   ├── lockout/             anti-bruteforce (email + IP)
│   │   └── health/              /health, /ready
│   └── shared/
│       ├── crypto/              jose Ed25519 signer + JWKS rotation
│       ├── prisma/              PrismaService global
│       ├── kafka/               KafkaJS producer wrapper
│       └── errors/              AppException + global filter
└── test/                        e2e Jest + SuperTest + Testcontainers
```

## Endpoints REST

| Método | Path | Quem chama | Resposta |
|---|---|---|---|
| `POST` | `/auth/signup` | login-web | `202` (verificação por email) |
| `POST` | `/auth/login` | login-web | `200 { code, state, redirect_uri }` |
| `POST` | `/auth/forgot-password` | login-web | `204` neutro |
| `POST` | `/auth/reset-password` | login-web | `204` (invalida sessões) |
| `POST` | `/auth/change-password` | autenticado | `204` (invalida outras sessões) |
| `POST` | `/auth/email/verify` | callback de email | `200` |
| `POST` | `/token` | platform-web | `200 { access_jwt, refresh, id_token, expires_in }` |
| `POST` | `/token/refresh` | platform-web | `200 { access_jwt, refresh }` (rotação) |
| `POST` | `/token/revoke` | platform-web (logout) | `204` |
| `GET` | `/me` | autenticado | `200 { idp_user_id, customer, account, roles[] }` |
| `GET` | `/me/roles` | autenticado | `200 [{ account, role, doctor_id? }]` |
| `POST` | `/me/switch-account` | autenticado | `200 { access_jwt, refresh }` (re-emite) |
| `GET` | `/me/sessions` | autenticado | `200 [{ id, device, ip, last_used_at }]` |
| `DELETE` | `/me/sessions/:id` | autenticado | `204` |
| `GET` | `/.well-known/jwks.json` | qualquer service | `200 { keys: [...] }` |
| `GET` | `/health` | k8s | liveness |
| `GET` | `/ready` | k8s | readiness (DB + KC) |

## Compliance & segurança

- **Senha never-touch**: Direct Grant repassa direto ao KC; payload descartado após chamada
- **`authorize_state`** expira em 5 min; job de purga (`@Cron('*/1 * * * *')`) limpa expirados
- **Refresh opaco** em `idp_session`; rotação a cada uso; revoga em logout / change-password / reset-password / admin
- **Lockout**: chaves `email:<x>` e `ip:<x>`; janela 5 min; threshold 5 tentativas → block 15 min
- **Resposta neutra** em `/auth/forgot-password` (não enumera contas)
- **Audit via outbox**: `idp.user.signed_up`, `idp.user.email_verified`, `idp.session.created`, `idp.session.revoked`, `idp.user.password_changed`, `idp.role.assigned`, `idp.role.revoked`
- **LGPD**: PII em logs hash (email → sha256 trunc); tracing OTel sem body de senha; consent log via outbox vinculado a `idp_user_id`
- **OWASP ASVS L1**: senha ≥ 12 chars + variedade (validação backend canônica; login-web faz UI hint)
- **HTTPS only**, `Secure` em cookies (não usamos cookies de sessão IdP, mas qualquer cookie auxiliar)
- **CORS**: whitelist `login-web` (5175), `platform-web` (TBD), `localhost:5175/5176` em dev

## Eventos publicados (CloudEvents 1.0 JSON)

| Tópico Kafka | Type | Quando |
|---|---|---|
| `idp.user.v1` | `idp.user.signed_up` | após criação no KC + idp_user |
| `idp.user.v1` | `idp.user.email_verified` | após click no link |
| `idp.user.v1` | `idp.user.password_changed` | reset ou change |
| `idp.session.v1` | `idp.session.created` | POST /token sucesso |
| `idp.session.v1` | `idp.session.revoked` | logout, reset, admin |
| `idp.session.v1` | `idp.session.login_failed` | direct grant negou (sem detalhar motivo no payload externo) |
| `idp.role.v1` | `idp.role.assigned` | INSERT em `idp_user_role` |
| `idp.role.v1` | `idp.role.revoked` | UPDATE `revoked_at` em `idp_user_role` |

Envelope CloudEvents:

```json
{
  "specversion": "1.0",
  "id": "<event_id UUID>",
  "source": "plexcare-idp-api",
  "type": "idp.session.created",
  "subject": "idp_user/<id>",
  "time": "2026-06-03T14:23:11Z",
  "datacontenttype": "application/json",
  "data": { /* payload tipado por evento */ },
  "tenantid": "<account_id>"
}
```

## Estratégia de testes

| Camada | Stack | Cobertura mínima |
|---|---|---|
| Unit | Jest + jest-mock-extended | regras: PKCE (challenge match), lockout (threshold), token issuance (claims corretos), refresh rotation |
| Integration | Prisma + Testcontainers MySQL | repos `idp_user`, `idp_user_role`, `idp_session`, outbox INSERT atomicidade |
| e2e | SuperTest + Testcontainers (MySQL + Kafka + Keycloak dev) | jornadas: signup→login→token→me→refresh→logout; reset por email; troca de account |

TDD obrigatório nas regras de segurança (D8). Cobertura ≥ 90% em `auth/`, `authorize/`, `token/`.

## Observabilidade

- **Traces**: OpenTelemetry HTTP server + Prisma + KafkaJS + outgoing HTTP (KC)
- **Métricas Prometheus**:
  - `idp_login_total{result="success|failure|lockout"}`
  - `idp_token_issued_total{client_id}`
  - `idp_refresh_rotation_total`
  - `idp_outbox_lag_seconds` (now - oldest unpublished)
  - `idp_kc_request_duration_seconds`
- **Logs** JSON estruturados (pino), redação de senha automática
- **Health**: `/health` (process alive), `/ready` (DB ping + KC `/health` upstream)
- **Alertas**:
  - login failure rate > 30% por 5 min
  - outbox_lag_seconds > 60s por 2 min
  - kc_request_duration p95 > 500ms por 5 min

## Riscos & questões abertas

| # | Risco / Pergunta | Quando endereçar |
|---|---|---|
| R1 | Divergência arquitetural (modular Nest vs hexagonal Go do `teleconf-service`) — manutenção mental dual | Em `/blueprint`: avaliar custo de migrar para hexagonal antes do primeiro release prod |
| R2 | Trocar provedor de hash da senha (sair de KC) exigiria rework completo do Direct Grant | Documentar em ADR; revisitar se KC virar bloqueador |
| R3 | Rotação de chave Ed25519 manual em dev (cron em prod) — risco de chave única em produção long-lived | Definir cron + KMS em `/blueprint` |
| R4 | platform-web ainda não existe — `redirect_uri` whitelist começa vazia | Adicionar issue para criar `plexcare-platform-web` em paralelo |
| R5 | Email verification flow precisa de provider SMTP — não definido | `/blueprint`: AWS SES vs Mailgun vs Postmark; em dev, MailHog |
| R6 | Multi-cliente OIDC: vamos precisar de tabela `idp_client` com `client_id`, `redirect_uris[]`, `audience` | Adicionar no schema durante `/blueprint` |
| R7 | MFA (TOTP, WebAuthn) **fora de escopo** desta primeira versão — só password | Tracker como follow-up |
| R8 | Social login (Google/Apple) hoje na UI redireciona pra KC — fluxo de callback no idp-api ainda não desenhado | Detalhar em `/blueprint` |

## Decisões NÃO tomadas (vão para `/blueprint`)

- Estratégia de migration do schema (Prisma migrate vs schema.sql versionado)
- Layout final de Dockerfile + docker-compose dev
- Convenção de error codes (espelhar `AuthError.code` do login-web?)
- TTL exato do access JWT (sugestão: 15 min) e refresh (sugestão: 30 dias)
- Estratégia de teste E2E com Keycloak (realm dev pre-seed via Admin CLI)
- Detalhamento do `/callback` social

## Checkpoint /feature

- [x] `/discovery` concluído
- [ ] `/blueprint` — pendente (próxima sessão, `/clear` antes)
- [ ] `/spec`
- [ ] `/tdd`
- [ ] `/review`
- [ ] `/qa`

> **Para retomar**: abrir nova sessão, rodar `/blueprint crie a api do idp …` carregando este arquivo como contexto. O `/blueprint` deve detalhar componentes, contratos OpenAPI, dependências, sequence diagrams completos.
