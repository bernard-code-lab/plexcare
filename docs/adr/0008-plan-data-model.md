# ADR 0008 — Modelo de dados de planos, subscriptions e cobrança por SKU

**Status:** Proposed — 2026-06-07
**Decisores:** Solutions Architect, Stakeholder de produto
**Substitui:** —
**Consultar antes:** [ADR-0001 Kafka como event bus](./0001-kafka-como-event-bus-interno.md) · [ADR-0002 Multi-tenancy via header + context](./0002-multi-tenancy-via-header-context.md) · [ADR-0004 IdP próprio com Keycloak oculto](./0004-idp-proprio-keycloak-oculto.md) · [ADR-0005 Outbox + worker poll](./0005-outbox-worker-poll.md) · [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §§3–5

## Contexto

A Etapa 1 de monetização congelou um catálogo de 2 SKUs + 1 bundle (`PlexCare Rooms`, `PlexCare Schedule`, `PlexCare Suite`), cada um com 3 tiers (Solo, Clínica, Enterprise), eixo per-médico e cobrança híbrida (assinatura + overage + pay-per-minute avulso para encaixe online). O catálogo vive hoje em markdown — não há entidade no código.

O `room-service` (Go, Postgres) decide quota de salas hoje via [`internal/room/infrastructure/devtenant/resolver.go`](../../platform/backend/plexcare-teleconf-service/internal/room/infrastructure/devtenant/resolver.go), que **aceita qualquer UUID** no header `X-Tenant-Id` e devolve sempre `Plan="pro"` com 50 salas simultâneas. Isso bloqueia qualquer staging/prod (issue #3) e impede modelar os 9 estados de billing possíveis (Rooms ativo, Schedule ativo, Suite ativo, Schedule sem Rooms → pay-per-minute, sem plano → reject, trial, past_due, canceled, addon-only).

A tenancy (`account`, `idp_user`, `outbox`) já vive em **MySQL** no `plexcare-idp-api` ([`platform/database/db_plexcare_tenancy.sql`](../../platform/database/db_plexcare_tenancy.sql)). O metering de sala vive em **Postgres** no `plexcare-teleconf-service`. **Não pode haver `JOIN` cross-banco** — qualquer modelo precisa decidir source-of-truth e propagação.

Precisamos decidir agora porque:

- ADR-0006 (metering symmetric Rooms+Schedule) e ADR-0007 (encaixe online cross-produto) dependem de saber "qual plano esse tenant tem".
- Issue #3 (matar o `devtenant.Resolver`) precisa de schema concreto para o adapter real.
- Stripe metered (ADR-0010 pendente) exige `plans.code` estável para `Price.lookup_key`.

## Decisão

**Source of truth é o `plexcare-idp-api` (MySQL).** Quatro tabelas novas + uma view materializada no Postgres do `plexcare-teleconf-service` como read-model, hidratada por evento Kafka `subscription.updated`.

### Tabelas (MySQL, `db_plexcare_tenancy`)

```sql
-- Catálogo estático (seed via migration, raramente muda)
CREATE TABLE `product` (
  `id`         CHAR(36)     NOT NULL,
  `code`       VARCHAR(32)  NOT NULL UNIQUE,                  -- 'rooms' | 'schedule' | 'suite'
  `name`       VARCHAR(128) NOT NULL,
  `kind`       ENUM('rooms','schedule','suite','addon') NOT NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
);

CREATE TABLE `plan` (
  `id`                        CHAR(36)     NOT NULL,
  `product_id`                CHAR(36)     NOT NULL,
  `code`                      VARCHAR(64)  NOT NULL UNIQUE,   -- 'rooms-solo', 'suite-clinica', ...
  `name`                      VARCHAR(128) NOT NULL,
  `tier`                      ENUM('trial','solo','clinica','enterprise') NOT NULL,
  `billing_cycle`             ENUM('monthly','annual','custom') NOT NULL,
  `price_brl_cents`           INT          NOT NULL,           -- preço mensal-equivalente
  `included_minutes`          INT          NULL,               -- NULL = ilimitado (Enterprise)
  `included_messages`         INT          NULL,               -- WhatsApp Schedule
  `max_concurrent_rooms`      INT          NULL,
  `overage_per_minute_cents`  INT          NULL,
  `overage_per_message_cents` INT          NULL,
  `features`                  JSON         NOT NULL,           -- {recording: true, whitelabel: false, ...}
  `stripe_price_lookup_key`   VARCHAR(64)  NULL,               -- vínculo com Stripe Price
  `is_active`                 BOOLEAN      NOT NULL DEFAULT TRUE,
  `created_at`                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `plan_product_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`)
);

-- Estado dinâmico — 1 row por (tenant, plan ativo)
CREATE TABLE `tenant_subscription` (
  `id`                       CHAR(36)     NOT NULL,
  `tenant_id`                CHAR(36)     NOT NULL,           -- FK lógico p/ account.id
  `plan_id`                  CHAR(36)     NOT NULL,
  `status`                   ENUM('trial','active','past_due','canceled') NOT NULL,
  `seats_count`              INT          NOT NULL DEFAULT 1, -- nº de médicos cobrados
  `trial_ends_at`            DATETIME(3)  NULL,
  `current_period_start`     DATETIME(3)  NOT NULL,
  `current_period_end`       DATETIME(3)  NOT NULL,
  `stripe_subscription_id`   VARCHAR(64)  NULL,
  `pool_minutes_remaining`   INT          NULL,               -- só Suite usa; NULL nos demais
  `pool_messages_remaining`  INT          NULL,
  `canceled_at`              DATETIME(3)  NULL,
  `created_at`               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `tenant_subscription_plan_fk` FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`),
  KEY `tenant_subscription_tenant_idx` (`tenant_id`, `status`)
);

-- Addons (white-label, sandbox API, gravação estendida) — vazia no v1, contrato pronto
CREATE TABLE `tenant_addon` (
  `id`         CHAR(36)     NOT NULL,
  `tenant_id`  CHAR(36)     NOT NULL,
  `addon_code` VARCHAR(64)  NOT NULL,
  `status`     ENUM('active','canceled') NOT NULL,
  `metadata`   JSON         NOT NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `tenant_addon_tenant_idx` (`tenant_id`, `status`)
);
```

**Invariante de cardinalidade (aplicada em service, não constraint):** um `tenant_id` não pode ter simultaneamente `plan.kind='suite'` ativo + `plan.kind IN ('rooms','schedule')` ativo. Conversão Suite ↔ standalone fecha a subscription anterior (status='canceled') e abre nova.

### Read-model em Postgres do `teleconf-service`

```sql
CREATE TABLE tenant_subscription_view (
  tenant_id              UUID PRIMARY KEY,
  active_products        TEXT[] NOT NULL,                    -- ['rooms','schedule'] OU ['suite']
  rooms_pool_remaining   INT NULL,
  rooms_overage_cents    INT NULL,
  max_concurrent_rooms   INT NOT NULL,
  is_pay_per_minute      BOOLEAN NOT NULL DEFAULT FALSE,
  ppm_price_cents        INT NULL,
  ppm_daily_cap_cents    INT NOT NULL DEFAULT 20000,         -- R$ 200/dia hard cap
  status                 TEXT NOT NULL,                       -- 'trial'|'active'|'past_due'|'canceled'
  features               JSONB NOT NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Read-model populado por consumer Kafka do tópico `subscription.events` (CloudEvents `subscription.created/updated/canceled`). Idp-api publica via outbox (ADR-0005). Reconciliação completa nightly cron `tenant_subscription_view_reconciler` (varre `subscription.snapshot` topic compactado).

### `dbtenant.Resolver` substitui `devtenant.Resolver`

```go
// internal/room/infrastructure/dbtenant/resolver.go (novo)
type Resolver struct {
    pg *pgxpool.Pool
}

func (r *Resolver) Resolve(ctx context.Context, tenantID string) (tenant.Context, error) {
    var v tenantSubscriptionView
    err := r.pg.QueryRow(ctx, `SELECT * FROM tenant_subscription_view WHERE tenant_id = $1`, tenantID).Scan(...)
    if errors.Is(err, pgx.ErrNoRows) {
        return tenant.Context{}, tenant.ErrUnknownTenant
    }
    return tenant.NewContext(tenantID, v.Plan(), v.MaxConcurrentRooms, v.Features), nil
}
```

`devtenant.Resolver` fica como `tenant.Resolver` apenas se `APP_ENV=dev` + header `X-Dev-Skip-Tenant-Lookup: true`. Em qualquer outro env, ele nem registra no DI.

### Seed inicial

Migration de seed cria os 9 planos canônicos do artefato:

| Code | Product | Tier | Preço anual (cents) | Min inclusos | Max concurrent | Overage cents/min |
|---|---|---|---|---|---|---|
| `rooms-trial` | rooms | trial | 0 | 100 (total) | 1 | — |
| `rooms-solo` | rooms | solo | 11900 | 400 | 3 | 20 |
| `rooms-clinica` | rooms | clinica | 24900 | 1500 | 10 | 15 |
| `rooms-enterprise` | rooms | enterprise | NULL (custom) | NULL | NULL | 8 |
| `schedule-trial` | schedule | trial | 0 | 50 msg | — | — |
| `schedule-solo` | schedule | solo | 7900 | 300 msg | — | 10 |
| `schedule-clinica` | schedule | clinica | 15900 | 1500 msg | — | 8 |
| `schedule-enterprise` | schedule | enterprise | NULL | NULL | — | 5 |
| `suite-solo` | suite | solo | 16800 | 400 min + 300 msg | 3 | 20 |
| `suite-clinica` | suite | clinica | 34700 | 1500 min + 1500 msg | 10 | 15 |
| `suite-enterprise` | suite | enterprise | NULL | NULL | NULL | 8 |

Pay-per-minute (R$ 0,25/min) **não é plano** — é comportamento do `BillingResolver` (ADR-0007) quando um tenant tem `schedule-*` ativo, **não tem** `rooms-*`/`suite-*` ativo, e abre sala via encaixe online.

### Diagrama de fluxo

```
        ┌─────────────────────┐
        │  plexcare-idp-api   │  ← source-of-truth
        │  (MySQL tenancy)    │
        │                     │
        │  product            │
        │  plan               │  ─── outbox ──> Kafka
        │  tenant_subscription│       (subscription.created/updated/canceled)
        │  tenant_addon       │
        └─────────────────────┘
                                     │
                                     ▼
        ┌─────────────────────────────────────┐
        │  plexcare-teleconf-service          │
        │  (Postgres)                         │
        │                                     │
        │  tenant_subscription_view  ◄── consumer ── room.subscription.consumer
        │  (read-model atualizado < 1s)              (consome subscription.events)
        │                                     │
        │  dbtenant.Resolver ──► tenant.Context │
        │  CreateRoomUseCase  ◄────────────────┘
        └─────────────────────────────────────┘
```

## Consequências

### Positivas

- Mata o `devtenant` (issue #3). Path para staging/prod fica desbloqueado.
- Catálogo do artefato §3-5 vira código auditável (migrations versionadas, lookup_key Stripe rastreável).
- ADR-0006 (metering) e ADR-0007 (encaixe online cross-produto) ganham um contrato de domínio (`tenant.Context.ActiveProducts`, `tenant.Context.IsPayPerMinute`) para checar.
- Read-model local resolve quota em < 1ms (Postgres do próprio serviço) — sem round-trip HTTP por `CreateRoom`.
- Suporta evolução para `plexcare-billing-api` extraído sem refactor de schema (tabelas estão no domínio `tenancy`, billing-api consome via mesmo tópico Kafka).

### Negativas / Trade-offs

- **Cross-DB eventual consistency.** Mudança de plano via Stripe webhook → idp-api atualiza MySQL → outbox → Kafka → teleconf-service atualiza Postgres view. Janela típica < 1s, pior caso < 30s. Aceitável: usuário que upgrada plano e tenta abrir sala "imediatamente" vê quota antiga por até 1s. Mitigação: front mostra "atualizando plano" depois do upgrade.
- **2 lugares para errar.** Cobertura: integration test `idp-api emits subscription.updated → teleconf-service view shows new pool` (Testcontainers + Kafka).
- **Migration de planos é mais complexa.** Mudar preço de `rooms-clinica` exige nova `plan` (não UPDATE) + script para migrar subscriptions ativas no fim do `current_period_end`. Stripe Price também é immutable; segue a mesma disciplina.
- **Suite + standalone simultâneo bloqueado em service** (não constraint) — bug aqui = double-charge. Mitigação: test unit + smoke obrigatório no PR de billing.

### Neutras / a observar

- `stripe_price_lookup_key` é null nas linhas Enterprise (preço custom). `BillingResolver` trata Enterprise como "sem overage automático" e exige operação manual de invoice.
- `pool_minutes_remaining` nullable nas linhas não-Suite — comportamento `Mode=included` lê direto `included_minutes` do `plan`; só Suite tem pool decremental.

## Alternativas consideradas

### Alternativa A — `tenant.plan` como string só em `account`

- Prós: zero schema novo; resolve em 1 hora.
- Contras: sem tier separado, sem features, sem pool, sem overage. Stripe metered fica desalinhado — `lookup_key` precisa do `plan.code`.
- Por que não: não suporta o catálogo de 9 planos do artefato. Joga complexidade pro código e pro Stripe.

### Alternativa B — Tudo no Stripe (sem tabelas próprias)

- Prós: zero schema; Stripe é source of truth.
- Contras: `CreateRoomUseCase` precisa fazer round-trip Stripe API (latency + vendor coupling máximo). Cap diário pay-per-minute fica sem casa natural. Perdemos invariantes (Suite XOR standalone) em local controlável.
- Por que não: vendor lock total, latência inaceitável no hot path da criação de sala.

### Alternativa C — Tabelas em Postgres do teleconf-service (sem read-model, fica lá direto)

- Prós: 1 banco só para tudo de billing.
- Contras: quebra bounded context (billing pertence à tenancy, não à sala). Schedule-api precisaria do mesmo schema duplicado.
- Por que não: viola coesão de domínio; cria 3 fontes de verdade quando schedule-api crescer.

### Alternativa D — Aggregated billing service novo (`plexcare-billing-api`) já no v1

- Prós: arquitetura "correta" desde o início.
- Contras: +1 serviço para operar; sem dor real ainda; bloqueia entrega.
- Por que não: extrair quando MRR Suite ≥ R$ 200k/mês (mesmo gate da memória `plexcare-competitor-communicare`). Schema atual fica preparado para essa extração sem rework.

## Plano de revisão

Reavaliar quando **qualquer** das condições disparar:

- **Latência cross-DB > 30s** (p95) em incidente real — pode forçar read-model síncrono via HTTP ao idp-api.
- **MRR Suite ≥ R$ 200k/mês** — gate para extrair `plexcare-billing-api` standalone.
- **Necessidade de plano híbrido** (ex: tenant com Rooms-Clínica + Schedule-Solo, fora do Suite) — exige relaxar invariante e ajustar `BillingResolver`.
- **Múltiplas moedas** (USD/EUR para expansão internacional, fora desta etapa) — adiciona `currency` em `plan` e `tenant_subscription`.
- **Self-service de planos custom** (Enterprise hoje é manual) — exige UI no admin + workflow de aprovação.

## Referências

- [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §§3–5 + §11 perguntas 1, 3, 6
- [ADR-0004 IdP próprio com Keycloak oculto](./0004-idp-proprio-keycloak-oculto.md) — define que tenancy mora no idp-api MySQL
- [ADR-0005 Outbox + worker poll](./0005-outbox-worker-poll.md) — base do mecanismo `subscription.events`
- Issue #3 — Tenant Config Service real (substitui `devtenant.Resolver`)
- Issue #17 — `plexcare-auth-api` (provê JWT a partir do `tenant_subscription` real)
- `internal/room/infrastructure/devtenant/resolver.go` — a ser deprecado
- `internal/room/application/create_room.go:62-80` — call site que consumirá o novo `tenant.Context`
- Memória: [[plexcare-monetization-scope]] · [[plexcare-devtenant-security]] · [[plexcare-metering-root-cause]]
