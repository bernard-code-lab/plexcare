<p align="center">
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow" alt="Status" />
  <img src="https://img.shields.io/badge/go-1.23-00ADD8?logo=go&logoColor=white" alt="Go 1.23" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/livekit-WebRTC-FF6B35" alt="LiveKit" />
  <img src="https://img.shields.io/badge/cloud-AWS%20EKS-FF9900?logo=amazonaws&logoColor=white" alt="AWS" />
  <img src="https://img.shields.io/badge/compliance-LGPD%20%7C%20CFM%202.314-green" alt="Compliance" />
</p>

# PlexCare

Inovando em plataformas web e mobile, produtos:
**sala virtual**: Pensado para facilitar a comunicação a distancia para empresas e seus clientes como (medicos, clinicas, dentistas, salão de beleza e outros)
**Modelo**: Multi-tenant B2B — cada tenant (clinica/hospital) tem sua propria configuracao, API keys, limites de plano e faturamento por minuto de sala.

---

## Repositorio

```
plexcare/
  README.md
  plexcare_agent_prompts.pdf        Prompts dos 7 agentes Claude
  site/                             Marketing site
  platform/
    plexcare-teleconf/              Sala virtual (room, metering, webhooks)
    plexcare-schedule-api/          Agendamento inteligente
```

## Taxonomia de Artefatos

Todos os projetos dentro de `platform/` seguem a convencao:

```
plexcare-<contexto>-<tipo>
```

| Segmento | Descricao | Exemplos |
|---|---|---|
| `plexcare-` | Prefixo fixo do produto | — |
| `<contexto>` | Dominio de negocio do artefato | `teleconf`, `schedule`, `billing`, `auth` |
| `<tipo>` | Natureza tecnica (quando aplicavel) | `api`, `worker`, `job`, `bff`, `sdk` |

### Exemplos validos

| Artefato | O que faz |
|---|---|
| `plexcare-teleconf` | Sala virtual — room service, metering, webhooks LiveKit |
| `plexcare-schedule-api` | API REST de agendamento inteligente |
| `plexcare-billing-worker` | Consumer Kafka para processar eventos de billing |
| `plexcare-auth-api` | Servico de autenticacao e autorizacao multi-tenant |
| `plexcare-egress-job` | Job de gravacao e upload para S3 |

> Quando o artefato cobre o dominio inteiro (ex: `plexcare-teleconf`), o `<tipo>` e omitido.

### Estrutura interna de cada artefato Go

```
plexcare-<nome>/
  cmd/                  Entrypoints (main.go por binario)
  internal/             Codigo privado do modulo
    <dominio>/
      domain/           Entidades, value objects, erros de dominio
      application/      Use cases (orquestram domain + ports)
      ports/            Interfaces (driven + driving)
      infrastructure/   Adapters (postgres, redis, kafka, livekit)
  pkg/                  Codigo compartilhavel entre artefatos
  migrations/           SQL migrations
  Dockerfile
  docker-compose.dev.yml
  go.mod
```

## Stack

| Camada | Tecnologias |
|---|---|
| **Site** | Vite + React 18 + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| **Backend** | Go 1.23, chi, pgx, zap, OpenTelemetry |
| **Media** | LiveKit SFU (Go + Pion), coturn (TURN), Egress → S3 |
| **Data** | PostgreSQL, Redis, Kafka/SQS |
| **Payments** | Stripe / Iugu |
| **Cloud** | AWS EKS, Terraform, GitHub Actions |

## Compliance

| Requisito | Como atendemos |
|---|---|
| **LGPD** | Consentimento gravado, audit logs, anonimizacao sob demanda |
| **CFM 2.314/2022** | Regulamentacao de telemedicina no Brasil |
| **Criptografia** | SRTP (media), TLS 1.3 (APIs), S3 SSE-KMS (gravacoes) |

## Documentacao

| Doc | Descricao |
|---|---|
| [Onboarding Guide](site/docs/ONBOARDING.md) | Guia completo de onboarding com arquitetura e SLOs |
| [Agent Prompts](plexcare_agent_prompts.pdf) | 7 prompts de agentes Claude (Architect, Engineer, QA, E2E, DevOps, SRE) |

## Agentes Claude

O projeto usa 7 agentes especializados para desenvolvimento assistido por IA:

| # | Agente | Escopo |
|---|---|---|
| 00 | Contexto Compartilhado | Base de conhecimento incluida em todos |
| 01 | Solutions Architect | ADRs, trade-offs, compliance |
| 02 | Software Engineer Sr. | Backend Go/NestJS, TDD, table-driven tests |
| 03 | Fullstack Engineer | React + LiveKit SDK, design system |
| 04 | QA Engineer | Test cases, piramide de testes, risco |
| 05 | E2E Engineer | Playwright, Page Objects, WebRTC |
| 06 | DevOps Platform Engineer | Terraform, EKS, GitHub Actions, Helm |
| 07 | SRE Infra Engineer | SLOs, OpenTelemetry, runbooks, alertas |
