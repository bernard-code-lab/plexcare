# PlexCare — Monorepo Control Layer

> Este arquivo é o **context layer** carregado automaticamente por Claude Code em qualquer task neste repositório. Mantenha-o conciso, factual e em pt-BR.

## Produto

**PlexCare** é uma plataforma SaaS B2B de telemedicina ("sala virtual"), concorrente do Twilio Video, focada no mercado brasileiro de saúde (médicos, clínicas, hospitais). Multi-tenant — cada tenant tem sua configuração, API keys, limites de plano e faturamento por minuto de sala.

## Mapa do monorepo

```
plexcare/
├── site/                              Marketing site (Vite + React 18 + Tailwind)
├── platform/
│   ├── plexcare-teleconf/             Sala virtual: room, metering, webhooks LiveKit (Go 1.23)
│   └── plexcare-schedule-api/         Agendamento inteligente (Go 1.23, scaffold)
└── plexcare_agent_prompts.pdf         Fonte canônica dos 7 agentes Claude
```

> **Nota:** O PDF original menciona módulos `plexcare-backend/frontend/infra/sre`. A estrutura real usa `site/` + `platform/plexcare-*`. Os módulos de **infra** (Terraform/EKS/Helm) e **SRE** (Grafana/runbooks) ainda não foram criados — quando forem, irão para `platform/plexcare-infra/` e `platform/plexcare-sre/`.

## Stack canônica

| Camada | Tecnologias |
|---|---|
| Frontend | Vite + React 18 + JS/TS, Tailwind CSS v3, shadcn/ui, Framer Motion, Radix UI |
| Backend | Go 1.23 (chi, pgx, zap, OpenTelemetry) — NestJS pode ser adotado conforme caso |
| Mídia/WebRTC | LiveKit SFU (Go + Pion), coturn (TURN), Egress → S3 |
| Dados | PostgreSQL 16, Redis 7, Kafka (KRaft) / SQS |
| Pagamentos | Stripe / Iugu |
| Cloud | AWS EKS, Terraform, GitHub Actions |

## Agentes Claude

Sete especialistas disponíveis como skills invocáveis. Para uma feature complexa, encadeie: Architect → Software Engineer → QA → DevOps.

| Comando | Agente | Quando invocar |
|---|---|---|
| `/solutions-architect` | Solutions Architect | Decisões arquiteturais, ADRs, trade-offs, compliance |
| `/software-engineer` | Software Engineer Sr. | Backend Go/NestJS com TDD + table-driven tests |
| `/fullstack-engineer` | Fullstack Engineer | React + LiveKit SDK, design system, UI |
| `/qa-engineer` | QA Engineer | Test cases, risco, matriz de cobertura |
| `/e2e-engineer` | E2E Engineer | Playwright, Page Objects, WebRTC tests |
| `/devops-platform-engineer` | DevOps Platform | Terraform, EKS, Helm, GitHub Actions |
| `/sre-infra-engineer` | SRE Infra | SLOs, OpenTelemetry, runbooks, alertas |

Slash commands rápidos: `/tdd` (ciclo red-green-refactor), `/adr` (escreve ADR), `/qa` (matriz de teste).

## Compliance — não-negociável

A PlexCare opera sob regulação de telemedicina brasileira. **Toda mudança que toca dados de paciente, gravação ou consentimento deve preservar:**

- **LGPD** — consentimento gravado, audit log, anonimização sob demanda
- **CFM 2.314/2022** — regulamentação de telemedicina (consulta deve ser entre profissional habilitado e paciente identificado)
- **Criptografia** — SRTP em mídia, TLS 1.3 em APIs, S3 SSE-KMS em gravações
- **Multi-tenancy** — isolamento absoluto entre tenants (todo query carrega `tenant_id`)

Se um requisito conflita com compliance, **pare e levante a questão** antes de implementar.

## Convenções de código

### Geral
- **Linguagem das mensagens, ADRs, comentários:** pt-BR
- **Identificadores de código:** inglês (`createRoom`, não `criarSala`)
- **Mensagens de commit:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **Branch ativa:** `feat/monorepo-scaffold`

### Backend (Go)
- Hexagonal Architecture (Ports & Adapters) + DDD por bounded context
- Estrutura interna: `domain/`, `application/`, `ports/`, `infrastructure/`
- Erros de domínio são tipos explícitos — nunca strings ou `errors.New` em lugares quentes
- `pkg/` apenas para código verdadeiramente compartilhado entre artefatos
- Validação acontece nos boundaries (handlers/DTOs), nunca espalhada
- `tenant_id` propagado via `context.Context` (ver `pkg/tenant`)

### Frontend
- Components do padrão shadcn/ui em `src/components/ui/`
- Variantes com `class-variance-authority`
- Estado local + React Query antes de qualquer global state
- Animações sempre checam `prefers-reduced-motion`
- Tipagem completa — nunca `any`
- `data-testid` em qualquer elemento testável por E2E

### Testes
- **TDD obrigatório** em código de domínio backend (Red → Green → Refactor)
- Table-driven tests para qualquer lógica com múltiplos cenários
- Cobertura ≥ 90% em `internal/*/domain` e `internal/*/application`
- E2E com Playwright + Page Object Model + `data-testid`

## Do / Don't

| ✅ Faça | ❌ Não faça |
|---|---|
| Escreva teste antes do código de domínio | Implementar feature backend sem teste |
| Use `tenant_id` em todo query e log | Query sem filtro de tenant |
| Coloque secrets em Secrets Manager | Commitar `.env` com credenciais |
| Rode `go test ./...` antes de subir PR | Confiar que CI vai pegar |
| Documente decisões grandes em ADR | Mudar arquitetura sem registro |
| Use `tsc --noEmit` no frontend antes de PR | Deixar `any` na tipagem |

## Comandos úteis

### Site (frontend)
```bash
cd site
npm install
npm run dev          # http://localhost:5173
npm run build
npm run preview
```

### platform/plexcare-teleconf (backend Go)
```bash
cd platform/plexcare-teleconf
docker compose -f docker-compose.dev.yml up -d   # infra + serviços
go test ./...                                     # roda todos os testes
go test -run TestRoomService_CreateRoom ./...    # roda um teste específico
go test -cover ./internal/...                     # cobertura do domínio
```

### Workflow Git
```bash
git status
git log --oneline -10
gh pr create --title "..." --body "..."
```

## Arquivos-chave

| Caminho | Descrição |
|---|---|
| `site/src/App.jsx` | Composição da landing |
| `site/src/index.css` | Design tokens (teal/dourado, dark-luxury) |
| `site/tailwind.config.js` | Tema customizado |
| `platform/plexcare-teleconf/internal/room/domain/room.go` | Entidade Room |
| `platform/plexcare-teleconf/pkg/tenant/context.go` | Propagação multi-tenant |
| `platform/plexcare-teleconf/docker-compose.dev.yml` | Stack local |
| `site/docs/ONBOARDING.md` | Onboarding completo com arquitetura e SLOs |

## Como pedir ajuda ao Claude neste repo

- **Tarefa cruza módulos?** Invoque `/solutions-architect` para decidir antes.
- **Implementar feature backend?** Invoque `/software-engineer` (TDD obrigatório).
- **Tela nova ou ajuste de UI?** Invoque `/fullstack-engineer`.
- **Validar release?** Invoque `/qa-engineer` para gerar test cases.
- **Dúvida sobre LiveKit/WebRTC?** Comece pelo Solutions Architect.

> Para qualquer arquivo `.pen` (Pencil), use os tools `pencil` — nunca `Read`/`Grep`.
