# Etapa 1 — Modelo de monetização do PlexCare (escopo reduzido)

> Artefato da pipeline `/monetize-plexcare`. Sessão 1 de 4. Antes de avançar para a Etapa 2 (ADR técnico), valide as decisões marcadas como **D-N** com o stakeholder responsável.
>
> **Escopo reduzido (2026-06-07):** dois produtos vendáveis independentemente — **PlexCare Rooms** (sala virtual) e **PlexCare Schedule** (agenda multichannel presencial/online). Bundle **PlexCare Suite** com pool compartilhado. Laudo Digital, IA Saúde e Distribuição Jurídica ficam **fora desta etapa** — entrarão em pipeline própria depois.
> **Contexto canônico:** [`CLAUDE.md`](../CLAUDE.md), [ADR-0002](../docs/adr/0002-multi-tenancy-via-header-context.md), [ADR-0005](../docs/adr/0005-outbox-worker-poll.md), memória `plexcare-product`, memória `plexcare-teleconf-api`, memória `plexcare-metering-root-cause`.

---

## 1. Resumo executivo (TL;DR)

| Decisão | Escolha | Razão curta |
|---|---|---|
| **D-1** Catálogo | **2 produtos standalone + 1 bundle**: `Rooms`, `Schedule`, `Suite` (Rooms + Schedule com 15% off e pool compartilhado) | Cobre médico-só-sala, clínica-presencial e clínica-completa sem forçar SKU único |
| **D-2** Eixo de cobrança | **Per médico ativo + minutos/mensagens inclusos + overage** (mesma fórmula híbrida em ambos os produtos) | Reaproveita `internal/metering/` (Rooms) e novo metering de WhatsApp/agendamentos (Schedule); previsível pro cliente |
| **D-3** Tiers por produto | **Solo / Clínica / Enterprise** em cada SKU (3 × 2 = 6 tiers + Suite) | Padrão Good/Better/Best; Solo = self-service puro, Enterprise = sales-led |
| **D-4** Trial | 14 dias por produto, independentes; trial Suite = 14d com features dos dois (cap em 100 min de sala + 50 reminders) | Trial casado força compromisso que cliente B2B não dá no dia 1 |
| **D-5** Encaixe online sem plano Rooms (cliente Schedule puro agenda consulta online) | **Pay-per-minute avulso a R$ 0,25/min**, cobrado no invoice do mês, sem assinatura mínima | Friction zero; cliente experimenta Rooms organicamente; conversão Rooms vira métrica de produto |
| **D-6** Bundle Suite | Soma de tiers equivalentes com **15% off** + **pool compartilhado de minutos** (lock-in técnico) | Captura clínica que quer os dois; pool unificado reduz overage e cria switching cost |
| **D-7** Cobertura de custos | Margem bruta-alvo **≥ 75%** blended por produto | SaaS B2B saudável; espaço pra desconto em deal Enterprise |
| **D-8** Unit economics-alvo | Self-service: CAC ≤ R$ 400 (Schedule), R$ 500 (Rooms); LTV/CAC ≥ 5x; payback ≤ 6 meses. Sales-led Enterprise: CAC ≤ R$ 30k, LTV/CAC ≥ 15x | Bench BR-health; valida-se trimestralmente |
| **D-9** Cross-sell automático | Banner no app Schedule "Você consumiu X min em consultas online — assine Rooms e economize" a partir do 3º mês com uso ≥ 200 min | Conversion play guiado por dados de metering |

> **Bloqueio para Etapa 2:** decisões D-1, D-2, D-3, D-5 e D-6 já foram aprovadas pelo stakeholder (`/monetize-plexcare` desta sessão). D-4, D-7, D-8 e D-9 confirmar antes de fechar ADR.

---

## 2. Catálogo de produtos

### Visão de alto nível

```text
                       ┌────────────────────────────────┐
                       │       PlexCare Suite           │
                       │   (Rooms + Schedule -15%)      │
                       │   Pool de minutos compartilhado│
                       └──────────────┬─────────────────┘
                                      │
                ┌─────────────────────┴───────────────────┐
                │                                         │
       ┌────────▼────────┐                       ┌────────▼────────┐
       │ PlexCare Rooms  │  ◄─── pay-per-minute ─┤ PlexCare        │
       │ (sala virtual)  │      avulso quando    │ Schedule        │
       │                 │      Schedule agenda  │ (presencial +   │
       │ Solo/Clínica/   │      consulta online  │  online)        │
       │ Enterprise      │      sem plano Rooms  │ Solo/Clínica/   │
       └─────────────────┘                       │ Enterprise      │
                                                 └─────────────────┘
```

### Mapeamento técnico

| Produto | Backend canônico | Frontend | Metering relevante |
|---|---|---|---|
| **Rooms** | `platform/backend/plexcare-teleconf-service` | `platform/plexcare-teleconf-web` | `internal/metering/` (sessões LiveKit, gravação) |
| **Schedule** | `platform/backend/plexcare-schedule-api` (scaffold hoje) | A criar (não existe) | A criar: agendamentos confirmados, lembretes WhatsApp, no-show evitado |
| **Suite** | Camada de billing agregadora (Etapa 2 define onde) | Painel unificado de uso | Lê metering dos dois + aplica desconto + valida pool compartilhado |

### Por que 2 produtos e não 1 só "Plataforma Clínica"

- **TAM diferente.** Médico solo com agenda própria em GoogleAgenda só compra Rooms. Clínica grande que ainda atende 80% presencial só compra Schedule no começo. Forçar bundle = perde os dois.
- **Jornada diferente.** Clínica costuma começar organizando agenda (dor diária) e depois adiciona tele (dor episódica). Médico solo é o inverso. SKUs separados permitem entry-point natural.
- **Custos variáveis distintos.** Rooms tem custo de mídia (LiveKit/S3); Schedule tem custo de mensagem (WhatsApp Business API). Misturar em tier único distorce margem por perfil de uso.
- **Roadmap independente.** Rooms já tem código produzindo; Schedule é scaffold. Pricing modular permite lançar Rooms agora e Schedule quando estiver pronto, sem refazer tabela.

---

## 3. PlexCare Rooms — tiers e preços

> Eixo: **per médico ativo + minutos inclusos + overage**. Preço **anual** com 17% off vs mensal (incentivo padrão SaaS BR).

| | **Trial** | **Solo** | **Clínica** | **Enterprise** |
|---|---|---|---|---|
| **Público** | Experimentação | Médico solo | Clínica 4–15 profissionais | Hospital, rede, operadora |
| **Preço mensal** | Grátis 14d | R$ 149/médico | R$ 299/médico | A partir de R$ 9.500/mês (custom) |
| **Preço anual (eq. mensal)** | — | **R$ 119/médico/mês** (R$ 1.428/ano) | **R$ 249/médico/mês** (R$ 2.988/ano) | Anual com SLA |
| **Minutos de sala inclusos** | 100 totais | 400/médico/mês | 1.500/médico/mês | Pool 8.000+ min/tenant |
| **Overage** | bloqueia | R$ 0,20/min | R$ 0,15/min | R$ 0,08/min |
| **Salas simultâneas** | 1 | 3/médico | 10/médico | Ilimitado |
| **Gravação** | ❌ | 30d retenção | 90d retenção | Custom (1 ano+) |
| **Webhooks LiveKit** | ❌ | ❌ | ✅ | ✅ |
| **API/SDK** | ❌ | ❌ | Read-only | Full + sandbox |
| **White-label** | ❌ | ❌ | ❌ | ✅ |
| **Suporte** | Self | E-mail 2 dias | E-mail 1 dia + chat | SLA 4h + CSM |
| **SLA** | — | 99,5% | 99,9% | 99,95% com créditos |

### Notas de design

- **R$ 119 vs R$ 149 do draft anterior:** preço cai porque o SKU não carrega mais "agenda básica" embutida — virou produto separado. Conexa entry-level (R$ 99) tem agenda embutida; PlexCare Rooms a R$ 119 é "só sala", mas com gravação CFM e branding. Justifica o gap.
- **400 min em Solo:** consulta média 12–18 min × ~25 atendimentos/mês = 350–450 min. Solo cobre médico típico sem overage; quem estoura é candidato a Clínica.
- **1.500 min em Clínica:** ~85 consultas/mês por médico — equipe que faz volume real. Acima disso, overage progressivo sinaliza Enterprise.
- **Pool 8k em Enterprise:** abandonamos o per-seat em Enterprise para que rede de clínicas com profissionais part-time não pague por médico ocioso.

---

## 4. PlexCare Schedule — tiers e preços

> Eixo: **per médico ativo + lembretes WhatsApp inclusos + features escalonadas**. Sem overage de agendamento (agendamento custa quase R$ 0 marginal); overage existe só em WhatsApp Business API.

| | **Trial** | **Solo** | **Clínica** | **Enterprise** |
|---|---|---|---|---|
| **Público** | Experimentação | Médico solo / consultório | Clínica 4–15 profissionais | Hospital, rede, operadora |
| **Preço mensal** | Grátis 14d | R$ 99/médico | R$ 199/médico | A partir de R$ 5.000/mês (custom) |
| **Preço anual (eq. mensal)** | — | **R$ 79/médico/mês** (R$ 948/ano) | **R$ 159/médico/mês** (R$ 1.908/ano) | Anual com SLA |
| **Agendamentos** | 50 totais | Ilimitados | Ilimitados | Ilimitados |
| **Sync Google Calendar / iOS** | ✅ | ✅ | ✅ | ✅ |
| **Lembretes WhatsApp inclusos** | 50 totais | 300/mês | 1.500/mês | Pool 10.000+/tenant |
| **Overage WhatsApp** | bloqueia | R$ 0,10/msg | R$ 0,08/msg | R$ 0,05/msg |
| **Anti-no-show IA** (predict + remarcar) | ❌ | ❌ | ✅ | ✅ |
| **Encaixe consulta online** (cria sala) | ❌ | ✅ pay-per-minute | ✅ pay-per-minute ou desconta de pool Rooms | ✅ pool Suite |
| **Pay-per-minute encaixe online** (sem plano Rooms) | — | R$ 0,25/min | R$ 0,22/min | R$ 0,15/min |
| **Página pública de agendamento** (link/QR) | ❌ | ✅ | ✅ branded | ✅ white-label |
| **API/Webhooks** | ❌ | ❌ | Read-only | Full |
| **Suporte / SLA** | Self | E-mail 2 dias / 99,5% | E-mail 1 dia + chat / 99,9% | SLA 4h + CSM / 99,95% |

### Notas de design

- **R$ 79 < R$ 119 (Rooms Solo):** Schedule tem custo variável muito menor (DB + WhatsApp), então o preço floor pode ser menor sem comprometer margem (90%+).
- **Anti-no-show IA só em Clínica+:** é o gancho de upgrade Solo → Clínica (Solo experimenta dor de no-show no 1º mês, vira lead quente).
- **Página pública de agendamento incluída em Solo:** é o "habit hook" — médico solo divulga link no Instagram e vira viral local.
- **Encaixe online é a ponte com Rooms:** quando médico clica "consulta online" na Schedule, o sistema cria sala via `POST /api/v1/rooms` do teleconf-service. Se tenant não tem plano Rooms, conta os minutos em pay-per-minute. Se tem, desconta do pool.

---

## 5. PlexCare Suite — bundle

> 15% off no soma de tiers equivalentes (Rooms + Schedule) + **pool compartilhado** de minutos.

| | **Suite Solo** | **Suite Clínica** | **Suite Enterprise** |
|---|---|---|---|
| **Preço bruto (Rooms + Schedule anual)** | R$ 119 + R$ 79 = R$ 198 | R$ 249 + R$ 159 = R$ 408 | Custom |
| **Preço Suite (-15%)** | **R$ 168/médico/mês** | **R$ 347/médico/mês** | Custom (desconto a partir de 18%) |
| **Pool minutos compartilhado** | 400 min/médico | 1.500 min/médico | 8.000+ min/tenant |
| **Pool WhatsApp** | 300 msg/médico | 1.500 msg/médico | 10.000+ msg/tenant |
| **Bilhetagem** | Invoice único | Invoice único | Invoice único com PO/SLA |
| **Suporte** | E-mail 2d | Chat + e-mail 1d | SLA 4h + CSM dedicado |
| **Cross-product features** | — | Painel de uso unificado | + onboarding assistido + sandbox API |

### Por que pool compartilhado (e não só desconto)

- **Lock-in técnico real**: sair da Suite força cliente a renegociar 2 contratos e separar pool — fricção forte.
- **Reduz overage médio**: cliente que oscila entre uso "muito Rooms / pouco Schedule" e vice-versa nunca paga overage de um produto se sobra do outro.
- **Vende como "plataforma"**, não "dois produtos com desconto" — alinha narrativa de marca PlexCare.

### Cross-sell sem Suite

Cliente Schedule puro pode usar encaixe online com **pay-per-minute** sem assinar Rooms (D-5). A partir do 3º mês com uso ≥ 200 min, app dispara banner sugerindo upgrade para Suite — economia mensal calculada com dados reais do tenant.

---

## 6. Cobertura de custos variáveis e margem (D-7)

### Custos unitários estimados (BRL, 2026-06)

| Item | Custo unitário | Fonte / premissa |
|---|---|---|
| LiveKit Cloud — participant minute | ~R$ 0,015/min (US$ 0,003 × 5) | Tabela LiveKit Cloud; 2 participantes → R$ 0,030/min de sala |
| LiveKit Cloud — egress (gravação) | R$ 0,10/min de gravação | Cobrado só quando `recording=true` |
| S3 storage sa-east-1 | R$ 0,13/GB-mês | Standard; sala 30min ≈ 80MB MP4 |
| WhatsApp Business API (Meta) — utility | R$ 0,011/msg | Categoria utility (lembrete agendamento) |
| WhatsApp Business API — marketing | R$ 0,071/msg | Não usamos no plano (só transactional) |
| Stripe Brasil (cartão) | 3,99% + R$ 0,39 | Tabela 2026 |
| Iugu (boleto/PIX) | R$ 2,80 por boleto pago / R$ 0,99 por PIX | Tabela 2026 |
| AWS infra fixa (EKS/RDS/MSK rateio) | ~R$ 5–10/médico/mês | Estimativa MVP; reduz com escala |

### Margem por SKU — cenário típico

| SKU | Preço (anual eq. mensal) | Custo variável típico | Margem bruta | OK ≥ 75%? |
|---|---|---|---|---|
| **Rooms Solo** | R$ 119 | R$ 12 (400 min) + R$ 8 infra = **R$ 20** | **R$ 99 (83%)** | ✅ |
| **Rooms Clínica** | R$ 249 | R$ 45 (1.500 min) + R$ 5 (egress 30% gravação) + R$ 8 = **R$ 58** | **R$ 191 (77%)** | ✅ |
| **Rooms Enterprise** | ~R$ 250 efetivo/médico | R$ 90/médico (pool, gravação alta) | **R$ 160 (64%)** | ⚠️ aceitável dado deal size |
| **Schedule Solo** | R$ 79 | R$ 3 (300 msg) + R$ 5 infra = **R$ 8** | **R$ 71 (90%)** | ✅ |
| **Schedule Clínica** | R$ 159 | R$ 17 (1.500 msg) + R$ 5 infra = **R$ 22** | **R$ 137 (86%)** | ✅ |
| **Schedule Enterprise** | ~R$ 160 efetivo/médico | R$ 30/médico (pool, IA) | **R$ 130 (81%)** | ✅ |
| **Suite Solo** | R$ 168 | R$ 20 + R$ 8 = **R$ 28** | **R$ 140 (83%)** | ✅ |
| **Suite Clínica** | R$ 347 | R$ 58 + R$ 22 = **R$ 80** | **R$ 267 (77%)** | ✅ |

### Overage e pay-per-minute — protegem margem nos outliers

- **Overage Rooms Clínica R$ 0,15/min** sobre custo R$ 0,03/min → margem 80% no excedente.
- **Pay-per-minute encaixe online Schedule R$ 0,25/min** sobre custo R$ 0,03/min → margem 88% (cobre Stripe fee). Cliente Schedule puro com 200 min/mês paga R$ 50 — gera receita sem afetar plano Rooms.
- **Overage WhatsApp R$ 0,10/msg** sobre custo R$ 0,011/msg → margem 89%.

### Pontos de atenção

1. **LiveKit Cloud → self-hosted EKS quando MRR de Rooms ≥ R$ 80k/mês**. Reduz custo de mídia ~70%, sobe margem Rooms Clínica de 77% → 86%. Decisão entra no roadmap SRE.
2. **Schedule depende de WhatsApp Business API.** Meta cobra `R$ 0,011/utility-msg` em BR (atualizado 2026). Se Meta subir 50%, Schedule Solo cai para 86% margem — ainda OK; Schedule Clínica cai para 80% — ainda OK. Modelo aguenta.
3. **Stripe não suporta split de pagamento.** Quando Distribuição Jurídica entrar (fora desta etapa), revisitar — provavelmente Iugu Marketplace.

---

## 7. Fluxo de venda (D-1, D-4, D-9)

### Estágio 1 — Discovery (site público)

Página `/precos` mostra os 3 produtos lado-a-lado com calculator: "Quantos médicos? Quantas consultas/mês? Quantas online?" — recomenda Rooms, Schedule ou Suite com economia calculada.

CTA primário por produto:
- **Rooms** → "Comece o trial de 14 dias"
- **Schedule** → "Comece o trial de 14 dias"
- **Suite** → "Comece o trial de 14 dias" (cobre os dois)
- **Enterprise** → "Falar com vendas" (form com volume)

### Estágio 2 — Trial (14 dias)

| Trial | Inclui | Bloqueia ao expirar |
|---|---|---|
| Rooms | 1 médico, 100 min totais, 1 sala simultânea | sim |
| Schedule | 1 médico, 50 agendamentos, 50 reminders, anti-no-show OFF | sim |
| Suite | 1 médico, 100 min + 50 reminders + anti-no-show ON | sim |

Conversão alvo trial → paid: **35–45%** (benchmark BR-health). Abaixo, ajustar onboarding antes de mexer em preço.

### Estágio 3 — Ativação self-service

- **Pagamento**: cartão (Stripe) ou boleto/PIX (Iugu). Annual paga upfront, mensal vira recorrente.
- **Onboarding**: 3 steps (cadastrar 1ª agenda OU criar 1ª sala; convidar médico secundário; integrar Google/iOS calendar).
- **Time-to-value alvo**: < 15 min do trial expirar até primeiro agendamento confirmado / primeira sala criada com pagamento.

### Estágio 4 — Expansion (mês 2+)

Triggers automáticos no app, todos baseados em metering:

| Trigger | Ação | Destino |
|---|---|---|
| Schedule cliente fez ≥ 200 min encaixe online em 3 meses consecutivos | Banner: "Você gastou R$ X em pay-per-minute. Suite te economiza R$ Y" | Upsell para Suite |
| Rooms Solo estourou 400 min em 2 meses consecutivos | Banner: "Atingiu o limite duas vezes. Clínica te dá 1.500 min + overage menor" | Upgrade Solo → Clínica |
| Schedule Clínica usou anti-no-show e reduziu no-show ≥ 15% | E-mail celebrando + cross-sell Rooms | Cross-sell |
| Tenant tem ≥ 8 médicos ativos em qualquer plano | Trigger lead pra sales-led Enterprise | Sales-led |
| Trial expirando em 3 dias sem ativação | Sequência de re-engajamento (e-mail + WhatsApp) | Conversão |

### Estágio 5 — Sales-led (Enterprise)

Forma de qualificação: ≥ 15 médicos OU hospital OU rede ≥ 3 unidades OU pedido de white-label/HL7. Pipeline:

1. Discovery call (BDR, 30min) — quantifica volume, integrações, compliance específico
2. Demo customizada (AE, 60min) — usa o ambiente do prospect simulado
3. POC pago (R$ 1–3k crédito retornável) — 30 dias com tenant real
4. Contrato (anual, faturamento mensal) — TCO breakdown, SLA, integrações

---

## 8. Unit economics (D-8)

### Premissas

- **GM blended por SKU**: Rooms 78%, Schedule 87%, Suite 80%
- **Churn alvo**: 4%/mês self-service, 1,5%/mês sales-led
- **NRR**: 110%+ (overage + upgrades + add-ons cross-sell)
- **Lifetime esperada**: 25 meses self-service, 67 meses Enterprise

### Por SKU

| Métrica | Rooms Solo | Rooms Clínica | Schedule Solo | Schedule Clínica | Suite Clínica | Enterprise (qualquer) |
|---|---|---|---|---|---|---|
| **ARPU/mês** (preço × seats médios) | R$ 119 × 1,2 = R$ 143 | R$ 249 × 7 = R$ 1.743 | R$ 79 × 1,3 = R$ 103 | R$ 159 × 8 = R$ 1.272 | R$ 347 × 7 = R$ 2.429 | R$ 14.000 |
| **ARPU com overage/add-ons realistas** | R$ 180 | R$ 2.100 | R$ 130 | R$ 1.500 | R$ 3.000 | R$ 20.000 |
| **GM mensal por conta** | R$ 140 | R$ 1.620 | R$ 113 | R$ 1.290 | R$ 2.400 | R$ 16.000 |
| **CAC alvo** | ≤ R$ 500 (paid + content) | ≤ R$ 3.500 (BDR) | ≤ R$ 400 (paid + content) | ≤ R$ 3.000 (BDR) | ≤ R$ 4.500 (BDR + demo) | ≤ R$ 30.000 (field + RFP) |
| **Payback period** | 3,6m ✅ | 2,2m ✅ | 3,5m ✅ | 2,3m ✅ | 1,9m ✅ | 1,9m ✅ |
| **Lifetime esperada** | 25m | 67m | 25m | 67m | 67m | 60m+ |
| **LTV** | R$ 3.500 | R$ 108.000 | R$ 2.800 | R$ 86.000 | R$ 161.000 | R$ 960.000 |
| **LTV/CAC** | **7x** ✅ | **31x** ✅ | **7x** ✅ | **29x** ✅ | **36x** ✅ | **32x** ✅ |

### Como ler

- Payback < 6 meses em todos os tiers → folga para escalar paid acquisition agressivamente.
- LTV/CAC ≥ 5x em todos os SKUs → modelo robusto a aumento de CAC (paid mais caro) ou churn maior.
- **Sensibilidade**: se churn self-service subir para 8%/mês, LTV cai pela metade, mas LTV/CAC fica ≥ 3,5x — modelo continua válido.
- **Suite Clínica é o SKU campeão** — maior ARPU, maior NRR, menor churn por causa do lock-in técnico do pool. Foco do GTM (Etapa 3) deve ser empurrar Schedule clientes para Suite após o 3º mês.

### Hipóteses frágeis a validar nas Etapas 3 e 4

- Seats médios por SKU (1,2 / 1,3 / 7 / 8 — chute baseado em distribuição de clínicas BR; refinar com primeiros 20 clientes)
- Attach rate Suite vs Rooms+Schedule comprados separados (assumi 60% dos clientes "duplos" preferem Suite — testar A/B no checkout)
- Conversão pay-per-minute → Suite (assumi 25% no 3º mês com ≥ 200 min — instrumentar e medir na Etapa 4)

---

## 9. Comparativo competitivo (escopo reduzido)

| Player | Categoria coberta | Preço entry (BR) | Sala virtual? | Agenda multichannel? | Bundle? | Multi-tenant nativo? |
|---|---|---|---|---|---|---|
| **Conexa Saúde** | Sala virtual | R$ 99–249/médico | ✅ | Básica (não multichannel) | Não | Limitado |
| **Doctoralia** | Agenda | R$ 129+/médico | Limitada (sala curta) | ✅ marketplace | Não | N/A |
| **Feegow / iClinic** | Agenda + prontuário | R$ 99–399/médico | ❌ (integra Zoom) | ✅ | Não | Limitado |
| **Communicare** | Suite all-in-one (prontuário SOAP + agenda + tele + financeiro + gestão de cuidados) | Gated (sem preço público); 2 planos — Básico + Care | ✅ sala via link 1-clique + teleinterconsulta (sem app, sem instalação) | ✅ slots presencial/tele, lista de espera, sync Google, lembretes WhatsApp template-fixo | Não — bundle único monolítico | Não — single-tenant |
| **Twilio Video** | Sala API-only | US$ 0,004/min | ✅ (API only) | ❌ | Não | API only |
| **Zoom for Healthcare** | Sala genérica | US$ 200+/licença/mês | ✅ | ❌ | Não | ❌ |
| **PlexCare Rooms** | Sala virtual branded CFM | **R$ 119/médico/mês** | ✅ | — | Cross-sell c/ Schedule | ✅ |
| **PlexCare Schedule** | Agenda multichannel + IA no-show | **R$ 79/médico/mês** | — | ✅ + Google/iOS/WhatsApp | Cross-sell c/ Rooms | ✅ |
| **PlexCare Suite** | Plataforma clínica completa | **R$ 168/médico/mês** (Solo) | ✅ | ✅ | Pool compartilhado | ✅ |

### Diferenciais por SKU

**Rooms** vs Conexa:
- Mesma faixa de preço, mas **API + webhooks** em Clínica (Conexa não publica)
- Multi-tenant nativo (rede de clínicas com pool unificado)
- Sem amarração com agenda interna — vende para quem já tem agenda em outro sistema

**Schedule** vs Doctoralia/iClinic:
- WhatsApp Business API **incluído** em todos os tiers (concorrentes cobram à parte ou usam workaround não-oficial)
- Anti-no-show IA real (não regra simples de "manda lembrete 24h antes")
- Encaixe online com Rooms próprio em vez de redirect para Zoom

**Suite** vs Feegow:
- Feegow é prontuário-first, agenda é submódulo; PlexCare é agenda-first com sala embutida — alinhamento com clínica que tem prontuário separado (PEP/iClinic) e só quer agenda + sala
- Pricing mais simples (Feegow cobra módulos a la carte com pricing opaco)

**Rooms / Schedule / Suite vs Communicare** (concorrente direto identificado em 2026-06-07):
- Communicare é **suite monolítica fechada** (prontuário SOAP + agenda + tele + financeiro + cuidados no mesmo bundle). Não vende sala nem agenda standalone — perde médico que já tem prontuário em outro PEP (iClinic, Memed, hospital).
- **Posicionamento "plataforma componível"** é o ataque defensável: PlexCare vende Rooms standalone para quem já tem prontuário e Schedule standalone para quem já tem sala; Suite só para greenfield. Communicare não pode copiar sem reescrever arquitetura.
- **Vetores técnicos onde PlexCare é estruturalmente superior**: (1) **SFU dedicado** (LiveKit) vs WebRTC genérico — qualidade para procedimento médico e multi-participante; (2) **multi-tenant nativo** (ADR-0002) vs single-tenant — abre TAM de redes/franquias (Dr. Consulta, OdontoCompany, Amor Saúde); (3) **API/Webhooks** publicizados vs caixa-preta; (4) **gravação CFM-compliant com KMS** vs ausente/não-publicizado; (5) **anti-no-show IA real** vs lembrete template-fixo; (6) **pricing transparente self-service** vs gated demo (Communicare força contato comercial).
- **Lacunas estruturais da PlexCare vs Communicare** que precisam ser endereçadas no roadmap (não bloqueiam MVP, mas limitam TAM greenfield): prontuário SOAP mínimo viável, emissão NF-Serviço, módulo de gestão de cuidados (population health). Decisão proposta: **não construir no MVP** — entrar em parceria de integração com PEPs (iClinic, Memed) e revisitar prontuário próprio quando MRR Suite ≥ R$ 200k.

### Riscos competitivos

- **Conexa pode lançar agenda nativa** em 12 meses → janela de Suite é limitada. Mitigar com Schedule MVP em produção até Q4 2026.
- **Doctoralia pode integrar sala virtual séria** (não a limitada atual) → ameaça Schedule. Mitigar com cross-sell agressivo Rooms→Schedule + pool Suite.
- **iClinic é incumbente forte em clínica média (R$ 199–399/médico)** → Suite Clínica precisa precificar abaixo do iClinic equivalente ou justificar com IA no-show + sala.
- **Communicare é incumbente em atenção primária via parceria SBMFC** + autoridade clínica reconhecida → cliente greenfield ouve "Communicare" antes de "PlexCare". Mitigar com posicionamento "plataforma componível", parcerias com outras sociedades (SBC, SBP, SBR), e atacar pela borda (clínica que já tem prontuário e só precisa de sala/agenda — segmento que Communicare não atende).

---

## 10. Riscos do modelo e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Metering bug ainda não-fixo (`participant_sessions` vazia — memória `plexcare-metering-root-cause`) faz invoice subestimar uso de Rooms | **Alta** | Alto (perda direta de receita) | **Bloqueia release de billing.** Fix do metering é P0 antes de qualquer Stripe wiring. Entrada obrigatória da Etapa 2. |
| Schedule ainda é scaffold (sem `go.mod`) → time-to-market longo | **Alta** | Alto (Suite não existe sem Schedule) | Priorizar MVP Schedule pós-billing Rooms. Lançar Rooms standalone primeiro com cross-sell "Schedule em breve". |
| Pool compartilhado Suite exige multi-tenancy nested (sub-tenants) ou shared metering — não trivial | Média | Médio (atrasa Suite) | Etapa 2 decide: a) sub-tenants raiz, b) pool agregado fora do `tenant_id` (billing-side), c) MVP sem pool (só desconto 15%). |
| `devtenant.Resolver` é fake (memória `plexcare-devtenant-security`) — qualquer um pode emitir `X-Tenant-Id` arbitrário | **Crítica** | **Bloqueia prod** | Issue #3 (ADR-0002) fechada antes do primeiro invoice. Não negociar. |
| Stripe não suporta billing composto fácil (assinatura + metered + pool) | Média | Médio (complexidade de invoice) | Etapa 2 decide: Stripe metered billing nativo + invoice items vs aggregator próprio (Lago/OpenMeter) com Stripe como gateway de pagamento. |
| WhatsApp Business API tem limite de quality rating; conta pode cair pra "low" e bloquear envio em massa | Média | Alto pra Schedule | Estratégia de templates aprovados + opt-in claro + monitoramento de quality rating em produção. Falha grave bloqueia Schedule. |
| Cliente Schedule puro gera muito pay-per-minute e nunca converte pra Suite (modelo otimista) | Média | Médio (não captura switching cost) | Trigger automático de upsell mais agressivo (1º mês com ≥ 100 min, não 3º com ≥ 200). Testar na Etapa 4. |
| **Communicare como incumbente em atenção primária** (parceria SBMFC, prontuário SOAP + agenda + tele + financeiro no mesmo bundle, 5+ anos de mercado) atrai cliente greenfield por default — "comprar 1 sistema só" vs "compor a plataforma" | **Alta** | Alto (perda de TAM greenfield em medicina de família) | (1) Posicionamento **"plataforma componível"** — atacar pela borda (médico que já tem prontuário em PEP e só quer sala/agenda); (2) parcerias com sociedades médicas além da SBMFC (SBC cardio, SBP pediatria, SBR radio); (3) roadmap de prontuário SOAP MVP gatilhado por MRR Suite ≥ R$ 200k (não no MVP); (4) integração formal com iClinic/Memed/PEPs antes do GA |
| LiveKit Cloud aumenta preço (+30% em 2025) — pode repetir | Média | Médio (-5 a -8 p.p. margem Rooms) | Roadmap self-hosted EKS gatilhado por MRR Rooms ≥ R$ 80k. |
| CFM 2.314 muda regra de identificação do paciente | Baixa | Alto (refazer onboarding) | Monitorar publicações CFM. Sem mitigação técnica antecipada. |
| Setor público (SUS) não aceita per-seat ou pool — só per-uso real | Alta | Alto pra esse segmento | Tier "Setor Público" overage-only com mínimo mensal R$ 5.000. Decisão de Etapa 3, não bloqueia MVP. |

---

## 11. O que precisa estar pronto para a Etapa 2 (ADR técnico)

A Etapa 2 (`/solutions-architect`) precisa responder, **dado este modelo**:

1. **Metering** — `internal/metering/` consegue produzir `MonthlyUsage{TenantID, Period, TotalMinutes, TotalRooms}` confiável **após fix do root cause** (memória `plexcare-metering-root-cause`)? Schedule precisa de metering equivalente (`MonthlyScheduleUsage{TenantID, Confirmed, WhatsAppSent, NoShowsPrevented}`) — onde mora?
2. **Pool compartilhado Suite** — três alternativas (sub-tenants, agregador billing-side, MVP sem pool). Trade-off de cada.
3. **Encaixe online cross-produto** — quando Schedule chama `POST /rooms`, como o teleconf-service sabe se o tenant é Schedule-puro (cobrar pay-per-minute) ou Suite (descontar do pool) ou Rooms-only (rejeitar se sem plano)?
4. **Gateway de billing** — Stripe metered nativo OU agregador (Lago/OpenMeter) + Stripe gateway. Critério: complexidade × controle × custo recorrente do aggregator.
5. **Enforcement de limites** — gate em `application/create_room.go` checando minutos restantes do mês: sync (Redis cache de quota) ou eventual (tolerance window)? Mesma pergunta para WhatsApp Schedule.
6. **Plan data model** — `tenant.plan` é hardcoded no `devtenant`. Precisamos: `products` table (Rooms, Schedule, Suite), `plans` table (Solo, Clínica, Enterprise por produto), `tenant_subscriptions` (1 tenant pode ter Rooms + Schedule separados ou Suite consolidado), `tenant_addons` (futuro).
7. **Outbox** ([ADR-0005](../docs/adr/0005-outbox-worker-poll.md)) — já cobre eventos `subscription.created`, `usage.recorded`, `invoice.generated`, `payment.failed`? Trade-off de billing source-of-truth: outbox próprio vs Stripe webhooks.
8. **Pay-per-minute técnico** — quando Schedule sem Rooms agenda online, qual o limite de blast radius se Stripe cobrança falhar (cliente já consumiu 200 min)? Pré-autorização? Cap diário?
9. **Bilhetagem unificada Suite** — invoice consolidado vem do nosso backend ou montamos no Stripe via Invoice Items + Subscription Items?

---

## 12. Checkpoint

**Decisões aprovadas nesta sessão (não revisar):**

- ✅ **D-1** 2 produtos standalone + Suite com pool compartilhado
- ✅ **D-3** 3 tiers por produto (Solo/Clínica/Enterprise)
- ✅ **D-5** Pay-per-minute avulso R$ 0,25/min para encaixe online sem Rooms

**Decisões que precisam de OK do usuário antes da Etapa 2:**

- [ ] **D-2** Eixo per-médico + minutos/mensagens inclusos + overage em ambos os produtos
- [ ] **D-4** Trial 14 dias por produto + trial Suite com features dos dois
- [ ] **D-6** Bundle Suite com 15% off + pool compartilhado
- [ ] **D-7** Margem-alvo ≥ 75% blended por produto
- [ ] **D-8** Unit economics-alvo (tabela seção 8)
- [ ] **D-9** Triggers de cross-sell e expansion (tabela seção 7)

**Decisões adiadas (entram na Etapa 3 — GTM, ou pipeline própria):**

- Segmento "Setor Público / SUS" — Tier separado overage-only
- Segmento "Operadora de plano de saúde" — per-vidas
- Pricing realista USD/EUR para expansão internacional
- Reentrada de Laudo Digital, IA Saúde e Distribuição Jurídica no portfólio comercial (out-of-scope desta sessão)

---

## Anexos

### Referências

- Stack canônica e compliance: [`CLAUDE.md`](../CLAUDE.md)
- Multi-tenancy: [ADR-0002](../docs/adr/0002-multi-tenancy-via-header-context.md)
- Outbox/Kafka: [ADR-0005](../docs/adr/0005-outbox-worker-poll.md)
- IdP / SSO: [ADR-0004](../docs/adr/0004-idp-proprio-keycloak-oculto.md)
- Metering Rooms: `internal/metering/domain/aggregate.go` (`MonthlyUsage`, `ParticipantSession.BillableMinutes()`)
- Memórias: `plexcare-product`, `plexcare-teleconf-api`, `plexcare-metering-root-cause`, `plexcare-devtenant-security`, `plexcare-monorepo-structure`

### Origem dos números

- LiveKit Cloud: tabela pública 2026
- S3 sa-east-1: AWS console pricing
- Stripe BR: https://stripe.com/br/pricing
- Iugu: tabela pública 2026
- WhatsApp Business API: tabela Meta BR 2026 (utility R$ 0,011/msg)
- Conexa, Doctoralia, iClinic, Feegow: pesquisa de preços públicos. **Validar com SDR sourcing antes da Etapa 3.**

### Próxima sessão

```
/clear
/solutions-architect — input: tasks/monetize-1-pricing.md → output: docs/adr/0006-modelo-de-pricing.md
```

Foco da Etapa 2: responder as 9 perguntas da seção 11, com prioridade absoluta em (1) fix do metering, (3) encaixe online cross-produto, (6) data model de plans, (2) pool compartilhado Suite.
