# PlexCare — Onboarding Guide

## Project Overview

| | |
|---|---|
| **Produto** | PlexCare — plataforma SaaS de telemedicina ("sala virtual"), concorrente Twilio Video, mercado BR |
| **Repo** | `bernard-code-lab/plexcare` (branch `feat/monorepo-scaffold`) |
| **Modelo** | Multi-tenant B2B — clinicas/hospitais com config, API keys, limites de plano, billing por minuto |
| **Compliance** | LGPD, CFM 2.314/2022, SRTP, TLS 1.3, S3 SSE-KMS |

### Tech Stack

| Camada | Tecnologias |
|---|---|
| Frontend | Vite + React 18 + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | NestJS (Node) ou Go, PostgreSQL, Redis, Kafka/SQS, Stripe/Iugu |
| Media/WebRTC | LiveKit SFU (Go + Pion), coturn (TURN), Egress -> S3 |
| Cloud | AWS EKS, Terraform, GitHub Actions |

---

## Architecture — Monorepo com 4 Modulos

| Modulo | Responsabilidade | Agentes Associados |
|---|---|---|
| `plexcare-backend` | APIs, dominio, regras de negocio | [02] Sr. Engineer, [04] QA |
| `plexcare-frontend` | Web app, design system, portais | [03] Fullstack, [05] E2E |
| `plexcare-infra` | IaC (Terraform), EKS, Helm, CI/CD | [06] DevOps |
| `plexcare-sre` | Observabilidade, SLOs, runbooks | [07] SRE |

---

## 7 Agent Specialties (Claude Prompts)

### [00] Contexto Compartilhado

Base de conhecimento incluida como prefixo em todos os agentes. Define produto, repo, stack e modelo de negocio.

### [01] Solutions Architect

- Decisoes arquiteturais (ADRs), trade-offs custo/complexidade/TTM
- Valida compliance LGPD + CFM 2.314/2022
- Responde com: restate -> opcoes -> recomendacao -> riscos -> ADR

### [02] Software Engineer Senior

- Backend `plexcare-backend` (NestJS/Go)
- **TDD estrito**: Red -> Green -> Refactor, table-driven tests
- DDD: entidades, value objects, Ports & Adapters
- Modulos: `RoomService`, `UsageMeteringService`, `WebhookHandler`, `TenantConfigService`
- Cobertura >= 90% em dominio

### [03] Fullstack Engineer

- Frontend + Backend quando feature cruza camadas
- Design system "dark-luxury": teal (#14B8A6), dourado (#E3B341), fundo quase-preto
- Tipografia: Cabinet Grotesk (titulos), Switzer (corpo)
- LiveKit: `@livekit/components-react`, `<LiveKitRoom>`, `<VideoConference>`
- Features: waiting room, sala virtual, pos-consulta, portal do tenant

### [04] QA Engineer

- Test cases no formato estruturado (ID, pre-condicoes, passos, severidade)
- Piramide: Unit 70% / Integration 20% / E2E 10%
- 6 categorias de risco: authn, sala virtual, billing, gravacao, multi-tenancy, compliance
- Fluxos criticos = BLOQUEADORES de release

### [05] E2E Engineer

- Playwright + TypeScript, Page Object Model
- 5 fluxos criticos: consulta completa, auth tenant, waiting room, falha conexao, billing E2E
- WebRTC: `--use-fake-ui-for-media-stream` flags
- Sempre `data-testid`, nunca CSS selectors

### [06] DevOps Platform Engineer

- CI/CD: GitHub Actions com path filters por modulo
- Ambientes: dev / staging / prod no AWS EKS
- Gates prod: testes + lint + Trivy scan + aprovacao manual
- LiveKit K8s: `hostNetwork: true`, node group dedicado, 1 pod/node
- Terraform modular: `modules/{vpc,eks,livekit,rds,elasticache,s3,kafka,coturn}`

### [07] SRE Infra Engineer

- SLOs definidos (Room API 99.9%, LiveKit setup <3s 95%, WebRTC falha <1%, etc.)
- Stack: OpenTelemetry -> Tempo/Prometheus/Loki/Grafana
- Metricas obrigatorias: `http_requests_total`, `room_active_total`, `billing_events_total`
- Runbooks estruturados, postmortems blameless
- Alertas burn-rate (MWMB)

---

## Como Usar os Prompts

1. **Claude Projects**: Crie 1 Project por especialidade, cole o prompt no "Project Instructions"
2. **Cursor / Claude Code**: Cole no `CLAUDE.md` do modulo correspondente
3. **Automacoes**: Use como system prompt na API da Anthropic (CI/pipelines)
4. **Combinando agentes**: Solutions Architect -> Sr. Engineer -> QA -> DevOps (pipeline de feature)

---

## Key Domain Services

| Service | Funcao |
|---|---|
| `RoomService` | Criar/fechar sala via LiveKit API, gerar token JWT |
| `UsageMeteringService` | Registrar minutos por sala, publicar no Kafka |
| `WebhookHandler` | Processar eventos LiveKit (participant joined/left, room ended) |
| `TenantConfigService` | Limites de plano, features habilitadas por tenant |
| `RoomTokenService` | Gerar tokens com permissoes por role (doctor: publish+subscribe, patient: subscribe-only) |

---

## Complexity Hotspots

| Area | Por que e complexa |
|---|---|
| **LiveKit + WebRTC** | Host networking, UDP ports, TURN/coturn, reconexao, fake media em testes |
| **Multi-tenancy + Billing** | Isolamento entre tenants, metering por minuto, edge cases (0s, 1s), Kafka events |
| **Compliance** | LGPD consentimento gravado, CFM 2.314/2022, audit logs, SRTP, gravacao S3 com KMS |
| **CI/CD Monorepo** | Path filters por modulo, gates obrigatorios, Trivy scan, Helm deploy por ambiente |

---

## SLOs da Sala Virtual

| Servico | SLI | SLO |
|---|---|---|
| Room Service API | Disponibilidade (5xx rate) | 99.9% |
| LiveKit SFU | Latencia de setup < 3s | 95% das salas |
| Conexao WebRTC | Taxa de falha de conexao | < 1% |
| Egress (gravacao) | Gravacao disponivel em < 5min | 99% |
| Billing Metering | Eventos processados sem perda | 99.99% |
| Webhook delivery | Entregue em < 30s | 99.5% |
