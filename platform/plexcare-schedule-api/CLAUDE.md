# plexcare-schedule-api — Agendamento inteligente (Go 1.23, scaffold)

> Carregado quando Claude trabalha em `platform/plexcare-schedule-api/**`. Veja `../../CLAUDE.md` (raiz) e `../plexcare-teleconf/CLAUDE.md` (referência de arquitetura).

## Status

**Scaffold.** Apenas a árvore de diretórios canônica existe — sem `go.mod`, código ou testes. Siga o padrão do irmão `plexcare-teleconf` ao começar a implementar.

## O que será

API REST de agendamento multicanal (Google Calendar, iOS Calendar, WhatsApp) com IA anti-no-show. Quando uma consulta agendada chega ao horário, dispara `plexcare-teleconf` para provisionar a sala LiveKit.

## Domínios planejados

| Bounded context | Responsabilidade |
|---|---|
| `appointment` | CRUD de agendamentos, regras de disponibilidade, conflitos |
| `reminder` | Notificações multicanal (WhatsApp, email, push) |
| `noshow` | Predição de no-show via IA, políticas de cancelamento |
| `provider` | Configuração de profissionais, horários, especialidades |

## Estrutura esperada (espelha plexcare-teleconf)

```
platform/plexcare-schedule-api/
├── cmd/
│   └── schedule-api/main.go         (a criar)
├── internal/
│   ├── appointment/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── ports/
│   │   └── infrastructure/
│   ├── reminder/ ...
│   ├── noshow/ ...
│   └── provider/ ...
├── pkg/
│   └── tenant/                       (importar de plexcare-teleconf ou duplicar)
├── migrations/
├── go.mod                            module plexcare/platform/plexcare-schedule-api
├── Dockerfile                        (espelhar plexcare-teleconf)
└── docker-compose.dev.yml
```

## Decisões pendentes (registrar como ADR ao decidir)

1. **Workspace Go (`go.work`) vs módulos independentes?** — `pkg/tenant` é candidato natural a virar pacote compartilhado.
2. **WhatsApp provider** — Meta Cloud API direto ou via Twilio?
3. **Modelo de no-show** — heurística primeiro vs ML desde o início?
4. **Eventos para `plexcare-teleconf`** — Kafka topic ou HTTP webhook?

## Como começar

1. Invoque `/solutions-architect` com a pergunta arquitetural específica
2. Depois `/software-engineer` para gerar o domínio em TDD
3. Copie o esqueleto do `plexcare-teleconf` (Dockerfile, docker-compose, .air.toml, pkg/tenant, pkg/telemetry)

## Convenções

Idênticas ao `plexcare-teleconf` — veja `../plexcare-teleconf/CLAUDE.md` para detalhes de Hexagonal/DDD, multi-tenancy, testes table-driven e métricas obrigatórias.
