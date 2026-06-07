# ADR 0006 — Metering simétrico Rooms + Schedule (`MonthlyUsage` + cron Aggregate + reconciliação noturna)

**Status:** Proposed — 2026-06-07
**Decisores:** Solutions Architect, Stakeholder de produto
**Substitui:** —
**Consultar antes:** [ADR-0001 Kafka como event bus](./0001-kafka-como-event-bus-interno.md) · [ADR-0002 Multi-tenancy via header + context](./0002-multi-tenancy-via-header-context.md) · [ADR-0005 Outbox + worker poll](./0005-outbox-worker-poll.md) · [ADR-0007 Encaixe online cross-produto](./0007-encaixe-online-cross-produto.md) · [ADR-0008 Plan data model](./0008-plan-data-model.md) · [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §11 pergunta 1

## Contexto

O pricing congelado na Etapa 1 cobra três eixos de uso:

- **Rooms**: minutos de sala (`included_minutes` + overage R$ 0,20/0,15/0,08/min por tier).
- **Schedule**: mensagens WhatsApp enviadas (`included_messages` + overage R$ 0,10/0,08/0,05/msg).
- **Pay-per-minute avulso** (D-5 do artefato): minutos de sala consumidos quando tenant Schedule abre encaixe online sem plano Rooms/Suite (R$ 0,25/min).

Estado atual verificado:

- **Rooms** — `internal/metering/domain/usage.go:43-51` já define `MonthlyUsage{TenantID, Period, TotalMinutes, TotalRooms}`. `metering/ports/ports.go` expõe `SumMinutesByTenantAndPeriod` e `CountRoomsByTenantAndPeriod`. **Falta um worker que materialize** essa view periodicamente — hoje só dá pra computar sob demanda.
- **Bridge corrigido** — `room/infrastructure/webhookbridge/bridge.go:69-84` já resolve `livekit_name → r.ID + r.TenantID` antes de publicar (corrige bug 22P02 descrito na memória `plexcare-metering-root-cause`, que está stale).
- **Schedule** — `plexcare-schedule-api/` é só `CLAUDE.md` + `README.md`. Nenhum metering existe.
- **Pay-per-minute** — não tem casa nenhuma; ADR-0007 desenhou o port `BillingResolver` e a tabela `pay_per_minute_daily_usage`, mas a cobrança ainda precisa de `usage_record` que o Stripe Reporter consuma.

Precisamos decidir agora porque:

- ADR-0007 já assumiu que o `metering` decrementa `pool_minutes_remaining` no `participant_left` e registra `usage_record` ppm — sem esquema concreto, ADR-0007 fica pendurada no ar.
- ADR-0008 entregou `tenant_subscription_view`; falta o lado de leitura/escrita (uso) para fechar o ciclo de billing.
- A escrita Schedule ainda não existe — desenhar simétrico evita divergência arquitetural quando o `schedule-api` ganhar código real.

## Decisão

**Metering vive em cada produto** (não em serviço único). Quatro componentes:

1. **`internal/metering/` Rooms** — usa o pacote existente; ganha `AggregateUseCase` em cron + `usage_record` para overage/ppm.
2. **`internal/metering/` Schedule** — pacote simétrico no `schedule-api`, com `MonthlyScheduleUsage` e mesmas ports.
3. **`UsageRecord` é o evento contábil** — uma linha por unidade cobrável (minuto ppm, minuto overage, mensagem overage). Publicado em outbox + Kafka tópico `usage.recorded`.
4. **Reconciliação noturna** — cron que recomputa `MonthlyUsage` a partir das tabelas-fonte (`participant_sessions`, `schedule_messages_sent`) e ajusta divergência.

### 1. Rooms — `MonthlyUsage` + worker

```go
// internal/metering/application/aggregate.go (novo método)
// Aggregate roda em cron (default a cada 1h) e materializa MonthlyUsage do mês corrente.
// Snapshot diário + recomputação noturna garantem que a leitura "current usage" é O(1).
func (uc *AggregateUseCase) Execute(ctx context.Context, period string) error {
    tenants, err := uc.sessions.DistinctTenantsByPeriod(ctx, period)
    if err != nil { return err }

    for _, tenantID := range tenants {
        minutes, _ := uc.sessions.SumMinutesByTenantAndPeriod(ctx, tenantID, period)
        rooms, _   := uc.sessions.CountRoomsByTenantAndPeriod(ctx, tenantID, period)
        _ = uc.usage.Upsert(ctx, &domain.MonthlyUsage{
            TenantID: tenantID, Period: period,
            TotalMinutes: minutes, TotalRooms: rooms,
            UpdatedAt: time.Now().UTC(),
        })
    }
    return nil
}
```

Worker `cmd/usage-aggregator/main.go` orquestra: cada hora, computa mês corrente. À meia-noite, computa também mês anterior (catch corrections de eventos atrasados).

### 2. Schedule — gêmeo simétrico

Pacote `plexcare-schedule-api/internal/metering/` com mesma estrutura hexagonal:

```go
// plexcare-schedule-api/internal/metering/domain/usage.go
type MonthlyScheduleUsage struct {
    TenantID                string
    Period                  string
    ConfirmedAppointments   int  // métrica de produto, não cobrada
    WhatsAppMessagesSent    int  // unidade cobrada
    NoShowsPrevented        int  // métrica de produto + diferencial de marketing
    UpdatedAt               time.Time
}

// porta simétrica
type ScheduleEventRepository interface {
    RecordMessageSent(ctx context.Context, ev MessageSentEvent) error
    SumMessagesByTenantAndPeriod(ctx context.Context, tenantID, period string) (int, error)
    // ... CountAppointmentsByTenantAndPeriod, etc.
}
```

`schedule-api` ao enviar lembrete WhatsApp via Meta API: grava em `schedule_messages_sent(tenant_id, sent_at, template_id, status)` na **mesma transação Prisma/pgx** + publica via outbox.

### 3. `UsageRecord` — evento contábil unificado

Esta é a peça que liga metering com cobrança. **Uma linha = uma unidade cobrável.**

```sql
-- Postgres do teleconf-service (Rooms + ppm)
CREATE TABLE usage_record (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    subscription_id UUID NULL,                     -- NULL se ppm puro
    product         TEXT NOT NULL,                 -- 'rooms' | 'schedule'
    kind            TEXT NOT NULL,                 -- 'included' | 'overage' | 'pay_per_minute'
    quantity        INT  NOT NULL,                 -- minutos OU mensagens
    unit_price_cents INT NOT NULL,                 -- 0 para 'included'
    total_cents     INT  NOT NULL,                 -- quantity * unit_price_cents
    period          DATE NOT NULL,                 -- YYYY-MM-01 do mês de competência
    source_event_id UUID NOT NULL UNIQUE,          -- idempotência (= session_id ou message_id)
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stripe_invoice_item_id TEXT NULL                -- preenchido após push para Stripe
);
CREATE INDEX usage_record_tenant_period_idx ON usage_record (tenant_id, period);
CREATE INDEX usage_record_unbilled_idx ON usage_record (stripe_invoice_item_id) WHERE stripe_invoice_item_id IS NULL;
```

Mesma tabela no `schedule-api` Postgres. Stripe Reporter (cron diário) lê `WHERE stripe_invoice_item_id IS NULL`, cria invoice items em batch, marca `stripe_invoice_item_id`. ADR-0010 (pendente) detalhará o reporter.

### 4. Fluxo de escrita — `participant_left`

```go
// internal/metering/application/process_event.go (handleLeft modificado)
func (uc *ProcessEventUseCase) handleLeft(ctx context.Context, event ParticipantEvent) error {
    session, err := uc.sessions.CloseSession(ctx, event.RoomID, event.ParticipantID, event.OccurredAt)
    if err != nil { return nil } // log warn

    minutes := session.BillableMinutes()
    period := event.OccurredAt.Format("2006-01-02")[:7] + "-01"

    // 1. Decide kind baseado no BillingMode da Room (gravado em create_room)
    room, _ := uc.rooms.FindByID(ctx, event.RoomID)
    kind, unitPriceCents, subscriptionID := uc.classifyUsage(ctx, event.TenantID, room.BillingMode, minutes)

    // 2. UsageRecord (idempotente por session_id)
    record := &domain.UsageRecord{
        ID:              uuid.New().String(),
        TenantID:        event.TenantID,
        SubscriptionID:  subscriptionID,
        Product:         "rooms",
        Kind:            kind,                // 'included' | 'overage' | 'pay_per_minute'
        Quantity:        minutes,
        UnitPriceCents:  unitPriceCents,
        TotalCents:      minutes * unitPriceCents,
        Period:          period,
        SourceEventID:   session.ID,
        RecordedAt:      time.Now().UTC(),
    }
    if err := uc.records.Insert(ctx, record); err != nil { /* idempotência: ignora dup */ }

    // 3. Decrementa pool (se incluso) ou consumed_cents diário (se ppm) na MESMA transação
    if kind == "included" {
        _ = uc.subscriptions.DecrementPoolMinutes(ctx, *subscriptionID, minutes)
    } else if kind == "pay_per_minute" {
        _ = uc.dailyUsage.IncrementConsumedCents(ctx, event.TenantID, time.Now().UTC(), record.TotalCents)
    }

    // 4. Publica via outbox (ADR-0005) — usage.recorded event
    return uc.publisher.Publish(ctx, "usage.recorded", session.ID, asUsageEvent(record))
}
```

`classifyUsage` lê `tenant_subscription_view` + valida contra `BillingMode` persistido na sala (immutable, ADR-0007).

### 5. Reconciliação noturna

Cron `cmd/usage-reconciler/main.go` (3h da manhã, lock distribuído):

- Recomputa `MonthlyUsage` do mês corrente + anterior a partir de `participant_sessions` (Rooms) e `schedule_messages_sent` (Schedule).
- Compara com soma de `usage_record`. Divergência > 0.5% → alerta + investigação manual.
- Libera reservas órfãs (`ReservationID` ativos > 60min após `expires_at` da sala) — fecha o loop do ADR-0007.

### Tópicos Kafka consolidados

| Tópico | Producer | Consumers | Conteúdo |
|---|---|---|---|
| `room.events` | `teleconf-service` (webhook) | `usage-metering` | participant_joined/left + room_finished |
| `metering.usage` | `usage-metering` (Rooms) | (DEPRECATED em favor de `usage.recorded`) | — |
| `usage.recorded` | `usage-metering` + `schedule-api` | `billing-reporter` (futuro), BI | `UsageRecord` evento unificado |
| `schedule.events` | `schedule-api` | `usage-metering` Schedule | appointment_confirmed, message_sent |

## Consequências

### Positivas

- **Schedule vira contábil desde o dia 1** — `schedule-api` não pode "esquecer" de gravar `usage_record` (validação no domain).
- **Pay-per-minute fica auditável** — ADR-0007 + ADR-0006 juntos garantem que cada minuto ppm tem 1 linha em `usage_record` + 1 incremento em `pay_per_minute_daily_usage`. Reconciliador confere os dois.
- **Stripe Reporter fica trivial** — query `WHERE stripe_invoice_item_id IS NULL` é o universo de cobrança. Sem precisar inventar JOIN entre sessions e plans no momento da geração de invoice.
- **Snapshot horário** — `MonthlyUsage` é O(1) para o BillingResolver (ADR-0007) e para painéis de tenant. Sem agregação on-demand em hot path.
- **Schedule e Rooms compartilham contrato `UsageRecord`** — futura extração de `plexcare-billing-api` só consome essa tabela, sem aprender domínios.

### Negativas / Trade-offs

- **2 fontes de uso por produto** (sessions/messages + usage_record) — reconciliação cobre divergência, mas adiciona disciplina. Mitigação: integration test obrigatório `participant_left → usage_record com kind correto`.
- **Tópico `metering.usage` deprecado** — código hoje publica nele (process_event.go:134). Migração: keep publishing por 2 sprints + publicar também em `usage.recorded`; consumers migram; depois remove.
- **`MonthlyScheduleUsage` no `schedule-api` quebra simetria** (`MonthlyUsage` está em Go no `teleconf-service`, mas `schedule-api` ainda está sem stack definido). Decisão de stack do `schedule-api` (ADR futuro) precisa replicar arquitetura hexagonal.
- **Worker = SPOF lógico**. Lock distribuído via mesmo padrão do `idp_cron_lock` (ADR-0005) — recovery em < 1 tick.

### Neutras / a observar

- `UsageRecord.SourceEventID UNIQUE` impede double-counting se Kafka entregar duplicata — pago no preço de 1 INSERT que pode falhar com `23505`, capturado e logado.
- Snapshot horário implica que dashboard de tenant pode mostrar uso "atrasado" em até 1h. Aceitável; tenant que quer "live" lê direto `sessions` (degradação controlada).

## Alternativas consideradas

### Alternativa A — Serviço único `plexcare-metering` consumindo Kafka dos dois

- Prós: 1 source-of-truth, agregação cross-produto natural (Suite).
- Contras: +1 serviço para operar; coupling temporal via Kafka (sem evento = sem cobrança); blocking factor para `schedule-api` ainda nascer.
- Por que não: extrair quando primeiro cliente Suite pedir invoice consolidado real. Padrão **move-then-extract**.

### Alternativa B — Stripe metered consome direto de `participant_left`

- Prós: zero schema interno; Stripe agrega.
- Contras: round-trip Stripe API por evento (custo de fee + latência); reconciliação interna fica cega; falhas de rede consomem orçamento de retry.
- Por que não: viola princípio de "source-of-truth interno" — se quisermos trocar Stripe por Iugu/outro, refactor é total.

### Alternativa C — Materializar `MonthlyUsage` apenas no fim do período

- Prós: zero cron, zero infra.
- Contras: leitura de "current usage" para BillingResolver (ADR-0007) e UI vira agregação ao vivo nas tabelas-fonte. Latência aceitável para 10 tenants, inaceitável para 10k.
- Por que não: bloqueia escala. Cron horário custa < R$ 1/mês.

### Alternativa D — `UsageRecord` sem `kind` (gravar sempre, classificar no Reporter)

- Prós: simplicidade no metering.
- Contras: Reporter precisa reler `tenant_subscription_view` no momento da cobrança — janela para regressão se plano mudou entre uso e fechamento.
- Por que não: `kind` capturado no momento do evento garante que cobrança usa **regra do momento do consumo**, não do momento do fechamento. Mesma lógica do `Room.BillingMode` immutable do ADR-0007.

## Plano de revisão

Reavaliar quando **qualquer** das condições disparar:

- **Reconciliador detecta divergência > 0.5%** sistematicamente — bug no `classifyUsage` ou no consumer Kafka.
- **MRR Suite ≥ R$ 200k/mês** — extrair `plexcare-billing-api` que assume `usage.recorded` (mesmo gate do ADR-0008).
- **Volume > 1M `usage_record`/mês por banco** — particionar tabela por período.
- **`participant_left` perdido > 0.1%** das sessões — fecha sessão por timeout de `participant_joined` há > `MaxDuration + 30min` (cleanup job).
- **`metering.usage` consumer ainda em uso depois de 2 sprints** — remoção real do tópico legado.

## Referências

- [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §11 pergunta 1
- [ADR-0005 Outbox + worker poll](./0005-outbox-worker-poll.md) — base para publicar `usage.recorded` com at-least-once
- [ADR-0007 Encaixe online cross-produto](./0007-encaixe-online-cross-produto.md) — `Room.BillingMode` + `pay_per_minute_daily_usage` que este ADR consome
- [ADR-0008 Plan data model](./0008-plan-data-model.md) — `tenant_subscription_view` que classifica `kind`
- `internal/metering/application/process_event.go:108-153` — call site `handleLeft` a ser modificado
- `internal/metering/domain/usage.go:43-51` — `MonthlyUsage` que ganha worker
- `internal/metering/ports/ports.go:10-25` — ports a serem estendidos (UsageRecord, DailyUsage)
- `webhookbridge/bridge.go:69-84` — fix do bug 22P02 (memória `plexcare-metering-root-cause` está stale)
- Memória: [[plexcare-adr-0008-plan-data-model]] · [[plexcare-metering-root-cause]] · [[plexcare-monetization-scope]]
