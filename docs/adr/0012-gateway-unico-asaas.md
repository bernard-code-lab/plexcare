# ADR-0012 — Gateway único de pagamento: ASAAS

- **Data:** 2026-06-07
- **Status:** Accepted — supersede [ADR-0010](0010-billing-gateway-stripe-iugu.md)
- **Deciders:** Solutions Architect, Founder (operador backend)
- **Tags:** `area/backend` `area/billing` `compliance/lgpd` `module/plexcare-idp-api` `gtm/mvp`
- **Consultar antes:** [ADR-0008](0008-plan-data-model.md) (catálogo idp-api), [ADR-0005](0005-outbox-worker-poll.md) (outbox), [ADR-0010](0010-billing-gateway-stripe-iugu.md) (substituído por este)
- **Vigência prevista:** MVP até M11 GTM (Jun/2027); revisão obrigatória em M12 ou quando uma das condições da seção [§ Plano de revisão](#plano-de-revisão) for atingida.

## Contexto

ADR-0010 fixou **Stripe Metered + Iugu paralelo** com a tese: "Stripe cobra cartão internacional-grade; Iugu cobre PIX/boleto que Stripe não faz bem em BR; metered nativo do Stripe é diferencial". Duas semanas depois, três fatos novos forçam reavaliação:

1. **Operador real é solo + IA-driven dev.** Backend senior trabalhando em paralelo com agentes Claude. Tempo é o recurso mais caro; complexidade operacional (dois webhook handlers, duas reconciliações, dois dashboards) consome velocidade desproporcionalmente.
2. **Taxas reais de mercado, verificadas em 2026-06-07**, divergem das premissas do ADR-0010. Stripe Billing cobra +0,7% sobre subscription, que não estava na conta original. PIX BR commoditizou (todos os players têm taxa similar).
3. **ASAAS surgiu como candidato sério** com proposta de mercado: cartão 2,99% + R$ 0,49 sem mensalidade, PIX/boleto fixo R$ 1,99, antecipação D+0 automática opcional. Pagar.me também foi avaliado (4,39%+ público).

Decisão deste ADR: substituir o desenho dual-gateway por **ASAAS como gateway único** no MVP, com critérios explícitos para reabertura.

## Decisão

### O que muda

| Componente | ADR-0010 (revogado) | ADR-0012 (vigente) |
|---|---|---|
| Gateway primário | Stripe Metered | **ASAAS API v3** |
| Gateway PIX/boleto | Iugu | ASAAS (mesma API) |
| Webhook handlers | 2 conjuntos | 1 conjunto |
| Source-of-truth de uso | PlexCare (read-model ADR-0008) | **idem** — não muda |
| Cálculo de invoice | Stripe usage records + invoice | PlexCare calcula → cobrança avulsa via ASAAS API |
| Subscription management | Stripe Billing (+0,7%) | ASAAS Subscriptions nativo (0% extra) |
| Antecipação cartão | configurável | **D+0 opt-in** (free a 1,25%/mês) |
| Multi-moeda USD/EUR | suportado (Stripe) | **fora de escopo** — adia internacionalização |

### Por que ASAAS

Três razões com peso desigual:

1. **TCO concretamente menor.** Cenário M11 (MRR R$ 220k, mix 60/30/10): ASAAS R$ 5.763/mês (2,62% do MRR) vs Stripe+Iugu R$ 7.518/mês (3,42%). Economia M11 = R$ 21k/ano; M16 (MRR R$ 850k) = ~R$ 81k/ano linear. Composição: cartão 2,99% < Stripe 3,99%; PIX R$ 1,99 fixo < 1,19% percentual em tickets altos (Rooms Solo anual R$ 1.428 → R$ 1,99 vs R$ 17 do percentual); boleto R$ 1,99 < R$ 2,80–3,45 dos concorrentes; zero Billing fee vs +0,7% do Stripe Billing.
2. **Complexidade operacional 50% menor.** Solo + IA escala melhor com superfície menor: 1 webhook handler, 1 outbox topic de billing, 1 reconciliação contábil. ADR-0008 já garante que somos source-of-truth de uso — ASAAS não precisa de metered billing nativo (que era a defesa do Stripe no ADR-0010).
3. **Antecipação D+0 melhora cash flow em ramp-up.** Stripe D+30 + Pagar.me D+15 retêm receita realizada no caixa do gateway. Em M11, ~R$ 220k pode ficar retido. ASAAS Avançado libera D+0 com fee free a 1,25%/mês — em ramp-up acelerado isso é alavanca real.

### Por que não Stripe+Iugu (ADR-0010)

- **TCO 30% maior** com taxas verificadas (3,42% vs 2,62%). Stripe Billing fee +0,7% que não estava na conta original do ADR-0010 mata grande parte da vantagem de metered nativo.
- **Multi-gateway dobra superfície de bug em billing** — área onde bug = receita perdida silenciosa. Não cabe em solo + IA pro MVP.
- Suporte a USD/EUR (vantagem real do Stripe) está fora do GTM até M16+. Quando entrar, ADR-NNNN adiciona Stripe ao lado sem refactor amplo (ver [§ Arquitetura](#arquitetura)).

### Por que não Pagar.me

- **Cartão 4,39% + R$ 0,99 público** vs ASAAS 2,99% + R$ 0,49 — diferença material no componente dominante (60% do volume).
- Plano "Customizado" pode negociar para 2,99%–3,49% mas exige volume comprovado (≥ R$ 500k MRR). Não aplica no MVP.
- Antecipação D+15 default vs D+0 do ASAAS Avançado.
- DX premium do Pagar.me (API/docs) não é diferencial: backend senior + IA absorve API "OK" do ASAAS.

### Por que não Iugu standalone

- Taxas não publicizadas — tudo sales-led. Fricção pra solo + IA validar e ajustar pricing.
- API e ecossistema sem ganho mensurável sobre ASAAS.

## Arquitetura

### Contrato e abstração

O código mantém **abstração `BillingGateway`** em `internal/billing/ports/` (a criar no idp-api ou em serviço dedicado, conforme implementação) com interface mínima:

```typescript
interface BillingGateway {
  createCustomer(tenant: TenantContext): Promise<GatewayCustomerId>;
  createSubscription(input: CreateSubscriptionInput): Promise<GatewaySubscriptionId>;
  cancelSubscription(id: GatewaySubscriptionId): Promise<void>;
  chargeUsage(input: ChargeUsageInput): Promise<GatewayInvoiceId>;
  parseWebhook(raw: WebhookPayload): Promise<NormalizedBillingEvent>;
}
```

Apenas **AsaasBillingGateway** é implementado no MVP. Adicionar StripeBillingGateway/PagarmeBillingGateway no futuro = 1 adapter novo, sem refactor de domínio. ADR-0008 já modelou catálogo agnóstico de gateway (`tenant_subscription.gateway_subscription_id` é string opaca).

### Fluxo de cobrança

```
[1] tenant_subscription criada/atualizada no idp-api MySQL
     │
     ▼
[2] AsaasBillingGateway.createSubscription → ASAAS Subscriptions API
     │   (recebe gateway_subscription_id, gateway_customer_id)
     ▼
[3] Outbox publica subscription.created no Kafka (ADR-0005)
     │
     ▼
[4] Consumer no teleconf-service projeta tenant_subscription_view (ADR-0011 §D-2)
     │
     ▼
[5] Fim do ciclo mensal: idp-api roda job AggregateBillingUsage
     │   - Lê monthly_usage do teleconf (Postgres) via API interna
     │   - Calcula overage (minutos > pool incluso × R$ 0,15-0,25)
     │   - Compõe invoice items (base subscription + overage)
     ▼
[6] AsaasBillingGateway.chargeUsage → cobrança avulsa via ASAAS API
     │   (PIX/boleto/cartão conforme método salvo do customer)
     ▼
[7] ASAAS dispara webhook quando invoice é paga
     │
     ▼
[8] Webhook handler → outbox billing.events → projeção
```

### Webhook handler

Único endpoint: `POST /v1/webhooks/asaas` no idp-api. Eventos relevantes:

| Evento ASAAS | Ação interna | Tópico Kafka |
|---|---|---|
| `PAYMENT_CREATED` | grava invoice em `billing_invoice` | `billing.invoice.generated` |
| `PAYMENT_RECEIVED` | marca invoice como paga, libera features se em past_due | `billing.invoice.paid` |
| `PAYMENT_OVERDUE` | marca subscription como `past_due` | `billing.payment.failed` |
| `PAYMENT_DELETED` / `PAYMENT_REFUNDED` | refund flow, reverse subscription state | `billing.payment.refunded` |
| `SUBSCRIPTION_CREATED` | sanity check vs idp-api state | (auditoria) |
| `SUBSCRIPTION_UPDATED` | reflexa em `tenant_subscription` | `tenant.subscription.changed` |

Segurança: webhook autentica via header `asaas-access-token` (HMAC compartilhado em Secrets Manager). Endpoint NÃO recebe `Authorization: Bearer`.

### Idempotência

ASAAS pode reentregar webhooks. Handler é idempotente via `idp_idempotency` (tabela já existente no idp-api — `Gotcha` documentado no CLAUDE.md do idp-api). Chave: `asaas_payment_id` ou `asaas_event_id`.

### Reconciliação

Job cron diário no idp-api (`billing-reconciler.worker`) faz:
1. Lista invoices ASAAS via API (`/v3/payments?dateCreated[ge]=...`) das últimas 48h.
2. Compara com `billing_invoice` local (status, valor).
3. Discrepância → log + alerta Slack + cria registro em `billing_discrepancy` para análise manual.

Justificativa: webhook drop não é teórico (todo gateway tem). Reconciliação é defesa em profundidade.

## Consequências

### Positivas

- **TCO menor em ~R$ 81k/ano em M16** (linearmente projetado).
- Complexidade de billing reduzida em ~50%: 1 adapter, 1 webhook endpoint, 1 reconciliação.
- ADR-0008 honrado: read-model do teleconf é fonte de uso; gateway não duplica.
- Sem dependência de Stripe Billing (+0,7%) — metered cálculo é nosso, gateway é só pipe.
- Antecipação D+0 opt-in melhora cash flow em ramp-up acelerado.
- Adapter `BillingGateway` abstrato preserva opcionalidade futura de Stripe/Pagar.me/Iugu.
- Webhook reduzido para um endpoint = surface de bug de billing 50% menor.

### Negativas / Trade-offs

- **Single point of failure no provedor.** ASAAS cai por X horas → cobrança nova suspensa. Mitigação: reconciliação diária, retry exponencial no handler, métrica `billing_gateway_availability` com alerta.
- **PIX R$ 1,99 fixo é ruim para tickets baixos.** Pay-per-minute (R$ 0,25/min × 100 min = R$ 25) com R$ 1,99 fixo = 8% efetivo. Mitigação: pay-per-minute é cobrado mensalmente agregado (invoice único de fim de ciclo), não tx individual — fica diluído.
- **USD/EUR não suportado.** Adia internacionalização. Quando vier (M16+), abrir ADR para adicionar Stripe como segundo gateway via abstração `BillingGateway`.
- **Lock-in moderado.** Trocar gateway exige migrar `gateway_customer_id`/`gateway_subscription_id` de todos os tenants. Mitigação: ASAAS exporta customers via API + abstração no código deixa código próprio agnóstico.
- **Negociação Enterprise pode quebrar premissa.** Prospects Enterprise (M9+) podem exigir contrato Stone/Pagar.me ou pricing customizado. Mitigação: ADR-NNNN para adicionar segundo gateway via abstração; não bloqueia MVP.

### Riscos remanescentes

- **R1** — ASAAS uptime cai abaixo de 99,5% por 3 meses → reabrir multi-gateway. Monitorar via dashboard de incidentes.
- **R2** — Tributação BR muda significativamente (PIX com split tributário previsto pra fim de 2026) → reavaliar fees efetivos pós-imposto.
- **R3** — Pricing do ASAAS muda (a tabela atual é "promoção nova conta" + tabela padrão; podem subir taxa). Auditar trimestralmente.
- **R4** — Chargeback ratio acima de 0,5% acumulado vira fricção com ASAAS — política de risk varia por gateway, Stone/Pagar.me têm tolerância maior. Monitorar.

### Neutras / a observar

- Métricas obrigatórias no observability stack:
  - `billing_gateway_request_seconds{operation, status}` (histogram)
  - `billing_gateway_webhook_received_total{event_type}`
  - `billing_gateway_availability_ratio` (rolling 30d)
  - `billing_invoice_generated_total{status}`
  - `billing_reconciliation_discrepancy_total`
- Alerta SRE: `billing_gateway_availability_ratio < 0,995` por > 2h.

## Alternativas consideradas

### A — Stripe Metered + Iugu paralelo (ADR-0010)

- Prós: Stripe Billing nativo metered; Iugu cobre PIX/boleto; failover entre gateways.
- Contras: TCO 30% maior (verificado); 2 webhook handlers; 2 reconciliações; +0,7% Stripe Billing não estava na conta original.
- Por que não: solo + IA prioriza superfície menor; TCO concreto contra; metered nativo era diferencial que não se justifica quando source-of-truth de uso é nosso.

### B — Pagar.me À Vista único

- Prós: API e DX referência BR; Stone tem conta-key Enterprise.
- Contras: cartão 4,39% + R$ 0,99 público (vs 2,99% + R$ 0,49 ASAAS); D+15 default; boleto R$ 3,49 > R$ 1,99 ASAAS.
- Por que não: DX premium não compensa fee mais alto neste perfil de operador.

### C — Iugu único

- Prós: integração já contemplada no ADR-0010.
- Contras: taxas não publicizadas — tudo sales-led. Fricção pra ajustar pricing rapidamente. API/ecossistema sem ganho mensurável sobre ASAAS.
- Por que não: opacidade comercial em fase de validação.

### D — Stripe puro (sem Iugu)

- Prós: 1 gateway, API top, USD/EUR pronto.
- Contras: TCO 19% maior que ASAAS (3,12% vs 2,62%); PIX 1,19% gated por convite; antecipação default D+30.
- Por que não: TCO maior + acesso PIX gated.

### E — ASAAS + Stripe paralelo (multi-gateway)

- Prós: cobre BR e USD/EUR; failover.
- Contras: dois adapters, dois webhook handlers, dobro de complexidade — contradição com a justificativa principal deste ADR (operação solo).
- Por que não: prematuro. ADR-NNNN faz isso quando internacionalização entrar no GTM.

## Plano de revisão

Reavaliar este ADR — possivelmente reabrindo multi-gateway ou trocando gateway — se **qualquer** das condições for atingida:

| Condição | Disparo | Resposta esperada |
|---|---|---|
| Pipeline Enterprise concreto > R$ 50k ACV exige Stone/Pagar.me/contrato customizado | Lead qualificado fechando contrato em < 60d | Adicionar Stripe ou Pagar.me como segundo gateway via abstração `BillingGateway`; manter ASAAS pra base PME |
| Internacionalização (USD/EUR) entra no GTM | Anúncio público de tier export ou cliente fora-BR fechando | Adicionar Stripe (única opção viável) ao lado |
| MRR > R$ 500k | Métrica mensal | Negociar redução de taxa ASAAS direto OU adicionar segundo gateway para arbitragem |
| ASAAS uptime cai abaixo de 99,5% por 3 meses consecutivos | SRE dashboard | Adicionar Iugu ou Stripe como fallback |
| Pricing ASAAS sobe materialmente (> 0,5% no cartão ou > R$ 0,30 no PIX/boleto fixo) | Auditoria trimestral | Renegociar ou trocar |
| Litígio jurídico com ASAAS / mudança adversa de TOS | Eventos avulsos | Migrar |
| Chargeback ratio > 0,5% acumulado com fricção do ASAAS | SRE/Finance dashboard | Renegociar OU migrar pra Stone (tolerância maior) |

Auditoria trimestral mínima: comparar taxas reais cobradas vs tabela do ADR; reconciliar com mix de pagamento real; recalcular TCO em volumes correntes.

## Referências

- **Substitui:** [ADR-0010](0010-billing-gateway-stripe-iugu.md) — marcar como `Superseded by ADR-0012` no commit que merge este ADR.
- **Depende de:** [ADR-0008](0008-plan-data-model.md) (catálogo idp-api é source-of-truth), [ADR-0005](0005-outbox-worker-poll.md) (outbox para billing events), [ADR-0011](0011-resolucao-tenant-runtime-teleconf.md) (read-model que projeta plan/uso).
- **Taxas verificadas em 2026-06-07:**
  - ASAAS: [`asaas.com/precos-e-taxas`](https://www.asaas.com/precos-e-taxas) — 2,99% + R$ 0,49 cartão à vista, R$ 1,99 PIX, R$ 1,99 boleto pago
  - Stripe BR: [`stripe.com/br/pricing`](https://stripe.com/br/pricing) — 3,99% + R$ 0,39 cartão, 1,19% PIX gated, R$ 3,45 boleto, +0,7% Stripe Billing
  - Pagar.me: [`pagar.me/ofertas`](https://www.pagar.me/ofertas) — 4,39% + R$ 0,99 cartão à vista, 1,19% PIX, R$ 3,49 boleto
  - Iugu: não publica taxas publicamente; sales-led
- **Documentação ASAAS API:** `docs.asaas.com` (a confirmar versão antes de implementação)
- **Memórias:** [[plexcare-monetization-scope]] · [[plexcare-monetization-gtm]] · [[plexcare-adr-0008-plan-data-model]]
- **Compliance:** ASAAS é PSP regulamentado pelo BACEN; LGPD compatível (DPA padrão); CFM 2.314 — relação cobrança/paciente não conflita.
