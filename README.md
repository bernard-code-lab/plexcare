<p align="center">
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow" alt="Status" />
  <img src="https://img.shields.io/badge/go-1.26-00ADD8?logo=go&logoColor=white" alt="Go 1.26" />
  <img src="https://img.shields.io/badge/node-20-339933?logo=node.js&logoColor=white" alt="Node 20" />
  <img src="https://img.shields.io/badge/nestjs-10-EA2845?logo=nestjs&logoColor=white" alt="NestJS 10" />
  <img src="https://img.shields.io/badge/livekit-WebRTC-FF6B35" alt="LiveKit" />
  <img src="https://img.shields.io/badge/cloud-AWS%20EKS-FF9900?logo=amazonaws&logoColor=white" alt="AWS" />
  <img src="https://img.shields.io/badge/compliance-LGPD%20%7C%20CFM%202.314-green" alt="Compliance" />
</p>

# PlexCare

Plataforma SaaS B2B de telemedicina ("sala virtual"), focada no mercado brasileiro (médicos, clínicas, hospitais).

**Multi-tenant** — cada tenant tem sua configuração, API keys, limites de plano e faturamento por minuto de sala.

Produtos:
- **Sala virtual** — videoconsulta sobre LiveKit (SFU + WebRTC) com waiting room, gravação opcional e billing por minuto.
- **Agendamento inteligente** *(em scaffold)* — calendário multicanal com IA anti-no-show.
- **IdP próprio** *(em construção)* — Authorization Server OIDC-like com Keycloak oculto, JWT Ed25519 e refresh rotacionável.

---

## 🚀 Quickstart (dev novo — 5 minutos)

**Pré-requisitos** (verifique com `make doctor`): Docker Desktop, Node 20+, Go 1.26+, `jq`, `curl`, `uuidgen`, `openssl`. Em macOS: `brew install node go jq shellcheck`.

```bash
# 1. Clone + setup completo (instala deps, copia .env, gera prisma client)
git clone git@github.com:bernard-code-lab/plexcare.git
cd plexcare
make setup

# 2. Sobe tudo que você precisa para usar o produto de teleconferência
make up-product
# → sobe stack Docker (postgres, kafka, livekit, room-service) +
#   teleconf-web em background na porta 5174

# 3. Cria uma sala virtual de teste e abre no browser
make test-rooms
# → cria sala via API, imprime URLs para doctor + patient, abre no browser

# 4. Para derrubar tudo
make down-product
```

**Não sabe por onde começar? Use o menu interativo:**

```bash
make menu
```

Mostra todos os comandos com setas/número, agrupados por categoria (SETUP, PRODUTO TELECONFERENCIA, STACK, TESTES, DEV, UTIL).

**Listagem completa de comandos:**

```bash
make help
```

---

## 📁 Estrutura do repositório

```
plexcare/
├── Makefile                                       # Comandos de dev (make help)
├── scripts/                                       # Helpers shell (setup, doctor, up-product, …)
├── site/                                          # Site institucional (Vite + React + Tailwind)
├── platform/
│   ├── backend/
│   │   ├── plexcare-idp-api/                      # Authorization Server (NestJS + Prisma + MySQL)
│   │   ├── plexcare-teleconf-service/             # Backend Go da sala virtual
│   │   └── plexcare-schedule-api/                 # Agendamento (scaffold)
│   ├── frontend/
│   │   ├── plexcare-login-web/                    # Tela de login (Vite + React)
│   │   ├── plexcare-teleconf-web/                 # App da sala virtual (LiveKit client)
│   │   └── plexcare-platform-web/                 # Dashboard B2B (scaffold)
│   └── database/                                  # Dumps SQL versionados
├── docs/adr/                                      # Architecture Decision Records
└── tasks/                                         # Discovery/blueprint/spec de features ativas
```

> **Importante.** `site/` é estritamente institucional. Toda UI do produto sala virtual vive em `platform/frontend/plexcare-teleconf-web/` e fala com `platform/backend/plexcare-teleconf-service/`. Decisão registrada em [ADR-0003](docs/adr/0003-separacao-site-web-service.md).

---

## 🧭 Por onde começar (mapa de tarefas)

| Sua tarefa | Comece por |
|---|---|
| Subir o produto e clicar | `make up-product` + `make test-rooms` |
| Mexer no backend da sala | [`platform/backend/plexcare-teleconf-service/CLAUDE.md`](platform/backend/plexcare-teleconf-service/CLAUDE.md) |
| Mexer na UI da sala | [`platform/frontend/plexcare-teleconf-web/CLAUDE.md`](platform/frontend/plexcare-teleconf-web/CLAUDE.md) *(se existir)* |
| Mexer no site institucional | [`site/CLAUDE.md`](site/CLAUDE.md) |
| Mexer no IdP / auth | [`platform/backend/plexcare-idp-api/CLAUDE.md`](platform/backend/plexcare-idp-api/CLAUDE.md) + [spec ativa](tasks/idp-api-spec.md) |
| Entender decisões arquiteturais | [`docs/adr/README.md`](docs/adr/README.md) |
| Contexto global (compliance, convenções) | [`CLAUDE.md`](CLAUDE.md) na raiz |

---

## 🛠 Comandos mais usados

| Comando | O que faz |
|---|---|
| `make help` | Lista todos os comandos por categoria |
| `make menu` | Menu interativo numerado |
| `make doctor` | Diagnostica ferramentas + portas em uso |
| `make setup` | Bootstrap idempotente do ambiente |
| `make up-product` | Sobe tudo para usar o produto de teleconferência |
| `make down-product` | Derruba o que `up-product` subiu |
| `make up` / `make down` | Sobe/derruba toda a stack (teleconf + idp) |
| `make status` | Lista containers ativos |
| `make logs` | Tail dos logs Docker (teleconf) |
| `make test-rooms` | Smoke E2E: cria sala virtual + abre no browser |
| `make test-rooms-flow` | Mesmo, mas sem UI (CI-friendly) |
| `make test` | Roda todos os testes |
| `make lint` | shellcheck + linters |

Cada artefato (`plexcare-teleconf-service`, `plexcare-idp-api`, etc.) tem ainda comandos locais — leia o `CLAUDE.md` do módulo.

---

## ⚠️ Gotchas (não repetir)

- **Refatoração de paths com Docker rodando.** Se mover um `platform/**/docker-compose*.yml`, derrube primeiro com `make down` ou `docker compose -p plexcare-platform-dev down`, depois suba do path novo. Containers memorizam `working_dir` nos labels e ficam em loop de `Restarting`.
- **LiveKit API secret precisa ter ≥ 32 chars** (HMAC-SHA256). O dev stack já está correto; cuidado ao mexer.
- **Kafka usa listener dual** (`INTERNAL://kafka:9092` para containers, `EXTERNAL://localhost:29092` para o host). Tests integration usam `localhost:29092`.
- **NÃO testar sala em `https://meet.livekit.io`.** Mixed content + React #418 quebram a UI. Use o `plexcare-teleconf-web` local (sai pronto em `make up-product`).
- **`devtenant.Resolver` é FAKE** no `teleconf-service` — aceita qualquer UUID. Nunca subir em staging/prod (issue #3).

Detalhes completos em [`CLAUDE.md`](CLAUDE.md) (raiz) e nos `CLAUDE.md` dos módulos.

---

## 🏗 Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | Vite + React 18, Tailwind CSS, shadcn/ui, Framer Motion, React Router, TanStack Query, LiveKit Client SDK |
| **Backend Go** | Go 1.26, chi, pgx, zap, OpenTelemetry, LiveKit Server SDK |
| **Backend Node** | NestJS 10 + Fastify, Prisma 5, jose (Ed25519), kafkajs, pino, Zod |
| **Media / WebRTC** | LiveKit SFU (Go + Pion), coturn, Egress → S3 |
| **Data** | PostgreSQL 16 (teleconf), MySQL 8 (idp), Redis 7, Kafka (KRaft) |
| **Pagamentos** | Stripe / Iugu |
| **Cloud** | AWS EKS, Terraform, GitHub Actions |

---

## ✅ Compliance — não-negociável

| Requisito | Como atendemos |
|---|---|
| **LGPD** | Consentimento gravado, audit logs via outbox CloudEvents, anonimização sob demanda, PII hash no bus (email/CPF tokenizados) |
| **CFM 2.314/2022** | Regulamentação de telemedicina; identificação de profissional habilitado e paciente |
| **Criptografia** | SRTP (mídia), TLS 1.3 (APIs), S3 SSE-KMS (gravações), JWKS Ed25519 com KEK rotacionável |
| **Multi-tenancy** | Isolamento absoluto: todo claim de JWT e toda query carregam `account_id`/`tenant_id` |

Se um requisito conflita com compliance, **pare e levante a questão** antes de implementar.

---

## 📚 Documentação interna

| Doc | Para quê |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Context layer global — convenções, compliance, agentes |
| [`docs/adr/README.md`](docs/adr/README.md) | ADRs (Kafka, multi-tenancy, IdP, outbox, etc.) |
| [`site/docs/ONBOARDING.md`](site/docs/ONBOARDING.md) | Guia completo de arquitetura + SLOs |
| [`tasks/`](tasks/) | Discovery → blueprint → spec de features ativas |
| `platform/**/CLAUDE.md` | Load-bearing files + gotchas de cada módulo |

---

## 🤖 Agentes Claude (assistência IA)

7 agentes especializados disponíveis como slash commands no Claude Code:

| Comando | Quando invocar |
|---|---|
| `/solutions-architect` | Decisões arquiteturais, ADRs, trade-offs, compliance |
| `/software-engineer` | Backend Go/NestJS com TDD + table-driven tests |
| `/fullstack-engineer` | React + LiveKit SDK, design system, UI |
| `/qa-engineer` | Test cases, risco, matriz de cobertura |
| `/e2e-engineer` | Playwright, Page Objects, WebRTC tests |
| `/devops-platform-engineer` | Terraform, EKS, Helm, GitHub Actions |
| `/sre-infra-engineer` | SLOs, OpenTelemetry, runbooks, alertas |

Slash commands rápidos: `/feature` (pipeline completo), `/tdd` (red-green-refactor), `/adr` (escreve ADR), `/qa` (matriz de teste).

Prompts canônicos em [`plexcare_agent_prompts.pdf`](plexcare_agent_prompts.pdf).

---

## 🆘 Ajuda

- **Comando travou ou erro estranho?** `make doctor` mostra portas em uso, ferramentas faltando, containers no estado errado.
- **Container em `Restarting`?** Veja a seção **Gotchas** acima — quase sempre é path antigo no compose após refactor.
- **Bug ou dúvida arquitetural?** Abra issue no GitHub. Para bugs de produção, ver runbook do módulo afetado.
