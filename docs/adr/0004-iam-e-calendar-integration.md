# ADR-0004 — IAM com Keycloak + integração de calendars sociais

- **Data:** 2026-06-03
- **Status:** Proposed
- **Deciders:** Solutions Architect, DevOps Engineer
- **Tags:** `area/iam` `area/backend` `area/frontend` `compliance/lgpd` `compliance/cfm`

## Contexto

A PlexCare entrou na fase de **agendamento + sala virtual** integrados ([ADR-0003](0003-separacao-site-web-service.md)) e a página de marketing promete três coisas que ainda não temos contratos arquiteturais para:

1. **Login social** com Google, Apple e WhatsApp.
2. **Integração de agenda** com Google Calendar e Apple Calendar.
3. **Multi-tenant** — cada clínica é um tenant isolado, mas reaproveita a infra comum.

Forças em jogo:

- **Regulatório:** LGPD exige consentimento granular (e separado para tratamento médico × tratamento de calendar), CFM 2.314/2022 exige identificação do profissional habilitado.
- **Custo / time-to-market:** o time é pequeno; não podemos manter mil flows OAuth handcrafted nem um realm por cliente.
- **Realidade técnica:** WhatsApp **não tem OAuth público** — só Cloud API (OTP). Apple Calendar **não tem OAuth público** — só CalDAV ou EventKit. Documentar isso evita prometer o impossível.
- **Boundaries do monorepo:** `plexcare-teleconf-service` (sala) e `plexcare-schedule-api` (agenda) são bounded contexts separados; precisam compartilhar identidade sem se acoplar a um banco comum.

A infra Docker do Keycloak 26 já foi criada em `arch/infra/keycloak/`. Este ADR formaliza como os módulos conversam com ela.

## Decisão

**Keycloak 26 como IAM hub + token broker, com single-realm multi-tenant e token-exchange para chamar APIs de calendar.** Aplicado em cinco eixos:

### 1. Topologia de identidade

- **Single realm `plexcare`.** `tenant_id` vive como **user attribute** mapeado em **claim JWT** (`tenant_id`).
- **Clientes OIDC já provisionados no realm:**
  - `plexcare-web` — public + PKCE (consumido por `site/` e `platform/plexcare-teleconf-web/`)
  - `plexcare-teleconf-service` — bearer-only (valida JWT)
  - `plexcare-schedule-api` — bearer-only (valida JWT + token-exchange)
- **Roles realm-scoped:** `tenant-admin`, `doctor`, `patient`, `platform-admin`.
- **Regra dura:** 1 user Keycloak = 1 tenant. Cross-tenant exige outro user (decisão consciente; simplifica claim, complicações reais aparecem só em SSO B2B futuro).
- **Escape hatch:** clientes enterprise (>1000 usuários OU SAML corporativo obrigatório) ganham realm dedicado depois — cobrado em plano separado.

### 2. Identity Providers (login social)

| Provider | Status | Caminho técnico |
|---|---|---|
| **Google** | ✅ MVP | IdP OIDC nativo, `storeToken=true`, scope inclui `calendar.readonly` (para o passo 4) |
| **Apple** | ✅ MVP | IdP nativo do KC, com Services ID + `.p8`. Apenas autenticação (Apple Calendar fica fora do escopo — ver §4) |
| **Facebook / Meta** | ✅ MVP | IdP nativo. Proxy do ecossistema Meta; **não é "WhatsApp login"** mas é o mais próximo que existe oficialmente |
| **WhatsApp OTP** | 🚧 Backlog | Authenticator SPI customizado em `arch/infra/keycloak/providers/whatsapp-otp.jar` usando WhatsApp Cloud API. Fluxo passwordless (digita telefone → recebe código → valida) |

### 3. Validação de JWT no backend Go

- **Validação offline via JWKS** (`github.com/coreos/go-oidc/v3`), cache de **10 min** com refresh sob `kid` desconhecido.
- **Sem introspection** no path crítico. Sessão curta (access token = 5 min, configurado no realm) compensa a ausência de revogação imediata.
- Middleware em `pkg/auth` (a criar) extrai `sub`, `tenant_id`, `roles` e injeta em `context.Context` — alinhado a [ADR-0002](0002-multi-tenancy-via-header-context.md).

### 4. Acesso a Google Calendar (`schedule-api`)

- **Token-exchange brokered** (feature `token-exchange` já habilitada no build do Keycloak).
- Fluxo: `schedule-api` recebe JWT PlexCare do usuário → chama `POST /auth/realms/plexcare/protocol/openid-connect/token` com `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`, `requested_issuer=google`, `subject_token=<JWT médico>` → recebe Google access token (KC renova via refresh on file).
- **NÃO guardamos refresh tokens Google em nossa DB.** Ficam no Keycloak. Schedule-api só guarda `sync_token` (incremental) e `watch_channel_id` (push notifications) por user.
- **Reconcile:** job diário via `syncToken`; renewal de watch channels a cada 6 dias (Google expira em 7).
- **Fallback de erro:** 401 + `invalid_grant` → marca `calendar_links.revoked_at` e notifica usuário; não retry infinito.

### 5. Apple Calendar e WhatsApp

- **Apple Calendar:** explicitamente **fora do MVP**. Não há OAuth público. CalDAV exige app-specific password (UX terrível para B2B); EventKit só funciona em app nativo. A landing page será corrigida para "Sincronização com Google Calendar (em breve: Outlook)" — Apple só como autenticação.
- **WhatsApp:**
  - **Channel** (notificações de agendamento, lembretes) sai primeiro — Schedule-api consome evento `appointments.scheduled.v1` do Kafka e envia template via Cloud API.
  - **Login WhatsApp OTP** entra em backlog separado (SPI customizado), depois do MVP de agenda.

### Diagrama de fluxo canônico

```
SPA → AuthCode+PKCE → Keycloak ──(IdP Google c/ storeToken)──→ Google
                       │
                       ↓ JWT PlexCare (claim: tenant_id)
              ┌────────┴────────┐
              ↓                 ↓
      teleconf-service   schedule-api
        valida JWKS       valida JWKS
        cria sala         CRUD agenda
                          │
                          ↓ token-exchange (subject=JWT médico)
                       Keycloak ──→ Google access_token
                          │
                          ↓ Calendar API
                       Google
                          │
                          ↓ events
                       schedule-api → calendar_events (tenant_id)
                                    → Kafka "appointments.scheduled.v1"
                                       │
                                       ↓
                                  teleconf-service provisiona sala
```

## Consequências

**Positivas**

- Refresh tokens externos ficam **blindados no Keycloak** — backend nunca toca secret de longa duração de provider externo.
- Single realm escala para milhares de tenants sem operação de criação de realm a cada onboarding.
- Schedule-api fica **stateless quanto a credentials**: pode escalar horizontalmente sem replicar refresh tokens.
- Token-exchange dá compose composability: amanhã, se quisermos Outlook, basta adicionar IdP Microsoft no realm — sem mudar código.
- Compliance LGPD: consentimentos granulares ficam em tabelas dedicadas (`schedule.consents`, `teleconf.recording_consents`), separados do OAuth — facilita auditoria e direito de exclusão.

**Negativas / Trade-offs**

- Keycloak vira componente **hard dependency** para Schedule-api (token-exchange). Se KC cai, agenda externa para de sincronizar (sala virtual ainda funciona com tokens em cache). Mitigação: HA do KC em prod (3 réplicas EKS), SLO 99.95%.
- Token-exchange brokered ainda é **feature `v2`/preview** no KC para alguns providers. Spike de validação é obrigatório (R1 abaixo).
- Apple Calendar fora do MVP frustra parte da audiência Apple. Compensamos com clareza de marketing e roadmap de app nativo.
- "1 user KC = 1 tenant" pode incomodar usuários que trabalham em 2 clínicas (médico itinerante). Decisão consciente; resolveremos com flow de "convite cross-tenant" (cria outra identidade) quando feedback surgir.

**Neutras / a observar**

- Cron de rotação do Apple `client_secret` (JWT de 6 meses) precisa virar runbook SRE antes do Apple ir a prod.
- Métricas a observar: `iam_token_exchange_duration_p99`, `iam_jwks_cache_miss_rate`, `calendar_sync_token_invalidations`.
- Custo KC: dimensionado para ~10k users ativos em t3.medium (single AZ dev); revisar em 50k.

## Alternativas consideradas

### Alternativa A — Refresh tokens externos no nosso DB (cifrados com KMS)

- Prós: Schedule-api independente do Keycloak para sync jobs em background.
- Contras: Nós guardamos secret de longa duração (PII sensível LGPD), duplicamos consentimento OAuth, complexidade de rotação.
- Por que não: o ganho de desacoplamento não compensa o risco LGPD e o esforço de KMS + rotação.

### Alternativa B — Service Account com domain-wide delegation (Google Workspace)

- Prós: Sem refresh token por user; uma chave serve para impersonation no domínio.
- Contras: Só funciona para clínicas Google Workspace (não para Gmail pessoal); impersonation em contexto de saúde é polêmico e exige acordos formais com cada Workspace admin.
- Por que não: cobre fração pequena dos clientes e adiciona complexidade legal desproporcional.

### Alternativa C — Um realm por tenant

- Prós: Isolamento total; clientes podem trazer IdP corporativo próprio sem ferir outros.
- Contras: Onboarding precisa criar realm via API (operações), admin SPA precisa multi-realm awareness, custo operacional cresce linearmente.
- Por que não: escala mal para milhares de tenants pequenos. Single-realm + claim cobre 95% dos casos; enterprise vira realm dedicado quando justificar revenue.

### Alternativa D — Integrar Apple Calendar via CalDAV com app-specific password

- Prós: Marketing original poderia ser mantido.
- Contras: UX exige usuário ir no appleid.com gerar password manualmente; Apple desencoraja CalDAV em produtos B2B; suporte da PlexCare vai precisar guiar cada usuário.
- Por que não: friction de onboarding altíssimo para benefício marginal. Apple Calendar real vem com app nativo no roadmap.

### Alternativa E — Próprio sistema de auth (sem Keycloak)

- Prós: Zero dependência externa, total controle.
- Contras: Reescrevemos OIDC, gerenciamento de IdP, MFA, audit log, password policy, brute-force protection — meses de trabalho para reinventar algo melhor que comoditizado.
- Por que não: viola "Simples operacional > elegante técnico". Keycloak resolve em config.

## Plano de revisão

Reavaliar esta ADR se:

- **Token-exchange brokered não funcionar** na validação técnica (R1) → fallback para Alternativa A com KMS.
- **Chegarmos a >50k usuários ativos** no realm `plexcare` → considerar sharding de realms por região/segmento.
- **Cliente enterprise pedir SAML corporativo bloqueante** → instanciar realm dedicado e formalizar processo.
- **Apple Calendar abrir API OAuth pública** (improvável, mas WWDC surpreende) → revisar §5.
- **WhatsApp Business publicar Login API** (idem) → trocar Authenticator SPI custom por IdP nativo.

## Riscos a validar (spikes antes de codar)

| ID | Risco | Spike |
|---|---|---|
| R1 | Token-exchange brokered (`requested_issuer=google`) pode falhar com policy incorreta | 1 dia: configurar IdP Google com `storeToken=true` + policy `idp-token-exchange` + curl com JWT real → Google AT funcional |
| R2 | Refresh token revogado pelo user no myaccount.google.com não notifica o KC | Testar revoke manual → confirmar que próximo exchange retorna `invalid_grant`; implementar handler |
| R3 | Apple client_secret JWT expira em 6 meses; esquecer = login Apple morre | Documentar runbook + criar issue para automação SRE |
| R4 | Calendar watch channels expiram em 7 dias e silenciosamente param de empurrar eventos | Job de renewal a cada 6 dias + reconcile diário via syncToken como cinto de segurança |
| R5 | LGPD direito de exclusão: usuário pede delete → temos que apagar de KC + schedule + teleconf + S3 atomicamente | Desenhar saga `user.deletion.v1` em ADR futuro (não bloqueia este) |

## Referências

- ADR relacionadas: [ADR-0001](0001-kafka-como-event-bus-interno.md), [ADR-0002](0002-multi-tenancy-via-header-context.md), [ADR-0003](0003-separacao-site-web-service.md)
- Infra Docker do Keycloak: `arch/infra/keycloak/README.md`
- Keycloak token-exchange (v2): https://www.keycloak.org/docs/latest/securing_apps/index.html#token-exchange
- Google Calendar incremental sync: https://developers.google.com/calendar/api/guides/sync
- Google Calendar push notifications: https://developers.google.com/calendar/api/guides/push
- Sign in with Apple at Keycloak: https://www.keycloak.org/docs/latest/server_admin/#_apple
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- LGPD art. 7º, 8º, 18 — consentimento e direitos do titular
- CFM 2.314/2022 — identificação de profissional habilitado em telemedicina
