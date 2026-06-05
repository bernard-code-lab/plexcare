# PlexCare — Monorepo Control Layer

> Este arquivo é o **context layer** carregado automaticamente por Claude Code em qualquer task neste repositório. Mantenha-o conciso, factual e em pt-BR.

## Produto

**PlexCare** é uma plataforma SaaS B2B de telemedicina ("sala virtual"), concorrente do Twilio Video, focada no mercado brasileiro de saúde (médicos, clínicas, hospitais). Multi-tenant — cada tenant tem sua configuração, API keys, limites de plano e faturamento por minuto de sala.

## Mapa do monorepo

```
plexcare/
├── site/                                          Site institucional puro (Vite + React 18 + Tailwind)
├── platform/
│   ├── backend/
│   │   ├── plexcare-idp-api/                     Authorization Server (NestJS + Prisma + MySQL)
│   │   ├── plexcare-teleconf-service/            Backend Go da sala virtual
│   │   └── plexcare-schedule-api/                Agendamento inteligente (Go 1.23, scaffold)
│   ├── frontend/                                  (web apps fora de site/)
│   └── database/                                  SQL dumps versionados (db_plexcare_*.sql)
└── plexcare_agent_prompts.pdf                     Fonte canônica dos 7 agentes Claude
```

> **Importante.** `site/` é estritamente institucional. Toda UI do produto **sala virtual** (login, waiting room, sala LiveKit, histórico) vive em `platform/plexcare-teleconf-web/` e fala com `platform/plexcare-teleconf-service/`. Decisão registrada em [ADR-0003](docs/adr/0003-separacao-site-web-service.md).

> **Nota.** Os módulos de **infra** (Terraform/EKS/Helm) e **SRE** (Grafana/runbooks) ainda não foram criados — quando forem, irão para `platform/plexcare-infra/` e `platform/plexcare-sre/`.

> **⚠️ Gotcha: refatoração de paths com stack Docker em execução.** Containers Docker memorizam o `working_dir` do compose nos labels. Mover ou renomear um diretório de serviço **com a stack rodando** deixa os containers em loop de `Restarting` com `open .air.toml: no such file or directory` e erros silenciosos de DNS para outros serviços (`lookup kafka: no such host`). **Antes de mover qualquer `platform/**/docker-compose*.yml`:** derrube primeiro com `docker compose -p <project-name> down` e suba do path novo com `docker compose -f <novo>/docker-compose.dev.yml -p <project-name> up -d`. Volumes nomeados (`postgres-data`, `go-build-cache`) são preservados — só os containers são recriados.

## Roteiro de pesquisa — siga esta ordem

Para qualquer task neste repo, **sempre nesta ordem** (economiza tokens, evita re-leitura de arquivos):

1. **Leia o `CLAUDE.md` do módulo em que está trabalhando** — cada um lista os 5–7 "load-bearing files" daquele módulo + gotchas:
   - `site/CLAUDE.md` — site institucional (Vite/React/Tailwind dark-luxury)
   - `platform/backend/plexcare-idp-api/CLAUDE.md` — Authorization Server (NestJS + Prisma + MySQL; JWT Ed25519 + KC oculto)
   - `platform/backend/plexcare-teleconf-service/CLAUDE.md` — backend Go da sala virtual (room, metering, LiveKit)
   - `platform/plexcare-teleconf-web/CLAUDE.md` — app web da sala virtual (LiveKit client + React Router + TanStack Query)
   - `platform/backend/plexcare-schedule-api/CLAUDE.md` — agendamento (scaffold)
2. **Consulte memória local** para decisões, gotchas e auth-fakes conhecidos (`MEMORY.md` em `~/.claude/projects/.../memory/`).
3. **Use `/graphify`** para localizar código antes de `Read` em arquivo inteiro. `Read` direto só nos load-bearing files do módulo ou em arquivos ≤ ~100 linhas.
4. **Só depois** abra arquivos novos. Se descobrir algo não-óbvio (gotcha, decisão, atalho), atualize o `CLAUDE.md` do módulo ou crie uma memória.

> Tradução prática: nunca rode `ls` + `Read` de exploração se o `CLAUDE.md` do módulo já responde.

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

### Site (institucional)
```bash
cd site
npm install
npm run dev          # http://localhost:5173
npm run build
npm run preview
```

### platform/plexcare-teleconf-web (app do produto)
```bash
cd platform/plexcare-teleconf-web
npm install
cp .env.example .env # ajustar VITE_TELECONF_SERVICE_URL e VITE_LIVEKIT_URL se preciso
npm run dev          # http://localhost:5174 (porta fixa — não colide com site)
npm run build
```

### platform/backend/plexcare-teleconf-service (backend Go)
```bash
cd platform/backend/plexcare-teleconf-service
docker compose -f docker-compose.dev.yml up -d   # infra + serviços
go test ./...                                     # roda todos os testes
go test -run TestRoomService_CreateRoom ./...    # roda um teste específico
go test -cover ./internal/...                     # cobertura do domínio
```

### platform/backend/plexcare-idp-api (Authorization Server)
```bash
cd platform/backend/plexcare-idp-api
docker compose -f docker-compose.dev.yml up -d   # MySQL + MailHog
# Keycloak/Kafka vêm da stack do teleconf-service — suba-a antes
cp .env.example .env                              # ajustar JWKS_KEK_DEV (32 bytes base64)
npm install
npm run prisma:generate
npm run prisma:migrate                            # aplica as 6 migrations IdP
npm run prisma:seed                               # idp_client + signing key inicial
npm run dev                                       # http://localhost:4000 (Swagger UI em /docs)
npm test                                          # unit + integration (Docker p/ Testcontainers)
```

### Workflow Git
```bash
git status
git log --oneline -10
gh pr create --title "..." --body "..."
```

## Arquivos-chave (cross-cutting)

Para a lista completa de arquivos canônicos **por módulo**, leia o `CLAUDE.md` daquele módulo (seção "Antes de explorar o código"). Esta tabela cobre só o que atravessa o monorepo:

| Caminho | Descrição |
|---|---|
| `CLAUDE.md` (raiz) | Este arquivo — contexto global, compliance |
| `site/CLAUDE.md` | Load-bearing do site + design tokens reais |
| `platform/plexcare-teleconf-service/CLAUDE.md` | Load-bearing backend teleconf + gotchas LiveKit/Kafka |
| `platform/plexcare-teleconf-web/CLAUDE.md` | Load-bearing app web + gotchas LiveKit no client + CSP |
| `platform/plexcare-schedule-api/CLAUDE.md` | Status scaffold + domínios planejados |
| `site/docs/ONBOARDING.md` | Onboarding completo com arquitetura e SLOs |
| `docs/adr/` | Architecture Decision Records — leia antes de propor mudança grande |
| `plexcare_agent_prompts.pdf` | Fonte canônica dos 7 agentes Claude |

## Decisões arquiteturais registradas (ADRs)

Antes de propor mudança em fila, tenancy, auth, banco ou protocolo, **leia o ADR correspondente** em `docs/adr/`:

- [ADR-0001](docs/adr/0001-kafka-como-event-bus-interno.md) — Kafka como event bus interno
- [ADR-0002](docs/adr/0002-multi-tenancy-via-header-context.md) — Multi-tenancy via header + `context.Context`
- [ADR-0003](docs/adr/0003-separacao-site-web-service.md) — Separação `site` / `teleconf-web` / `teleconf-service`
- [ADR-0004](docs/adr/0004-idp-proprio-keycloak-oculto.md) — IdP próprio com Keycloak oculto
- [ADR-0005](docs/adr/0005-outbox-worker-poll.md) — Outbox transacional + worker poll para Kafka

Para criar ADR novo: copie `docs/adr/template.md` ou invoque `/adr`.

## Como pedir ajuda ao Claude neste repo

- **Tarefa cruza módulos?** Invoque `/solutions-architect` para decidir antes.
- **Implementar feature backend?** Invoque `/software-engineer` (TDD obrigatório).
- **Tela nova ou ajuste de UI?** Invoque `/fullstack-engineer`.
- **Validar release?** Invoque `/qa-engineer` para gerar test cases.
- **Dúvida sobre LiveKit/WebRTC?** Comece pelo Solutions Architect.

> Para qualquer arquivo `.pen` (Pencil), use os tools `pencil` — nunca `Read`/`Grep`.
