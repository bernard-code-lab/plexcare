# ADR 0009 — Pool compartilhado da Suite: adiar para v2, entregar v1 só com desconto

**Status:** Proposed — 2026-06-07
**Decisores:** Solutions Architect, Stakeholder de produto
**Substitui:** —
**Consultar antes:** [ADR-0006 Metering Rooms+Schedule](./0006-metering-rooms-schedule.md) · [ADR-0007 Encaixe online cross-produto](./0007-encaixe-online-cross-produto.md) · [ADR-0008 Plan data model](./0008-plan-data-model.md) · [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §5 (Suite) + §11 pergunta 2

## Contexto

O artefato de pricing introduziu o **PlexCare Suite** como bundle Rooms + Schedule com duas promessas explícitas (§5):

1. **15% de desconto** sobre a soma dos tiers equivalentes.
2. **Pool compartilhado** de minutos e mensagens (cliente que oscila uso entre Rooms e Schedule nunca paga overage de um se sobra do outro).

A promessa 2 é a fonte do lock-in técnico ("sair da Suite força renegociar 2 contratos e separar pool"). Mas implementação tem custo alto:

- ADR-0008 já tem `tenant_subscription.pool_minutes_remaining` e `pool_messages_remaining` como NULL exceto Suite — schema preparado, mas comportamento de "pool consolidado entre dois pacotes" exige decisão arquitetural.
- ADR-0006 grava `UsageRecord` com `subscription_id`. Pool consolidado quer dizer **uma única subscription** consumindo dois tipos de recurso — modelo limpo no schema, mas BillingResolver (ADR-0007) precisa olhar o mesmo `pool_remaining` para Rooms e para Schedule.
- Sem nenhum cliente Suite pagante hoje (MVP), construir pool agora é optimization sem evidência.

Precisamos decidir agora porque:

- Time pode interpretar §5 do artefato como requisito firme para o v1 e gastar 1-2 sprints sem necessidade.
- Marketing precisa saber **o que comunicar** sobre o pool no go-to-market.
- ADR-0006 e ADR-0008 já têm o schema parcial — confirmar que ele fica "dormindo" até a v2.

## Decisão

**Suite v1 = só desconto -15%. Pool compartilhado adiado para v2.** Três sub-decisões:

### 1. Comportamento v1 do Suite

- `tenant_subscription` com `plan.code='suite-{tier}'` é **1 row** por tenant Suite.
- `included_minutes` e `included_messages` da `plan` Suite são os valores **somados** dos planos Rooms+Schedule equivalentes (§5 do artefato: Suite Clínica = 1500 min + 1500 msg).
- `BillingResolver` (ADR-0007) ao olhar `tenant_subscription_view` de um tenant Suite vê `rooms_pool_remaining` e `messages_pool_remaining` **independentes** (cada um decrementa só pelo seu produto).
- Overage cobrado por produto separado, mesmas tarifas da tabela §3/§4.
- **Comunicação visível**: painel de uso mostra dois contadores ("Minutos Rooms: 1342/1500", "Mensagens Schedule: 890/1500") com nota "Pool compartilhado chegando em breve".

### 2. Como será o pool compartilhado quando entrar (v2)

3 alternativas viáveis para v2. Decisão **diferida**, mas vencedora documentada para reduzir incerteza:

| Opção | Mecanismo | Trade-off principal |
|---|---|---|
| **A — Agregador billing-side** ✅ candidato | Pool vive em `suite_pool(tenant_id, minutes_remaining, messages_remaining)` separado de `tenant_subscription`; atualizado por consumer Kafka de `usage.recorded` | Limpo conceitualmente; metering não muda; latência eventual do pool (cache eventual) |
| B — Sub-tenants | Suite cria tenants filhos (`<tenant>-rooms`, `<tenant>-schedule`) compartilhando pool via parent | Quebra modelo de multi-tenancy (2 níveis); complica todo query em outros serviços |
| C — Pool inline em `tenant_subscription` | `pool_minutes_remaining` e `pool_messages_remaining` viram contadores únicos da subscription Suite; ambos os produtos decrementam | Acoplamento entre Rooms e Schedule via mesma row; race condition cross-produto |

**Candidato A vence porque:**
- Não toca em `tenant_subscription_view` do ADR-0008.
- `BillingResolver` ganha um lookup adicional (`suite_pool`) só quando `active_products` contém 'suite'.
- Pool decremental é eventual (consumer Kafka < 1s) — aceitável para suite, igual ao read-model da subscription.
- Quando primeiro cliente Suite pedir, custo de implementação é **1 tabela + 1 consumer + 1 path no BillingResolver** = 1 sprint.

### 3. Triggers para a v2 entrar

Pool compartilhado vira P1 e abre o ADR-0009.v2 quando **qualquer** das condições disparar:

- **Primeiro deal Suite Enterprise pedir** explicitamente ("não fecho sem pool consolidado") — feature blocker comercial.
- **≥ 3 clientes Suite Clínica/Solo reportarem** "estou pagando overage de Rooms mas sobra mensagem" (ou vice-versa) — fricção real reportada.
- **MRR Suite ≥ R$ 50k/mês** — volume justifica investimento (≈ 300 tenants Solo ou 70 Clínica).
- **Auditoria de churn** identificar pool como fator citado em > 10% das saídas.

Até qualquer desses triggers, painel do tenant exibe "Pool compartilhado em breve" — promessa é defensável (roadmap público), não é mentira de marketing.

### 4. Mensagem de marketing v1

Permitido (não-enganoso):
- "Suite: Rooms + Schedule com 15% de desconto"
- "Pool compartilhado de minutos e mensagens **(em breve)**"
- "Invoice único" (verdade — `tenant_subscription` única → Stripe 1 invoice)

Proibido:
- "Pool compartilhado" sem o "em breve" — vira problema regulatório (CDC art. 30 — publicidade) se o cliente não conseguir usar como anunciado.
- "Nunca pague overage se sobra do outro produto" — só será verdade quando v2 estiver no ar.

## Consequências

### Positivas

- **Time-to-market do Suite cai 1-2 sprints** — entrega `plan.code='suite-*'` apenas com desconto e invoice consolidado (que Stripe Invoice Items resolve nativamente, ADR-0010 pendente).
- **Schema do ADR-0008 não precisa mudar** — `pool_minutes_remaining`/`pool_messages_remaining` ficam NULL nas linhas Suite v1, populadas em v2 (sem migration).
- **`BillingResolver` (ADR-0007) sem caso especial** — Suite v1 se comporta igual a um cliente que tem Rooms + Schedule separados, exceto por 15% off no preço.
- **Risco de incorreção zero** — pool tem coordenação cross-produto não-trivial (race condition entre `participant_left` Rooms decrementando e `message_sent` Schedule decrementando o mesmo contador); evitar agora.
- **Telemetria de demanda** — o card "em breve" no painel pode ter botão "Quero isso" → tracking direto. Decide quando v2 entra com dado, não opinião.

### Negativas / Trade-offs

- **Marketing perde 1 ponto de diferencial vs Communicare** (que também não tem pool — mas só nós comunicamos como roadmap). Mitigação: pool fica como "anchor feature" para o próximo NPS.
- **Cliente Suite Solo com uso muito assimétrico** (ex: 1500 mensagens / 50 minutos) sente que está pagando o pool de Rooms à toa. Mitigação: oferecer downgrade para standalone com call de CS.
- **Lock-in técnico do Suite cai** — sem pool, sair da Suite é "só cancelar a subscription Suite e criar 2 standalone". Mitigação: lock-in real vem do invoice único + dashboard unificado, não do pool isolado.
- **Implementar a v2 depois exige migration cuidadosa** — precisa preencher `pool_minutes_remaining` retroativamente para subscriptions existentes (= `included_minutes` cheio, reinicia no próximo `current_period_start`).

### Neutras / a observar

- Vencedora **A** documentada acima reduz risco de "decidiremos depois" virar bike-shedding na v2. Ainda é diferível mudar, mas a default é clara.
- ADR-0006 (`UsageRecord`) e ADR-0008 (`tenant_subscription`) não precisam de mudança alguma para esta v1.

## Alternativas consideradas

### Alternativa A — Implementar pool compartilhado no v1

- Prós: cumpre §5 do artefato literalmente; lock-in técnico de saída desde o início.
- Contras: 1-2 sprints sem evidência de demanda; race conditions cross-produto; bloqueia entrega Suite.
- Por que não: viola princípio "não over-engineer — produto precisa ir ao mercado" (CLAUDE.md raiz).

### Alternativa B — Sem Suite no v1 (entregar só Rooms + Schedule standalone)

- Prós: foca esforço em 2 SKUs sólidos.
- Contras: perde narrativa de "plataforma componível" (memória `plexcare-competitor-communicare`); perde o anchor de pricing -15%.
- Por que não: Suite v1 com -15% é trivial dado ADR-0008 (1 plan code novo). Cortá-lo perde upside sem reduzir custo.

### Alternativa C — Pool compartilhado como **opt-in** (cliente Suite escolhe ativar)

- Prós: implementa pool mas só para quem quer.
- Contras: complexidade UI + onboarding; mesma race condition cross-produto se opt-in; pool half-implemented que precisa manter.
- Por que não: pior de dois mundos — custo de v2 com fração da entrega.

### Alternativa D — Pool só para Suite Enterprise no v1

- Prós: limita blast radius; Enterprise é onde o pool importa mais (deal size compensa custo).
- Contras: schema bifurca entre tiers da mesma plan kind; complica BillingResolver.
- Por que não: Enterprise no v1 já é negociado ad-hoc; pool pode ser implementado manualmente como cláusula contratual (oversize de `included_minutes`) sem código.

## Plano de revisão

Reavaliar **imediatamente** quando qualquer trigger da seção "3. Triggers para a v2" disparar.

Revisão proativa em **2026-09-07** (90 dias) mesmo sem trigger — checar:

- Quantos tenants estão em planos Suite?
- Qual % deles tem assimetria > 30% entre uso Rooms e Schedule?
- Algum deal preso por causa da feature?

Se a resposta for "≥ 5 tenants Suite e ≥ 30% deles assimétricos", adiantar a v2 mesmo sem o trigger comercial bater.

## Referências

- [pricing — `tasks/monetize-1-pricing.md`](../../tasks/monetize-1-pricing.md) §5 (Suite) + §11 pergunta 2
- [ADR-0006 Metering Rooms+Schedule](./0006-metering-rooms-schedule.md) — `UsageRecord` que alimentará o consumer de pool na v2
- [ADR-0007 Encaixe online cross-produto](./0007-encaixe-online-cross-produto.md) — `BillingResolver` que ganhará lookup de `suite_pool` na v2
- [ADR-0008 Plan data model](./0008-plan-data-model.md) — `tenant_subscription.pool_minutes_remaining` (NULL em Suite v1, populado em v2)
- Memória: [[plexcare-monetization-scope]] · [[plexcare-competitor-communicare]] · [[plexcare-adr-0008-plan-data-model]]
