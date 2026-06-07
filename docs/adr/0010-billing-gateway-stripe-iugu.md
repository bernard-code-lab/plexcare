# ADR 0010 — Gateway de billing: Stripe metered como motor + Iugu paralelo para PIX/boleto

**Status:** Superseded by [ADR-0012](0012-gateway-unico-asaas.md) — 2026-06-07
**Decisores:** Solutions Architect, Stakeholder de produto
**Substituído por:** [ADR-0012 — Gateway único de pagamento: ASAAS](0012-gateway-unico-asaas.md)

> **Nota de superseção (2026-06-07):** este ADR foi substituído ~2h após sua emissão. Razões em ADR-0012 §Contexto: (a) operador real é solo + IA-driven, exigindo superfície menor; (b) taxas verificadas em 2026-06-07 mostraram TCO 30% maior para Stripe+Iugu vs ASAAS; (c) Stripe Billing +0,7% não estava na conta original deste ADR. ASAAS único entrega 2,99% + R$ 0,49 cartão à vista, PIX/boleto R$ 1,99 fixo, antecipação D+0 opcional. Mantido como histórico de decisão e como referência para reabertura de multi-gateway (ver ADR-0012 §Plano de revisão).
**Consultar antes:** [ADR-0005 Outbox + worker poll](./0005-outbox-worker-poll.md) · [ADR-0006 Metering Rooms+Schedule](./0006-metering-rooms-schedule.md) · [ADR-0007 Encaixe online cross-produto](./0007-encaixe-online-cross-produto.md) · [ADR-0008 Plan data model](./0008-plan-data-model.md) · [ADR-0009 Pool compartilhado Suite](./0009-pool-compartilhado-suite.md) · [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §6 (custos) + §11 perguntas 4, 7, 9

## Contexto

ADRs 0006-0009 entregaram **metering**, **decisão de cobrança** e **modelo de planos**, mas ninguém ainda fala com gateway externo. Pricing congelado (§3-5) define 9 planos + overage + pay-per-minute + 15% off Suite — tudo precisa virar invoice no fim do mês.

Requisitos hard:

1. **Cobrança recorrente** (subscription mensal/anual) — `tenant_subscription` do ADR-0008.
2. **Metered billing** (minutos overage Rooms, mensagens overage Schedule, pay-per-minute) — `usage_record` do ADR-0006.
3. **Invoice consolidado para Suite** — §11 pergunta 9 do artefato.
4. **PIX e boleto** — mercado BR exige; cartão sozinho perde 30-40% de clínicas pequenas.
5. **Dunning** (cartão recusado → past_due → suspender) — alimenta `BillingResolver` (ADR-0007) com sinal de `past_due`.
6. **Source-of-truth = nosso DB** — se gateway cair, ainda emitimos invoice no fim do mês.

Custos relevantes (§6 do artefato):

- Stripe Brasil cartão: 3,99% + R$ 0,39
- Iugu PIX: R$ 0,99 / boleto pago: R$ 2,80
- Lago/OpenMeter (alternativa de aggregator interno): ~US$ 200-500/mês infra + ops

Decidir agora porque:

- ADR-0006 já tem `usage_record.stripe_invoice_item_id` — esse campo precisa ser real até primeira cobrança.
- ADR-0008 já tem `plan.stripe_price_lookup_key` — seed de migration precisa do gateway escolhido.
- ADR-0007 depende do sinal `past_due` para rejeitar criação de sala — webhook do gateway precisa estar definido.

## Decisão

**Stripe metered como motor primário + Iugu como gateway paralelo apenas para método de pagamento (PIX/boleto).** `plexcare-billing-api` (novo serviço, futuro extrair) NÃO entra no v1 — código de gateway fica em **`internal/billing/`** do `teleconf-service` (mesmo bounded context do ADR-0007). Schedule-api consome via Kafka `subscription.events`.

### 1. Arquitetura de cobrança

```
┌─────────────────────────────────────────────────────────────────┐
│ plexcare-idp-api  (MySQL — source of truth de subscriptions)    │
│                                                                 │
│  tenant_subscription ──outbox──> Kafka subscription.events     │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌──────────────────┐                       ┌────────────────────┐
│ teleconf-service │                       │ schedule-api       │
│ usage-metering   │                       │ usage-metering     │
│                  │                       │                    │
│ usage_record ────┐                       │ usage_record ──────┐
└──────────────────┘                       └────────────────────┘
                   │                                            │
                   └────────────┐                ┌──────────────┘
                                ▼                ▼
                       ┌────────────────────────────────┐
                       │ stripe-reporter (cron diário)  │
                       │  - lê usage_record WHERE       │
                       │    stripe_invoice_item_id IS   │
                       │    NULL                        │
                       │  - cria Stripe Invoice Item    │
                       │    em batch                    │
                       │  - marca stripe_invoice_item_id│
                       └────────────────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │ Stripe Brasil        │
                            │ - Subscription       │
                            │ - Invoice Items      │
                            │ - Webhooks           │
                            └──────────────────────┘
                                       │
                            ┌──────────┴───────────┐
                            ▼                      ▼
                  ┌──────────────┐       ┌────────────────────┐
                  │ Cartão       │       │ Iugu (paralelo)    │
                  │ (Stripe)     │       │ PIX / boleto       │
                  └──────────────┘       │ - invoice clonado  │
                                         │   via API          │
                                         │ - webhook → marca  │
                                         │   Stripe paid      │
                                         └────────────────────┘
```

### 2. Mapeamento `plan` ↔ Stripe

- Cada `plan` ativo tem **um Stripe Product + um Stripe Price** (lookup_key = `plan.code`).
- `tenant_subscription.stripe_subscription_id` = Stripe Subscription. Preço base do tier (assinatura recorrente fixa).
- Overage e pay-per-minute = **Invoice Items adicionados manualmente** pelo Reporter ao invoice em aberto da subscription. Stripe consolida no fechamento do `current_period_end`.
- Suite = 1 Subscription com 1 Price (preço com 15% off já embutido no `plan.price_brl_cents`). Invoice consolidado vem nativo.

### 3. Iugu como método de pagamento — não como gateway separado

**Não duplicamos subscription no Iugu.** Stripe permanece source-of-truth de invoice. Para PIX/boleto:

1. Stripe emite invoice → status `open`.
2. Nosso webhook handler escuta `invoice.finalized` → se tenant marcou `payment_method=pix` ou `boleto` no perfil, **cria invoice espelho no Iugu** (Iugu API `POST /v1/invoices`) com mesmo `total_cents` e `external_id = stripe_invoice.id`.
3. Iugu envia link PIX/QR ou boleto ao tenant.
4. Iugu webhook `invoice.status_changed=paid` → nosso handler chama Stripe API `POST /v1/invoices/{id}/pay` com `paid_out_of_band=true`. Stripe marca como pago externamente.
5. Conciliação financeira: extrato Stripe (cartão) + extrato Iugu (PIX/boleto) → soma é a receita BR.

**Vantagem:** mantém Stripe como motor de subscription/dunning/metered. Iugu só executa rail de pagamento BR-específico.

**Desvantagem:** invoice duplicado em dois sistemas → reconciliador precisa estar correto. Risco contido por `external_id` UNIQUE em ambos os lados.

### 4. Dunning

Stripe Smart Retries habilitado em produção:

- Cartão recusado → Stripe retry automático (3 tentativas em 14 dias).
- `invoice.payment_failed` webhook → nosso handler marca `tenant_subscription.status='past_due'` no MySQL → outbox publica `subscription.updated` → `tenant_subscription_view` (Postgres) atualiza → ADR-0007 `BillingResolver` passa a rejeitar `CreateRoom` com `402 payment_required`.
- Após 14 dias sem pagamento, Stripe `customer.subscription.deleted` → marcamos `status='canceled'`. Acesso bloqueado, dados retidos 90 dias (LGPD: razão = "potencial reativação").
- PIX/boleto Iugu = cobrança única por invoice; se não pago em 7 dias, Iugu marca expired → nosso handler emite novo invoice Stripe (`paid_out_of_band=false`) e reinicia ciclo.

### 5. Source-of-truth = nosso DB

`tenant_subscription` no `idp-api` MySQL é o source-of-truth lógico. Stripe é a "verdade financeira" cobrada, mas nosso outbox publica `subscription.created/updated/canceled` para todos os outros serviços. Razão (ADR-0005): se Stripe cair 1h, ainda emitimos events e cobramos no batch noturno.

`usage_record.stripe_invoice_item_id` materializa o link com Stripe — antes de preenchido, evento ainda é nosso. Após preenchido, valor é também responsabilidade Stripe.

### 6. Quem implementa o quê

| Componente | Onde | Owner |
|---|---|---|
| `internal/billing/infrastructure/stripe/` (client + reporter cron) | `teleconf-service` | Software Engineer Backend |
| `internal/billing/infrastructure/iugu/` (client + invoice mirror) | `teleconf-service` | Software Engineer Backend |
| Webhook handlers Stripe + Iugu | `teleconf-service` HTTP routes | Software Engineer Backend |
| `plexcare-schedule-api/internal/billing/` (reporter próprio) | `schedule-api` | quando schedule-api ganhar código real |
| Migration `plan.stripe_price_lookup_key` + seed | `idp-api` | Software Engineer Backend |
| Painel `tenant_subscription` (admin interno) | `site/admin/` | Fullstack Engineer (futuro) |

### 7. Quando extrair `plexcare-billing-api` standalone

Mesmo gate do ADR-0008/0009: **MRR Suite ≥ R$ 200k/mês**. Até lá, código fica em `internal/billing/` de cada serviço. Extração futura consome `usage.recorded` (Kafka) e expõe `BillingResolver` via gRPC.

## Consequências

### Positivas

- **Stripe entrega 80% do problema fora-da-caixa** — subscription, invoice, metered, dunning, webhooks. Time foca em integração + reconciliação, não em construir billing engine.
- **Iugu paralelo cobre PIX/boleto** sem duplicar subscription model — risco contido.
- **Source-of-truth interno** (outbox + `usage_record`) permite trocar gateway sem refactor — se daqui 18 meses Iugu virar primário, mesmo modelo.
- **Latência aceitável** — cobrança é batch noturno (ADR-0007), não hot path. Stripe API fora? Reporter tenta amanhã.
- **Custo razoável** — Stripe 3,99% + Iugu R$ 0,99 PIX é competitivo para o BR. Sem fee de aggregator externo.

### Negativas / Trade-offs

- **2 sistemas de invoice paralelos** (Stripe + Iugu) — reconciliador precisa estar correto. Mitigação: `external_id` UNIQUE + alerta de divergência diária > R$ 100.
- **Stripe webhooks são eventually consistent** — `invoice.payment_failed` pode chegar 30s depois do pagamento real falhar. `BillingResolver` (ADR-0007) já tolera janela de 1s do read-model; webhook fica mais tarde mas com mesmo padrão.
- **Vendor coupling parcial com Stripe** — `stripe_subscription_id`, `stripe_invoice_item_id`, `stripe_price_lookup_key` vivem no nosso schema. Migração total a outro gateway exige script de migração de subscriptions. Aceitável: gateway switching é evento raro.
- **Iugu API é menos madura que Stripe** — bugs/instabilidade afetam PIX/boleto. Mitigação: fallback automático para cartão Stripe se Iugu invoice falhar 3x.
- **Sem `plexcare-billing-api` no v1** — código de gateway fica acoplado ao `teleconf-service`. Mitigação: `internal/billing/` é bounded context isolado; extração é mecânica.

### Neutras / a observar

- **Cobrança em USD para Enterprise internacional** (fora desta etapa) — Stripe trivializa, Iugu fica de fora. Marcar como adiada.
- **Marketplace Stripe Connect** (futuro: marketplace de laudos) — abre porta sem migration.

## Alternativas consideradas

### Alternativa A — Stripe puro, sem Iugu

- Prós: 1 sistema, simplicidade máxima.
- Contras: PIX via Stripe Brasil ainda é early-access + cobrança boleto inexistente nativamente. Perde 30-40% de clínicas pequenas que pagam por boleto.
- Por que não: BR exige boleto/PIX para B2B em saúde.

### Alternativa B — Iugu puro, sem Stripe

- Prós: cobre PIX/boleto nativamente; preço BR competitivo.
- Contras: metered billing rudimentar; sem Smart Retries; sem subscription pause; menos maduro para SaaS.
- Por que não: perdemos o motor de cobrança recorrente que Stripe entrega.

### Alternativa C — Lago + Stripe gateway

- Prós: source-of-truth interno robusto; pluggable de gateways.
- Contras: +1 serviço para operar (US$ 200-500/mês + ops); overkill para v1.
- Por que não: nossa outbox + `usage_record` já é Lago-light. Justifica só com MRR ≥ R$ 500k.

### Alternativa D — OpenMeter + Stripe

- Prós: open-source, mesma proposta de Lago.
- Contras: comunidade menor; menos maduro.
- Por que não: mesma razão da C; ainda mais cedo no ciclo.

### Alternativa E — `plexcare-billing-api` standalone desde v1

- Prós: arquitetura "correta" desde o início.
- Contras: +1 serviço para operar; sem dor real; bloqueia entrega.
- Por que não: mesma lógica de ADRs 0008/0009. Extrair quando MRR justificar.

### Alternativa F — Pagar.me em vez de Iugu

- Prós: PIX/cartão BR maduro; subscription nativa.
- Contras: marketplace fee maior; documentação menos limpa; menos métodos suportados.
- Por que não: Iugu tem boleto + PIX + integração mais limpa para invoice clonado. Reavaliar se Iugu falhar SLA.

## Plano de revisão

Reavaliar quando **qualquer** das condições disparar:

- **MRR ≥ R$ 200k/mês** — extrair `plexcare-billing-api` standalone.
- **Iugu invoice failure rate > 5%/mês** — trocar por Pagar.me ou outro.
- **Stripe Brasil PIX/boleto** maduros (cobertura de método igual à Iugu) — eliminar Iugu, simplificar.
- **Expansão internacional** — adicionar suporte multi-currency em `plan` + `tenant_subscription`.
- **Marketplace de laudos** (out-of-scope hoje) — adotar Stripe Connect.
- **Reconciliador detecta divergência > R$ 100/dia** sistematicamente — bug no espelho Iugu/Stripe.

## Referências

- [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §6 (custos) + §11 perguntas 4, 7, 9
- [ADR-0005 Outbox + worker poll](./0005-outbox-worker-poll.md) — at-least-once para `subscription.events`
- [ADR-0006 Metering Rooms+Schedule](./0006-metering-rooms-schedule.md) — `usage_record` + `stripe_invoice_item_id`
- [ADR-0007 Encaixe online cross-produto](./0007-encaixe-online-cross-produto.md) — `BillingResolver` lê `status='past_due'`
- [ADR-0008 Plan data model](./0008-plan-data-model.md) — `plan.stripe_price_lookup_key`, `tenant_subscription.stripe_subscription_id`
- [ADR-0009 Pool compartilhado Suite](./0009-pool-compartilhado-suite.md) — Suite v1 = 1 Subscription Stripe com price -15%
- Stripe Brasil docs: https://stripe.com/docs/billing
- Iugu API: https://dev.iugu.com/reference
- Memória: [[plexcare-monetization-scope]] · [[plexcare-adr-0008-plan-data-model]]
