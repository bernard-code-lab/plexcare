# ADR 0007 — Encaixe online cross-produto: `BillingResolver` + chamada síncrona `schedule-api → teleconf-service` com pay-per-minute capped

**Status:** Proposed — 2026-06-07
**Decisores:** Solutions Architect, Stakeholder de produto
**Substitui:** —
**Consultar antes:** [ADR-0001 Kafka como event bus](./0001-kafka-como-event-bus-interno.md) · [ADR-0002 Multi-tenancy via header + context](./0002-multi-tenancy-via-header-context.md) · [ADR-0005 Outbox + worker poll](./0005-outbox-worker-poll.md) · [ADR-0008 Plan data model](./0008-plan-data-model.md) · [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §4 (encaixe online), §11 (perguntas 3, 5, 8)

## Contexto

O artefato de pricing (Etapa 1) introduziu o **encaixe online** como ponte entre Schedule e Rooms: quando uma consulta agendada no `plexcare-schedule-api` é marcada como modalidade "online", o sistema precisa abrir uma sala virtual no `plexcare-teleconf-service`. O comportamento de cobrança varia conforme o estado do tenant:

| Estado do tenant | Comportamento esperado | Origem do limite |
|---|---|---|
| Tem `rooms-*` ativo | Cria sala normal, desconta de `included_minutes` do plano Rooms | `tenant_subscription_view.rooms_pool_remaining` |
| Tem `suite-*` ativo | Cria sala normal, desconta do pool Suite | `tenant_subscription_view.rooms_pool_remaining` (mesma coluna) |
| Tem `schedule-*` ativo, sem Rooms/Suite | Cria sala, **cobra R$ 0,25/min avulso** (D-5 do artefato) | `ppm_price_cents = 25` + cap diário |
| Sem nenhum plano de comunicação ativo | **Rejeita** com `403 ErrNoActivePlan` | nenhum |
| `status='past_due'` ou `'canceled'` | Rejeita com `402 ErrPaymentRequired` | nenhum |

Hoje, `internal/room/application/create_room.go:62-80` consulta `tenant.FromContext(ctx)` e olha só `MaxConcurrentRooms`. Não distingue produto, não conhece pay-per-minute, não tem cap diário. O `schedule-api` é scaffold — ainda não chama Rooms. Precisamos decidir o contrato antes que ambos os times escrevam código incompatível.

Decidir agora porque:

- ADR-0008 cria o `tenant_subscription_view` que esta decisão consome — desenhar junto evita rework.
- Risco financeiro do pay-per-minute (cliente sem assinatura consumindo minutos pagos) precisa ser quantificado **antes** da feature ir ao ar.
- Sem contrato, o `schedule-api` tende a duplicar lógica de quota localmente (anti-pattern).

## Decisão

**Quatro componentes**:

1. **Novo bounded context `internal/billing/` no `teleconf-service`** com porta `BillingResolver`.
2. **Chamada síncrona HTTP autenticada por mTLS service-to-service** de `schedule-api` para `POST /api/v1/rooms` — Kafka **não** é usado no caminho de criação (precisa devolver `host_token` síncrono).
3. **Cap diário hard de R$ 200/tenant** para pay-per-minute, com pré-autorização Stripe SetupIntent no momento da ativação do Schedule.
4. **Reserva otimista de minutos** na criação + ajuste no `participant_left` via evento `metering.usage` (ADR-0006).

### 1. `BillingResolver` (novo port)

```go
// internal/billing/ports/ports.go
type BillingResolver interface {
    ResolveBilling(ctx context.Context, tenantID, product string) (BillingDecision, error)
    ReserveMinutes(ctx context.Context, tenantID string, estimatedMinutes int) (ReservationID, error)
    ReleaseReservation(ctx context.Context, id ReservationID) error
}

// internal/billing/domain/decision.go
type BillingDecision struct {
    Mode             Mode   // Included | PayPerMinute | Denied
    Pool             string // "rooms" | "suite" | ""
    PoolRemainingMin int
    PricePerMinute   int    // cents BRL — só relevante se Mode == PayPerMinute
    DailyCapCents    int    // só relevante se Mode == PayPerMinute
    DailyConsumedCents int
    RejectCode       string // "no_active_plan" | "past_due" | "daily_cap_exceeded" | ""
}

type Mode string
const (
    ModeIncluded     Mode = "included"
    ModePayPerMinute Mode = "pay_per_minute"
    ModeDenied       Mode = "denied"
)
```

**Adapter padrão** (`internal/billing/infrastructure/postgres/resolver.go`) lê `tenant_subscription_view` + tabela nova `pay_per_minute_daily_usage(tenant_id, day, consumed_cents)`. Tudo no Postgres local do `teleconf-service` — **zero round-trip externo** no hot path.

### 2. `CreateRoomUseCase` chama `BillingResolver` antes do LiveKit

```go
// internal/room/application/create_room.go (modificação)
func (uc *CreateRoomUseCase) Execute(ctx context.Context, input CreateRoomInput) (CreateRoomOutput, error) {
    tc, _ := tenant.FromContext(ctx)

    decision, err := uc.billing.ResolveBilling(ctx, tc.ID, "rooms")
    if err != nil { return CreateRoomOutput{}, err }

    switch decision.Mode {
    case billing.ModeDenied:
        return CreateRoomOutput{}, domain.ErrBillingDenied(decision.RejectCode)
    case billing.ModePayPerMinute:
        if decision.DailyConsumedCents >= decision.DailyCapCents {
            return CreateRoomOutput{}, domain.ErrDailyCapExceeded
        }
        // continua — cobrança no participant_left via metering
    case billing.ModeIncluded:
        if decision.PoolRemainingMin <= 0 {
            return CreateRoomOutput{}, domain.ErrPoolExhausted
        }
    }

    // Reserva otimista — tolerance window 60s
    reservation, err := uc.billing.ReserveMinutes(ctx, tc.ID, int(input.MaxDuration.Minutes()))
    if err != nil { return CreateRoomOutput{}, err }

    // ... resto: livekit.CreateRoom, gerar tokens, salvar sala (anexar reservation_id), publicar Kafka
}
```

`Room` ganha campo `BillingMode` (persistido em `rooms.billing_mode`) e `ReservationID`. `metering.application.process_event.handleLeft` consulta esses campos para decidir se decrementa pool ou registra `usage_records` p/ pay-per-minute. Detalhe fica no ADR-0006.

### 3. `schedule-api → teleconf-service` é HTTP síncrono mTLS

```
schedule-api (Go)                            teleconf-service (Go)
─────────────────                            ─────────────────────
appointment.confirm(online=true)
    │
    ├─ HTTP POST https://teleconf-internal.plexcare.local/api/v1/rooms
    │  mTLS client cert: schedule-api.svc
    │  Body: { appointment_id, host_identity, guest_identity, max_duration_min }
    │  (X-Tenant-Id é DERIVADO do certificado, não do body — schedule-api não escolhe)
    │
    ◄── 201 { room_id, host_token, guest_token, expires_at, billing_mode }
    │       OU 402 { code: "past_due" } / 403 { code: "no_active_plan" }
    │       OU 402 { code: "daily_cap_exceeded" }
    │
    ├─ persiste appointment.room_id, appointment.billing_mode
    ├─ devolve { join_url } pro front
```

**Razões para HTTP síncrono e não Kafka:**

- Precisa devolver `host_token` antes do médico clicar "iniciar consulta" — não dá pra esperar consumer.
- Erros de billing (past_due, cap exceeded) precisam ser surfaced na UI do Schedule **na hora** da confirmação do appointment, não 30s depois.
- Kafka mantém papel downstream: `room.created` continua publicado para metering, audit, BI.

**Autenticação:** mTLS service-to-service via Istio/Envoy sidecar (futuro ADR de service mesh). Enquanto não há mesh, validar token JWT assinado pelo `idp-api` com claim `aud: teleconf-service` e `scope: rooms.create-on-behalf`. **`X-Tenant-Id` é derivado do JWT, não confiar no body.**

### 4. Cap diário + pré-autorização

```sql
-- Postgres do teleconf-service
CREATE TABLE pay_per_minute_daily_usage (
    tenant_id           UUID NOT NULL,
    day                 DATE NOT NULL,
    consumed_cents      INT  NOT NULL DEFAULT 0,
    last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, day)
);
```

- `BillingResolver.ResolveBilling` lê `consumed_cents` do dia corrente; rejeita se ≥ `daily_cap_cents` (default 20000 = R$ 200).
- `daily_cap_cents` é coluna em `tenant_subscription_view` (default 20000, override por tenant via admin).
- `metering` increamenta `consumed_cents` no `participant_left` quando `Room.BillingMode == pay_per_minute`. UPSERT atômico:
  ```sql
  INSERT INTO pay_per_minute_daily_usage (tenant_id, day, consumed_cents)
  VALUES ($1, CURRENT_DATE, $2)
  ON CONFLICT (tenant_id, day) DO UPDATE
    SET consumed_cents = pay_per_minute_daily_usage.consumed_cents + EXCLUDED.consumed_cents,
        last_updated_at = NOW();
  ```
- **Pré-autorização Stripe SetupIntent** no momento em que o tenant ativa "encaixe online" no Schedule — captura método de pagamento válido. Sem SetupIntent confirmado, `BillingResolver` devolve `ModeDenied{RejectCode: "no_payment_method"}` mesmo se Schedule estiver ativo.
- **Cobrança em batch diário** — cron à meia-noite varre `pay_per_minute_daily_usage` do dia anterior, cria 1 Stripe Invoice Item por tenant, finaliza invoice no fim do `current_period_end` da subscription Schedule. **Não** cobra evento-a-evento (custo de fee Stripe).

### Mensagens de erro padronizadas

| HTTP | Code interno | Descrição |
|---|---|---|
| 402 | `payment_required` | `past_due` ou `no_payment_method` |
| 402 | `daily_cap_exceeded` | Atingiu R$ 200/dia em pay-per-minute |
| 403 | `no_active_plan` | Tenant sem `rooms-*`/`schedule-*`/`suite-*` ativo |
| 409 | `pool_exhausted` | Suite/Rooms incluso esgotado |
| 503 | `billing_resolver_unavailable` | Postgres local fora — fail-closed |

## Consequências

### Positivas

- **Caminho de criação de sala é determinístico e auditável** — 1 decisão, 1 reserva, 1 commit. Substitui o `tc.MaxConcurrentRooms` mágico hoje no `CreateRoomUseCase`.
- **Schedule-api não precisa duplicar lógica de quota** — só chama o endpoint e propaga o erro de billing pro front. Próprio `BillingResolver` cuida do detalhe de pool vs ppm vs denied.
- **Cap diário hard** elimina blast radius do cenário "cliente Schedule sem Rooms agenda 50 consultas online no domingo" — máximo R$ 200/tenant/dia × N tenants.
- **Cache local em Postgres do teleconf-service** mata latência: `ResolveBilling` resolve em <2ms (1 SELECT indexado + 1 SELECT no daily usage), sem round-trip HTTP/Stripe.
- **Pré-autorização Stripe SetupIntent** captura no momento da ativação Schedule — diluindo risco de "cartão recusado no fim do mês".

### Negativas / Trade-offs

- **2 fontes de truth para uso pay-per-minute** durante o dia: `pay_per_minute_daily_usage` (decisão) + `usage_records` (cobrança). Mitigação: reconciliador noturno que confere agregados — se divergem, dispara alerta. Aceitável: durante o dia "decisão" precisa ser rápida (Postgres local), "cobrança" precisa ser durável (outbox).
- **mTLS service-to-service ainda não está implementado** (sem service mesh). Fallback temporário: JWT assinado pelo idp-api com escopo restrito. Quando mesh entrar (futuro ADR), simplifica.
- **Reserva otimista pode "vazar" minutos** se cliente abandonar sala sem `participant_left` (browser crash, rede). Mitigação: TTL na reserva (60min após `expires_at`) + reconciliação noturna que libera reservas órfãs.
- **Pay-per-minute não funciona offline** — se Stripe estiver fora, ainda criamos sala (não bloqueamos) e gravamos `usage_record` pendente. Cobrança fica no batch noturno. Risco contido pelo cap diário.

### Neutras / a observar

- `BillingResolver` é o ponto natural de extensão para futuras políticas: bloqueio por compliance (LGPD/CFM), pause de tenant, modo "trial estendido", precificação dinâmica. Manter o port estreito (3 métodos) e empurrar política para a implementação.
- `Room.BillingMode` em produção precisa ser **immutable após criação** — se tenant fizer upgrade no meio de uma sala ativa, a cobrança da sala já em curso segue o `BillingMode` do momento da criação. Doc visível no painel de uso.

## Alternativas consideradas

### Alternativa A — Schedule-api faz quota check local

- Prós: zero acoplamento de serviços; schedule-api decide tudo.
- Contras: duplica lógica de planos; `teleconf-service` precisa confiar cegamente no que vem do Schedule (incluindo `billing_mode`); buraco de segurança trivial (Schedule comprometido = cliente paga R$ 0).
- Por que não: viola princípio de autoridade — quem cobra é quem decide.

### Alternativa B — Tudo via Kafka (event-driven)

- Prós: desacoplamento máximo; falhas isoladas.
- Contras: `host_token` precisa ser síncrono (UX do médico que clica "iniciar"); fluxo de erro complica (erro de billing chega como evento que o front precisa subscrever); race conditions múltiplas.
- Por que não: encaixe online é interativo, não em background — HTTP síncrono é natural.

### Alternativa C — Stripe metered direto em `CreateRoomUseCase`

- Prós: zero schema novo; Stripe é source-of-truth.
- Contras: latência de Stripe API no hot path da criação de sala (300-800ms); falhas de Stripe = falhas de criar sala. Cap diário fica sem casa natural.
- Por que não: dependência de rede externa no hot path quebra SLO de criação.

### Alternativa D — Sem cap diário, monitoramento por alerta

- Prós: simplicidade.
- Contras: blast radius irrestrito; cliente sem assinatura pode consumir milhares de reais antes de qualquer humano ver alerta.
- Por que não: risco financeiro inaceitável; cap é mecanismo de defesa, não anti-UX (R$ 200 ≈ 800 min/dia = 60+ consultas — passa qualquer caso real).

### Alternativa E — `BillingResolver` chama `idp-api` em vez de read-model local

- Prós: 1 fonte de verdade só.
- Contras: latência HTTP em hot path; `teleconf-service` fica dependente de uptime do `idp-api` para criar sala.
- Por que não: ADR-0008 já decidiu read-model; consistência cross-DB < 1s é suficiente para essa decisão.

## Plano de revisão

Reavaliar quando **qualquer** das condições disparar:

- **Cap diário R$ 200 atingido por > 5% dos tenants/mês** — sinal de que o cap está apertado ou de que precificação ppm está errada.
- **Reservas órfãs > 1% das salas criadas** — mecanismo de release precisa virar event-driven em vez de cron noturno.
- **Latência p99 do `BillingResolver` > 10ms** — read-model precisa de índice/cache adicional.
- **Service mesh disponível** — migrar autenticação JWT-with-scope para mTLS nativo, remover claim custom.
- **Cliente Enterprise pede "sem cap"** — adicionar coluna `pay_per_minute_unlimited BOOLEAN` em `tenant_subscription_view`.

## Referências

- [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §4 (encaixe online), §11 perguntas 3, 5, 8
- [ADR-0008 Plan data model](./0008-plan-data-model.md) — `tenant_subscription_view` que este ADR consome
- [ADR-0005 Outbox + worker poll](./0005-outbox-worker-poll.md) — base de `usage_records` p/ cobrança batch
- `internal/room/application/create_room.go:62-80` — call site a ser modificado
- `internal/room/infrastructure/devtenant/resolver.go` — deprecado em favor de `dbtenant.Resolver` (ADR-0008)
- Issue #3 — Tenant Config Service real
- Issue #17 — `plexcare-auth-api` (provê JWT com claim `aud: teleconf-service`)
- Memória: [[plexcare-adr-0008-plan-data-model]] · [[plexcare-monetization-scope]] · [[plexcare-metering-root-cause]]
