<p align="center">
  <img src="https://img.shields.io/badge/status-scaffold-lightgrey" alt="Status" />
  <img src="https://img.shields.io/badge/go-1.23-00ADD8?logo=go&logoColor=white" alt="Go 1.23" />
</p>

# plexcare-schedule-api

API REST de agendamento inteligente — multicanal (Google Calendar, iOS, WhatsApp) com IA anti-no-show.

> Este artefato esta em fase de scaffold. A estrutura de diretorios segue a [taxonomia padrao](../../README.md#taxonomia-de-artefatos) do monorepo.

---

## Estrutura

```
plexcare-schedule-api/
  cmd/                  Entrypoints
  internal/             Dominios de negocio
  migrations/           SQL migrations
  pkg/                  Codigo compartilhavel
```

## Dominios Planejados

| Dominio | Descricao |
|---|---|
| **appointment** | CRUD de agendamentos, regras de disponibilidade, conflitos |
| **reminder** | Notificacoes multicanal (WhatsApp, email, push) |
| **noshow** | Predicao de no-show com IA, politicas de cancelamento |
| **provider** | Configuracao de profissionais, horarios, especialidades |

## Desenvolvimento Local

```bash
# Ainda nao implementado — use como referencia a estrutura do plexcare-teleconf
cd ../plexcare-teleconf
cat docker-compose.dev.yml
```
