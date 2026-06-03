# PlexCare — Keycloak IAM

Setup Docker do servidor de identidade da PlexCare. Centraliza login (social e local), emissão de access tokens para `plexcare-teleconf-service` / `plexcare-schedule-api`, e fluxos de consentimento/registro.

> **Pasta canônica:** `arch/infra/keycloak/`. Em produção a stack equivalente será gerenciada por Terraform + Helm chart oficial do Keycloak no EKS — este compose é dev/staging.

---

## TL;DR

```bash
cd arch/infra/keycloak

# 1) Configuração local
cp .env.example .env
# Edite .env — no mínimo: KC_DB_PASSWORD, KC_BOOTSTRAP_ADMIN_PASSWORD

# 2) Sobe stack (postgres + keycloak)
docker compose up -d --build

# 3) Aguarda health (pode levar 60-90s no primeiro boot)
docker compose ps

# 4) Wirea credenciais OAuth dos socials (idempotente)
./scripts/configure-providers.sh

# 5) Acessa
open http://localhost:8080/auth/admin
```

Login admin: usuário `admin`, senha do `KC_BOOTSTRAP_ADMIN_PASSWORD`.
Realm de produto: `plexcare`.

---

## O que está incluso

| Arquivo | Função |
|---|---|
| `Dockerfile` | Build em 2 fases. Roda `kc.sh build` com Postgres + features `token-exchange`, `admin-fine-grained-authz`, `declarative-user-profile` |
| `docker-compose.yml` | Postgres 16 + Keycloak 26 + health checks + network isolada |
| `.env.example` | Todas as variáveis necessárias (DB, admin, providers) |
| `realm/plexcare-realm.json` | Realm `plexcare` pré-configurado: clients (web SPA + 2 bearer-only), 4 roles (tenant-admin, doctor, patient, platform-admin), policies de senha CFM-friendly, brute-force protection, eventos auditáveis |
| `postgres/init.sql` | Extensões `uuid-ossp` + `pgcrypto`, timezone UTC |
| `scripts/configure-providers.sh` | Wirea Google/Apple/Facebook via `kcadm.sh` lendo `.env` (idempotente — pode rodar em rotação de secret) |
| `providers/` | Diretório para `.jar` de SPIs customizados (futuro WhatsApp OTP) |

---

## Identity Providers configurados

| Provider | Status | Caminho de configuração |
|---|---|---|
| **Google** | ✅ Pronto | Console Google Cloud → OAuth Client → Web → redirect URI `http://localhost:8080/auth/realms/plexcare/broker/google/endpoint`. Inclui escopo `calendar.readonly` para Google Calendar |
| **Apple** | ✅ Pronto | Apple Developer → Services ID + Sign In with Apple Key (.p8). Conteúdo da `.p8` vai em `APPLE_CLIENT_SECRET`. Cobre Apple Calendar implicitamente (via Apple ID — Apple Calendar não tem OAuth próprio, integração CalDAV é separada) |
| **Facebook / Meta** | ✅ Pronto | Facebook Developers → Facebook Login product. Usado como proxy para o ecossistema Meta (incluindo identidade WhatsApp Business) |
| **WhatsApp OTP (passwordless)** | ⚠️ Stub | WhatsApp não oferece OAuth público. Login "com WhatsApp" precisa de um Authenticator SPI customizado que use a [Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api). Pasta `providers/` está pronta para receber o `.jar` — ver [`providers/README.md`](./providers/README.md) |

### Sobre as integrações de Calendar mencionadas no produto

- **Google Calendar** — OAuth scope já incluso (`calendar.readonly`). O access token do Google fica disponível para `plexcare-schedule-api` via [token exchange](https://www.keycloak.org/docs/latest/securing_apps/index.html#token-exchange) (feature já habilitada no Dockerfile).
- **Apple Calendar** — Não há OAuth público para Apple Calendar. Integração real exige CalDAV com app-specific password ou EventKit em apps nativos. O Sign In with Apple aqui cobre só autenticação; sync de calendário fica fora do escopo do Keycloak.

---

## Setup de cada provider (passo a passo)

### Google (10 min)

1. Acesse https://console.cloud.google.com/apis/credentials
2. **Create credentials → OAuth client ID → Web application**
3. **Authorized JavaScript origins:** `http://localhost:8080`
4. **Authorized redirect URIs:** `http://localhost:8080/auth/realms/plexcare/broker/google/endpoint`
5. Copie `Client ID` e `Client secret` para `.env`:
   ```bash
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```
6. Para liberar o scope de Calendar: **APIs & Services → Library → Google Calendar API → Enable**
7. Rode `./scripts/configure-providers.sh`

### Apple (30-60 min — é o mais chato)

1. Apple Developer → **Certificates, Identifiers & Profiles**
2. **Identifiers → +** → **App IDs** → tipo App. Habilite **Sign In with Apple**
3. **Identifiers → +** → **Services IDs** → será o `APPLE_CLIENT_ID` (ex.: `com.plexcare.auth`). Configure **Sign In with Apple** com:
   - **Primary App ID:** o que criou no passo 2
   - **Domains:** `localhost` (dev) ou `auth.plexcare.com.br` (prod)
   - **Return URLs:** `http://localhost:8080/auth/realms/plexcare/broker/apple/endpoint`
4. **Keys → +** → habilite **Sign In with Apple** → baixe `.p8`. Anote o **Key ID**.
5. No Apple Developer, anote o **Team ID** (canto sup. dir.)
6. Preencha o `.env`:
   ```bash
   APPLE_CLIENT_ID=com.plexcare.auth
   APPLE_TEAM_ID=ABCD123456
   APPLE_KEY_ID=AB12CD34EF
   # Conteúdo INTEIRO do .p8 incluindo as linhas BEGIN/END
   APPLE_CLIENT_SECRET="-----BEGIN PRIVATE KEY-----
   MIGT...
   -----END PRIVATE KEY-----"
   ```
7. Rode `./scripts/configure-providers.sh`

### Facebook / Meta

1. https://developers.facebook.com/apps → **Create app** → tipo **Consumer**
2. Adicione o produto **Facebook Login → Settings**
3. **Valid OAuth Redirect URIs:** `http://localhost:8080/auth/realms/plexcare/broker/facebook/endpoint`
4. **App settings → Basic** → copie **App ID** e **App Secret**
5. Preencha `.env`:
   ```bash
   FACEBOOK_CLIENT_ID=...
   FACEBOOK_CLIENT_SECRET=...
   ```
6. Rode `./scripts/configure-providers.sh`

---

## Endpoints úteis

| URL | Função |
|---|---|
| `http://localhost:8080/auth/admin` | Console admin |
| `http://localhost:8080/auth/realms/plexcare/.well-known/openid-configuration` | Discovery do OIDC (para clientes) |
| `http://localhost:8080/auth/realms/plexcare/account` | Conta do usuário final |
| `http://localhost:9000/health/ready` | Health probe (porta management) |
| `http://localhost:9000/metrics` | Métricas Prometheus |

---

## Compliance (LGPD + CFM 2.314/2022)

Decisões já refletidas no realm:

- **`registrationEmailAsUsername=true`** — evita coleta extra de PII (username separado)
- **`verifyEmail=true`** — email confirmado é pré-requisito (auditoria)
- **`bruteForceProtected=true`** com 5 falhas → wait 60s, max 900s
- **Password policy 12+ caracteres** + maiúscula/minúscula/dígito/especial + histórico de 5 + expiração 90d
- **WebAuthn habilitado** (ES256/RS256) — caminho para passkeys
- **Eventos persistidos** com TTL configurado (LGPD: anonimização sob demanda exige acesso ao log)
- **Default locale `pt-BR`** + suporte a `en`/`es`

> **Antes de produção:** revisar com o time de SRE — habilitar Backup do Postgres (RDS automated snapshots), rotação de admin password via Secrets Manager, e KMS para o keystore do realm (export de chaves de assinatura).

---

## Integração com os módulos PlexCare

| Módulo | Client ID | Tipo | Como usa |
|---|---|---|---|
| `site/` + `platform/plexcare-teleconf-web/` | `plexcare-web` | Public + PKCE | Authorization Code Flow no browser |
| `platform/plexcare-teleconf-service/` | `plexcare-teleconf-service` | Bearer-only | Valida JWT recebido no header `Authorization` |
| `platform/plexcare-schedule-api/` | `plexcare-schedule-api` | Bearer-only | Mesma validação + usa token-exchange p/ chamar Google Calendar API em nome do usuário |

JWKS endpoint para validação no backend Go:
```
http://localhost:8080/auth/realms/plexcare/protocol/openid-connect/certs
```

---

## Operações comuns

```bash
# Logs
docker compose logs -f keycloak

# Restart só do Keycloak (reaproveita Postgres)
docker compose restart keycloak

# Reset total (apaga TODOS os dados — só dev)
docker compose down -v

# Exportar realm atualizado (após mudanças no console)
docker exec plexcare-keycloak /opt/keycloak/bin/kc.sh export \
  --realm plexcare --dir /tmp/export --users realm_file
docker cp plexcare-keycloak:/tmp/export/plexcare-realm.json realm/

# Re-importar realm (CUIDADO: sobrescreve)
docker compose restart keycloak
```

---

## Próximos passos (roadmap)

- [ ] Implementar `whatsapp-otp.jar` (Authenticator SPI) usando WhatsApp Cloud API
- [ ] Helm chart para EKS — substitui este compose em staging/prod
- [ ] Terraform para AWS RDS Postgres + Secrets Manager — back-end do Keycloak
- [ ] Tema custom PlexCare (dark-luxury teal/dourado) em `themes/`
- [ ] User Federation com banco do tenant (caso clientes B2B queiram SSO contra AD próprio)
- [ ] Token-exchange flow validado entre `plexcare-schedule-api` ↔ Google Calendar
