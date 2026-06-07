# Etapa 4 — Instrumentação e tracking de monetização PlexCare

> Artefato da pipeline `/monetize-plexcare`. Sessão 4 de 4. Encerra a pipeline de monetização. Antes de iniciar implementação, valide as decisões marcadas como **I-N** com o stakeholder responsável.
>
> **Escopo:** plano de instrumentação que mede os 4 funis críticos do negócio (Aquisição → Ativação → Conversão → Expansão/Retenção) e amarra cada KPI/SLI do GTM ([`monetize-3-gtm.md`](monetize-3-gtm.md) §9) a eventos rastreáveis. Cobre site institucional, produto (Rooms + Schedule + Suite), billing (Stripe + Iugu) e operação.
> **Contexto canônico:** [`monetize-1-pricing.md`](monetize-1-pricing.md), [`monetize-3-gtm.md`](monetize-3-gtm.md), ADRs [0006](../docs/adr/0006-metering-rooms-schedule.md), [0007](../docs/adr/0007-encaixe-online-cross-produto.md), [0008](../docs/adr/0008-plan-data-model.md), [0009](../docs/adr/0009-pool-compartilhado-suite.md), [0010](../docs/adr/0010-billing-gateway-stripe-iugu.md). Memórias: `plexcare-monetization-scope`, `plexcare-monetization-gtm`, `plexcare-adr-0008-plan-data-model`, `plexcare-devtenant-security`.

---

## 1. Resumo executivo (TL;DR)

| Decisão | Escolha | Razão curta |
|---|---|---|
| **I-1** Stack analítico | **PostHog Cloud (EU) como produto + GA4 via GTM no site + warehouse Postgres (read-model) como source-of-truth de uso/receita** | PostHog em EU mantém PII de paciente fora dos EUA (LGPD/CFM); GA4 cobre aquisição paga; warehouse fecha books com idp-api MySQL + teleconf Postgres |
| **I-2** Source-of-truth de receita | **Stripe + Iugu webhooks → outbox `billing.events` no idp-api → projeção para warehouse**. PostHog recebe `subscription_*` e `invoice_*` derivados (não dados de cartão) | ADR-0010 fixou gateways paralelos; receita real é o invoice, não o evento de UI |
| **I-3** Identidade e contexto | Todo evento carrega `user_id`, `tenant_id`, `product_sku`, `plan_id`, `billing_country=BR`. Identificação anônima → autenticada via `posthog.identify()` no signup; alias com `device_id` pré-login | Sem `tenant_id` em log é violação direta de [ADR-0002](../docs/adr/0002-multi-tenancy-via-header-context.md); fora dele não dá pra atribuir MRR |
| **I-4** Naming convention | `<objeto>_<ação>` em snake_case, lowercase. Propriedades em snake_case. Sem variantes por produto no nome do evento (use `product_sku` como propriedade) | Permite funil único cross-produto e queries simples no warehouse |
| **I-5** Funis críticos | 4 funis vivos como dashboard semanal: Aquisição, Ativação, Conversão, Expansão/Retenção. 1 dashboard executivo agregado | Casa 1:1 com KPI tree do GTM §9 — métricas viram operação, não slides |
| **I-6** Privacidade | Consent banner LGPD-compliant (opt-in granular: essencial / analytics / marketing). PostHog `session_replay` desligado por default em tenants healthcare; ativado por tenant após assinatura de DPA | CFM 2.314 + LGPD + risco de captura de dado clínico em replay |
| **I-7** PII de paciente | **Proibido em qualquer evento.** Identificadores de paciente são hash SHA-256 com salt por tenant. Nome, CPF, e-mail, telefone, conteúdo de chamada e gravação **nunca** entram em PostHog/GA4. Owner: SRE valida via regex DLP no proxy de eventos | Risco regulatório direto + bloqueio comercial em hospital/operadora |
| **I-8** Conversão pré/pós-consent | GA4 Consent Mode v2; PostHog `opt_out_capturing_by_default=true` até consent. Trial signup é evento pós-consent obrigatório | Sem consent, GA4 modela conversão; PostHog não captura nada |
| **I-9** Roadmap de implementação | 4 fases atreladas ao GTM: M0 site/trial, M1 produto, M3 billing, M6 retenção/cross-sell. Cada fase tem SLO de "eventos válidos ≥ 95% do esperado" | Casa com sequência Rooms → Schedule → Suite do GTM §6 |
| **I-10** Owners | Aquisição/site: `fullstack-engineer`. Produto: `software-engineer`. Billing: `software-engineer`. Warehouse + dashboards: `sre-infra-engineer`. Validação LGPD/DPO: `solutions-architect` | Cada owner responde por SLO de qualidade de evento da sua superfície |

> **Status:** todas as 10 decisões (I-1 a I-10) aprovadas pelo stakeholder em 2026-06-07. Handoff para Software Engineer / Fullstack / SRE / Solutions Architect liberado — abrir issues conforme §10.

---

## 2. Premissas e dependências herdadas

### Do Pricing (Etapa 1)

- 3 SKUs vendáveis: **Rooms**, **Schedule**, **Suite**. Tiers **Solo / Clínica / Enterprise** em cada.
- Eixo de cobrança: **per médico ativo + minutos/mensagens inclusos + overage**.
- **Pay-per-minute encaixe online** (R$ 0,25/min) para tenant Schedule-puro — evento crítico de cross-sell.
- Trial 14 dias por SKU, independentes.
- **Founders Program** 50% off anual para primeiros 50 tenants por SKU (3 batches).

### Do GTM (Etapa 3)

- Sequência: **Rooms (M3 GA, Out/26) → Schedule (M6 GA, Jan/27) → Suite (M9 GA, Abr/27)**.
- Metas: M5 MRR R$ 38k, M8 R$ 110k, M11 R$ 220k, M16 R$ 850k.
- NRR alvo: ≥ 100% (M8), ≥ 105% (M11), ≥ 115% (M16).
- CAC payback ≤ 5m (M5) descendo para ≤ 4m (M16).
- Channel mix: PLG dominante M3+, Sales-led ramping M5+, ABM Enterprise M10+.
- ICPs: Dra. Mariana (Rooms Solo), Clínica Vitae (Schedule/Suite Clínica), Rede Bem-Estar (Suite Enterprise).

### Dos ADRs técnicos

| ADR | O que define | Relevância pro tracking |
|---|---|---|
| [0006](../docs/adr/0006-metering-rooms-schedule.md) | Metering Rooms+Schedule, `billable_minutes` por ceiling, `room_id=UUID` | Source-of-truth de uso. Eventos `room_*`, `metering_*` derivam daqui |
| [0007](../docs/adr/0007-encaixe-online-cross-produto.md) | Encaixe Schedule→Rooms via pay-per-minute | Eventos `appointment_online_*`, `cross_sell_trigger_*` |
| [0008](../docs/adr/0008-plan-data-model.md) | Catálogo no idp-api MySQL (`product/plan/tenant_subscription`); read-model Postgres no teleconf | Fonte canônica de `plan_id`, `product_sku`, `subscription_status`. Toda projeção pro warehouse parte do read-model |
| [0009](../docs/adr/0009-pool-compartilhado-suite.md) | Pool Suite deferido para V2 (M12) | Eventos `pool_*` entram só na Fase 4 (M6+) do roadmap de tracking; M12 ativa balanço de pool |
| [0010](../docs/adr/0010-billing-gateway-stripe-iugu.md) | Stripe Metered (cartão) + Iugu (PIX/boleto) em paralelo | Webhooks de ambos → outbox `billing.events` único. Eventos `payment_*` agnósticos de gateway |

### Bloqueios técnicos que travam tracking

| Bloqueio | Origem | Impacto se não resolvido |
|---|---|---|
| Fix `participant_sessions` vazia | Memória `plexcare-metering-root-cause`; ADR-0006 | `room_minutes_billed` e qualquer revenue de Rooms ficam zerados/errados. **P0.** |
| `devtenant.Resolver` substituído por IdP real | Memória `plexcare-devtenant-security`; Issue #3 | `tenant_id` não é confiável; toda atribuição de MRR é fraudável. **P0.** |
| Plan data model (read-model Postgres) live | ADR-0008 | Sem isso, `product_sku` e `plan_id` em eventos viram chute. **P1.** |
| Stripe + Iugu webhooks integrados ao outbox | ADR-0010 | Sem isso, conversão paga = self-reported pela UI (não confiável). **P1.** |

---

## 3. Stack analítico e arquitetura de dados

### Camadas

```text
┌──────────────────────────────────────────────────────────────────────┐
│                      Camada de coleta                                │
│                                                                      │
│  site/ (Vite/React)         teleconf-web (LiveKit client)            │
│  ├─ GTM container web       ├─ posthog-js (auto identify pós-login)  │
│  ├─ GA4 via Consent Mode    └─ Sentry (erros, opcional)              │
│  └─ posthog-js (anon→id)                                             │
│                                                                      │
│  teleconf-service (Go)      schedule-api (Go)    idp-api (NestJS)    │
│  ├─ posthog-go server-side  ├─ posthog-go        ├─ posthog-node     │
│  ├─ Kafka outbox            ├─ Kafka outbox      └─ Stripe/Iugu wh   │
│  └─ metering events         └─ schedule events                       │
└──────────────────────────────────────────────────────────────────────┘
            │                          │                       │
            ▼                          ▼                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Camada de roteamento / outbox                      │
│                                                                      │
│  Kafka topics:                                                       │
│   - billing.events  (subscription, invoice, payment) — source-of-truth│
│   - product.events  (room, appointment, signup, activation)          │
│   - usage.events    (metering ticks 1-min derivados de ADR-0006)     │
│                                                                      │
│  PostHog Capture API ← consumidor que serializa product+usage        │
│  Warehouse ETL       ← consumidor que serializa tudo (canônico)      │
└──────────────────────────────────────────────────────────────────────┘
            │                          │                       │
            ▼                          ▼                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│            Camada analítica (4 destinos, cada um seu papel)          │
│                                                                      │
│  PostHog Cloud EU                                                    │
│   - Product analytics, funnels, retention, session replay (gated)    │
│   - Feature flags (Founders Program, beta features)                  │
│                                                                      │
│  GA4 (via GTM) + Google Search Console                               │
│   - Aquisição paga (Google Ads, LinkedIn), SEO, atribuição           │
│   - Consent Mode v2 + IP anonymization                               │
│                                                                      │
│  Warehouse Postgres analítico (schema `analytics`)                   │
│   - MRR/ARR/NRR/Churn — source-of-truth contábil                     │
│   - Espelha read-model Postgres do teleconf + projeção de billing    │
│                                                                      │
│  Metabase (open-source) — dashboards executivo e por funil           │
└──────────────────────────────────────────────────────────────────────┘
```

### Por que essa stack e não outra

| Decisão | Alternativa avaliada | Por que escolhemos |
|---|---|---|
| **PostHog Cloud EU** | Mixpanel, Amplitude, GA4-only | PostHog: (a) hosted EU = LGPD-friendly; (b) feature flags integradas (Founders Program rollout); (c) session replay opt-in; (d) self-host fallback se preço escalar. Mixpanel/Amplitude têm pricing por evento que escala mal com metering tick. GA4-only não cobre produto |
| **GA4 + GTM no site** | PostHog autocapture no site | GA4 é gratuito, integra com Google Ads (paid search é canal #1 do GTM §10), e tem Search Console. PostHog no site duplica eventos sem ganho |
| **Warehouse Postgres** | Snowflake, BigQuery | Postgres analítico (read replica do teleconf + projeção idp-api) cabe no orçamento M0–M9. Migração para BQ quando MRR ≥ R$ 200k e volume justificar |
| **Outbox como hub** | Direct SDK calls do app | Outbox já existe ([ADR-0005](../docs/adr/0005-outbox-worker-poll.md)); duplica eventos em PostHog + warehouse com mesma garantia; permite re-processar se PostHog cair |
| **Metabase** | Looker Studio, Hex | Open-source, cabe no orçamento Phase II, conecta direto no Postgres analítico. Migração futura quando time de dados crescer |

### Fluxo de um evento crítico — exemplo `subscription_started`

```text
1. UI checkout (teleconf-web) → POST /api/v1/subscriptions (idp-api)
2. idp-api cria subscription em MySQL + insere outbox `billing.events`:
     event_type=subscription.started
     tenant_id, user_id, plan_id, product_sku, billing_cycle, gateway
3. Worker poll lê outbox → publica em Kafka topic `billing.events`
4. Consumer A → PostHog Capture API → evento `subscription_started`
5. Consumer B → Warehouse ETL → tabela `analytics.subscription_events`
6. Stripe/Iugu webhook chega assíncrono → atualiza `subscription_status`
   e dispara `subscription_activated` quando 1º pagamento liquidar
```

> **Implicação:** PostHog NÃO é source-of-truth. Se PostHog cair por 4h, warehouse não perde nada. Se warehouse cair, billing continua funcionando (outbox retém). Resiliência por design.

---

## 4. Modelo de identidade e propriedades padrão

### Identidade

| Estágio | Identificador | Como propaga |
|---|---|---|
| Anônimo (site, pré-trial) | `distinct_id = device_id` (UUID cookie 1ª parte) | PostHog auto; GA4 client_id |
| Trial signup (pós-form) | `posthog.identify(user_id, {tenant_id, plan_id=trial, ...})` + `posthog.alias(device_id, user_id)` | Liga jornada pré→pós signup. GA4: `user_id` parameter |
| Login pós-trial | `posthog.identify(user_id)` revalidado | Idem |
| Server-side (Go/NestJS) | Toda chamada SDK passa `distinct_id=user_id` extraído do JWT | Falha se não tiver user_id → erro logado, evento dropado (não silencia) |
| Eventos sem user (webhook, scheduled job) | `distinct_id=tenant:{tenant_id}` (prefixado) | Permite atribuir a tenant; user_id fica `null` |

### Propriedades globais (toda chamada `capture` carrega)

| Propriedade | Tipo | Fonte | Notas |
|---|---|---|---|
| `tenant_id` | UUID | JWT / contexto | **Obrigatório.** Sem ele, evento é rejeitado por proxy DLP (ver §8) |
| `user_id` | UUID | JWT | Null em eventos sem usuário (cron jobs) |
| `product_sku` | enum: `rooms`, `schedule`, `suite` | Plan data model (ADR-0008) | Null no site institucional pré-trial |
| `plan_id` | UUID | Plan data model | Null no site; preenchido a partir do trial |
| `plan_tier` | enum: `trial`, `solo`, `clinica`, `enterprise` | Plan data model | Derivado de `plan_id` |
| `subscription_status` | enum: `trialing`, `active`, `past_due`, `cancelled`, `churned` | Plan data model | Derivado |
| `billing_cycle` | enum: `monthly`, `annual` | Plan data model | Null pré-conversão |
| `founders_program` | bool | idp-api flag | True para primeiros 50 tenants do batch ativo |
| `tenant_signup_at` | ISO 8601 | idp-api | Permite calcular dias-desde-signup em queries |
| `tenant_cohort` | string `YYYY-MM` | derivado | Cohort mensal para retention |
| `app_version` | semver | build env | Web e mobile (futuro) |
| `environment` | enum: `prod`, `staging`, `dev` | env var | Eventos `dev/staging` taggeados para excluir de dashboards |

### Identidade no GA4 (separação UI / produto)

GA4 vê só o que acontece **antes** do checkout. Após signup, GA4 recebe `user_id` para deduplicação cross-device e o evento `signup_completed`; daí em diante, GA4 é silenciado em superfícies internas do produto (autenticadas) — produto roda só em PostHog. Razão: PII de paciente nunca pode entrar em GA4, e segregar reduz risco de captura acidental.

---

## 5. Tracking plan por funil

### 5.1 Funil de Aquisição — site institucional e landings

> Owner: `fullstack-engineer`. Destino primário: GA4 (paid attribution) + PostHog (engagement). Roda em M0–M2 (atrelado a setup de site/landing — ver GTM §6 Fase I).

| Evento | Trigger | Propriedades-chave | Owner | Destino |
|---|---|---|---|---|
| `page_view` | Auto GA4 enhanced measurement; PostHog autocapture | `page_path`, `page_title`, `referrer`, `utm_*` | Auto | GA4 + PostHog |
| `landing_specialty_viewed` | Visitar `/psiquiatria`, `/endocrino`, `/nutricao`, etc. | `specialty`, `page_path` | Fullstack | PostHog |
| `pricing_page_viewed` | Visitar `/precos` | `referrer`, `utm_*` | Fullstack | GA4 (conversion soft) + PostHog |
| `pricing_calculator_used` | Submit do form do calculator de `/precos` | `medicos`, `consultas_mes`, `pct_online`, `whatsapp_estimado`, `sku_recomendado`, `preco_calculado_brl` | Fullstack | PostHog (KPI alto, sem PII) |
| `pricing_calculator_recommendation_clicked` | Clique no CTA do SKU recomendado | `sku_recomendado`, `cta_destination` | Fullstack | PostHog + GA4 |
| `comparison_viewed` | Visitar `/vs/conexa`, `/vs/doctoralia`, `/vs/iclinic`, `/vs/communicare` | `competitor` | Fullstack | PostHog |
| `blog_article_read` | Scroll ≥ 70% + ≥ 30s em artigo | `article_slug`, `pillar_topic`, `read_seconds` | Fullstack | PostHog |
| `cta_clicked` | Qualquer CTA primário | `cta_text`, `cta_location` (hero/footer/inline), `cta_destination`, `sku` | Fullstack | GA4 + PostHog |
| `lead_form_submitted` | Form "Falar com vendas" (Enterprise) | `form_location`, `medicos_estimado`, `especialidade`, `mensagem_length` | Fullstack | PostHog + HubSpot/RD (via webhook) |
| `trial_signup_started` | Abriu `/signup` ou modal trial | `sku_intent`, `source` | Fullstack | PostHog |
| `trial_signup_completed` | Conta criada com sucesso (e-mail verificado) | `sku`, `signup_method` (email/google), `utm_*`, `referrer_at_signup`, `lead_source` | Fullstack | GA4 (conversion) + PostHog (alias) |
| `demo_requested` | Form "Solicitar demo" enviado | `medicos_estimado`, `cargo` (médico/admin/diretor), `especialidade` | Fullstack | PostHog + HubSpot |

#### UTM padrão (G-2/G-8 do GTM)

Toda paid + content + parcerias usa este esquema. Documentar em `docs/marketing/utm-taxonomy.md` (a criar pelo growth/founder).

| Param | Valores aceitos | Exemplo |
|---|---|---|
| `utm_source` | `google`, `linkedin`, `meta`, `youtube`, `newsletter`, `abp`, `sbp`, `sbem`, `sbc`, `sbd`, `eretz`, `inovahc`, `referral` | `utm_source=google` |
| `utm_medium` | `cpc`, `cpm`, `email`, `social`, `organic`, `partner`, `event` | `utm_medium=cpc` |
| `utm_campaign` | `rooms_ga_m3`, `schedule_ga_m6`, `suite_ga_m9`, `founders_rooms`, `founders_schedule`, `founders_suite`, `congresso_abp_m3` | `utm_campaign=rooms_ga_m3` |
| `utm_content` | `hero_cta`, `pricing_card_solo`, `blog_inline`, `psiquiatria_landing` | `utm_content=pricing_card_solo` |
| `utm_term` | só paid search: keyword exata em snake_case | `utm_term=sala_virtual_cfm` |

> Convenção: sempre lowercase, snake_case. Auditoria semanal no dashboard "UTM Sanity": % de tráfego pago sem UTM completo (alvo ≤ 5%).

---

### 5.2 Funil de Ativação — produto (Rooms + Schedule + Suite)

> Owner: `software-engineer` (backend events via outbox) + `fullstack-engineer` (frontend events em teleconf-web). Roda em M1+ (Rooms) e M5+ (Schedule).

**Definição de "ativado":**
- **Rooms**: 1ª sala criada com sucesso (`room_created`) **e** ≥ 1 minuto faturável conectado (`room_minute_billed`) no mesmo trial.
- **Schedule**: 1º agendamento confirmado (`appointment_confirmed`) **e** 1º lembrete WhatsApp enviado (`whatsapp_reminder_sent`) no mesmo trial.
- **Suite**: ativação de ambos os SKUs no trial.

| Evento | Trigger | Propriedades-chave | Owner | Destino |
|---|---|---|---|---|
| `onboarding_started` | Login pós-signup, abre wizard | `sku`, `step_count` | Fullstack | PostHog |
| `onboarding_step_completed` | Conclui step do wizard | `step_number`, `step_name`, `step_seconds` | Fullstack | PostHog |
| `onboarding_completed` | Wizard inteiro concluído | `total_seconds`, `steps_skipped` | Fullstack | PostHog |
| `user_invited` | Tenant convida outro médico/secretária | `role`, `invited_count_total` | Backend (idp-api) | PostHog |
| `user_first_login` | Primeira sessão autenticada do tenant | `seconds_from_signup` | Backend | PostHog |
| `room_created` | POST `/api/v1/rooms` retorna 201 | `room_id`, `recording_requested`, `created_via` (`ui`, `api`, `schedule_encaixe`) | Backend (teleconf-service) | PostHog + Warehouse |
| `room_joined` | Webhook LiveKit `participant_joined` | `room_id`, `participant_role` (`doctor`, `patient`, `observer`), `participant_hash` (SHA-256+salt) | Backend | PostHog + Warehouse |
| `room_minute_billed` | Tick de metering de 1 min ([ADR-0006](../docs/adr/0006-metering-rooms-schedule.md)) | `room_id`, `billable_minutes_running_total`, `participant_count`, `recording=bool` | Backend | Warehouse (não PostHog — volume) |
| `room_ended` | Webhook LiveKit `room_finished` | `room_id`, `duration_seconds`, `billable_minutes`, `participants_count_peak`, `recording_seconds` | Backend | PostHog + Warehouse |
| `recording_completed` | Egress S3 finalizado + checksum | `room_id`, `recording_bytes`, `retention_days` | Backend | Warehouse |
| `appointment_created` | Schedule API cria agendamento | `appointment_id`, `channel` (`presencial`, `online`), `lead_time_hours` | Backend (schedule-api) | PostHog + Warehouse |
| `appointment_confirmed` | Paciente ou clínica confirma | `appointment_id`, `confirmation_channel` (`whatsapp`, `email`, `manual`) | Backend | PostHog + Warehouse |
| `appointment_completed` | Status passa para `completed` | `appointment_id`, `channel`, `duration_minutes` | Backend | PostHog + Warehouse |
| `appointment_no_show` | Status passa para `no_show` após janela | `appointment_id`, `was_predicted_no_show` (bool — Anti-no-show IA) | Backend | PostHog + Warehouse |
| `whatsapp_reminder_sent` | Envio confirmado pela Meta API | `appointment_id`, `template_name`, `cost_brl_estimated` | Backend | PostHog + Warehouse |
| `whatsapp_quality_rating_changed` | Meta API muda quality rating do número do tenant | `from_rating`, `to_rating` (`high`, `medium`, `low`, `flagged`) | Backend | PostHog + Warehouse + Alert SRE |
| `appointment_online_created` | Schedule cria appointment com `channel=online` → chama POST `/api/v1/rooms` | `appointment_id`, `tenant_has_rooms_plan` (bool), `pricing_mode` (`pay_per_minute`, `pool_rooms`, `pool_suite`) | Backend | PostHog + Warehouse (KPI cross-sell, ADR-0007) |
| `feature_used` | Uso de feature taggeada (gravação, encaixe, IA no-show) | `feature_name`, `entry_point` | Backend ou Frontend | PostHog |
| `quota_warning_shown` | Tenant atinge 80% de quota do mês | `quota_type` (`rooms_minutes`, `whatsapp_msgs`, `seats`), `pct_used` | Backend | PostHog |
| `quota_exceeded` | Tenant ultrapassa quota inclusa (entra em overage) | `quota_type`, `units_over`, `overage_brl_estimated` | Backend | PostHog + Warehouse |
| `activation_milestone_reached` | Definição de ativação acima (Rooms/Schedule/Suite) | `sku`, `milestone` (`activated`), `days_from_signup` | Backend (derivado) | PostHog + Warehouse |

#### Time-to-value (TTV) — definição operacional

- **Rooms TTV** = `room_minute_billed` (primeiro) — `trial_signup_completed`. Alvo P50 ≤ 15 min (Pricing §7 Estágio 3).
- **Schedule TTV** = `whatsapp_reminder_sent` (primeiro) — `trial_signup_completed`. Alvo P50 ≤ 1 dia útil (cliente precisa importar agenda).
- **Suite TTV** = max(Rooms TTV, Schedule TTV). Alvo P50 ≤ 1 dia útil.

---

### 5.3 Funil de Conversão paga — billing (Stripe + Iugu)

> Owner: `software-engineer`. Source-of-truth: webhooks Stripe + Iugu → outbox `billing.events` ([ADR-0010](../docs/adr/0010-billing-gateway-stripe-iugu.md)). Roda em M2+ (atrelado a checkout self-service).

| Evento | Trigger | Propriedades-chave | Owner | Destino |
|---|---|---|---|---|
| `checkout_started` | Usuário abre `/checkout` (UI, não Stripe Checkout) | `sku`, `plan_tier`, `billing_cycle`, `seats`, `entry_point` (`trial_banner`, `pricing_page`, `cross_sell`) | Frontend | PostHog |
| `payment_method_selected` | Escolheu cartão (Stripe) ou PIX/boleto (Iugu) | `payment_method` (`card`, `pix`, `boleto`), `gateway` (`stripe`, `iugu`) | Frontend | PostHog |
| `coupon_applied` | Aplica cupom (Founders Program ou parceria SBP/ABP) | `coupon_code`, `discount_pct`, `coupon_type` (`founders`, `partner`, `referral`) | Frontend + Backend | PostHog + Warehouse |
| `checkout_completed` | UI recebe success do gateway (não confirma cobrança) | `sku`, `plan_tier`, `billing_cycle`, `seats`, `gross_value_brl`, `discount_brl`, `net_value_brl`, `payment_method`, `gateway`, `coupon_code` | Frontend | PostHog |
| `subscription_started` | Outbox: idp-api cria subscription | `subscription_id`, `sku`, `plan_id`, `plan_tier`, `billing_cycle`, `seats`, `mrr_brl_estimated`, `arr_brl_estimated`, `gateway`, `founders_program` | Backend (idp-api) | PostHog + Warehouse |
| `subscription_activated` | 1º pagamento liquidado com sucesso (webhook Stripe `invoice.paid` ou Iugu `invoice_status_changed=paid`) | `subscription_id`, `first_invoice_id`, `gross_amount_brl`, `gateway_fee_brl`, `net_amount_brl`, `time_from_signup_hours` | Backend (webhook handler) | PostHog + Warehouse |
| `invoice_generated` | Invoice mensal gerada (metered + flat) | `invoice_id`, `subscription_id`, `period_start`, `period_end`, `subtotal_brl`, `overage_brl`, `taxes_brl`, `total_brl` | Backend | Warehouse |
| `invoice_paid` | Webhook: pagamento liquidado | `invoice_id`, `gateway`, `payment_method`, `paid_at`, `gateway_fee_brl`, `net_amount_brl`, `days_to_pay` | Backend | PostHog + Warehouse |
| `payment_failed` | Webhook: cobrança falhou | `invoice_id`, `gateway`, `failure_reason_code`, `attempt_number`, `next_retry_at` | Backend | PostHog + Warehouse + Alert |
| `dunning_email_sent` | Sequência de cobrança enviada após falha | `invoice_id`, `dunning_step` (1–5), `template` | Backend | PostHog + Warehouse |
| `dunning_recovered` | Pagamento liquida após dunning | `invoice_id`, `dunning_step_recovered`, `recovery_method` (`auto_retry`, `manual_card_update`, `gateway_switch`) | Backend | PostHog + Warehouse |
| `subscription_paused` | Tenant pausa (sem cobrança, dados retidos 30d) | `subscription_id`, `reason_code` | Backend | PostHog + Warehouse |
| `subscription_cancelled` | Tenant cancela (cobranças param em fim de ciclo) | `subscription_id`, `reason_code`, `reason_text` (livre, sanitizado), `cancelled_by` (`user`, `support`, `system_dunning`), `mrr_lost_brl` | Backend | PostHog + Warehouse |
| `subscription_churned` | Fim de ciclo após cancelamento ou dunning final | `subscription_id`, `churn_type` (`voluntary`, `involuntary`), `lifetime_revenue_brl`, `lifetime_months` | Backend (derivado) | PostHog + Warehouse |

#### Por que separar `subscription_started` e `subscription_activated`

Stripe `customer.subscription.created` dispara antes do 1º pagamento liquidar. Receita só conta quando `invoice.paid` chega. Misturar os dois corrompe MRR — o GTM Founders Program ofereceu anual upfront, então 1º pagamento vale 12 meses de MRR de cobertura.

#### Cupons / Founders Program

- Cada batch (Rooms M3, Schedule M6, Suite M9) tem um prefixo: `FOUNDERS_ROOMS_M3_*`, `FOUNDERS_SCHEDULE_M6_*`, `FOUNDERS_SUITE_M9_*`.
- Slot é assinado por feature flag PostHog (`founders_program_rooms_open=true` enquanto < 50). Fechamento automático.
- Métricas obrigatórias: % de slots ocupados, conversão Founders → Founders+1Y renovação (medida em M15+).

---

### 5.4 Funil de Expansão e Retenção

> Owner: `software-engineer` (derived events do warehouse) + `fullstack-engineer` (banners in-app). Roda em M5+ (cross-sell base Rooms) e M9+ (Suite upsell).

| Evento | Trigger | Propriedades-chave | Owner | Destino |
|---|---|---|---|---|
| `seat_added` | Tenant adiciona médico ativo | `seats_before`, `seats_after`, `mrr_delta_brl` | Backend | PostHog + Warehouse |
| `seat_removed` | Tenant remove médico ativo | `seats_before`, `seats_after`, `mrr_delta_brl` (negativo) | Backend | PostHog + Warehouse |
| `plan_upgraded` | Mudança de tier para cima (Solo → Clínica → Enterprise) | `from_plan_tier`, `to_plan_tier`, `mrr_delta_brl`, `trigger` (`self_service`, `sales_assisted`, `auto_quota`) | Backend | PostHog + Warehouse |
| `plan_downgraded` | Mudança de tier para baixo | `from_plan_tier`, `to_plan_tier`, `mrr_delta_brl` (negativo), `reason_code` | Backend | PostHog + Warehouse |
| `cross_sell_banner_shown` | Banner in-app de Rooms→Schedule, Schedule→Rooms, ou ⇉ Suite | `from_sku`, `to_sku`, `banner_id`, `trigger_rule` (ex.: `schedule_paid_min_3m_200min`) | Frontend | PostHog |
| `cross_sell_banner_clicked` | Clique no CTA do banner | `banner_id`, `from_sku`, `to_sku` | Frontend | PostHog |
| `cross_sell_converted` | Adicionou segundo SKU em até 30d do banner clicado | `from_sku`, `to_sku`, `new_subscription_id`, `days_from_banner_click` | Backend (derivado) | Warehouse |
| `suite_migration_started` | Tenant com Rooms+Schedule clica "Migrar para Suite" | `current_mrr_brl`, `suite_mrr_brl`, `monthly_savings_brl` | Frontend | PostHog |
| `suite_migration_completed` | Subscriptions consolidadas em Suite | `consolidated_subscription_id`, `monthly_savings_brl_actual`, `migration_seconds` | Backend | PostHog + Warehouse |
| `pool_minute_consumed` | Suite V2 (M12+): minuto faturável vem de pool compartilhado | `pool_id`, `consumed_minutes`, `pool_remaining_minutes`, `source_product_sku` | Backend | Warehouse (não PostHog — volume) |
| `pool_depletion_warning` | Pool ≥ 80% consumido no ciclo | `pool_id`, `pct_used`, `days_remaining_in_cycle` | Backend | PostHog + Warehouse |
| `pool_depleted` | Pool consumido 100% → próximas unidades viram overage | `pool_id`, `cycle_period`, `overage_brl_estimated_remaining_cycle` | Backend | PostHog + Warehouse |
| `feature_adoption_milestone` | Tenant atinge marcos: 10 salas, 100 agendamentos, 1ª gravação, etc. | `feature_name`, `milestone_threshold` | Backend (derivado) | PostHog |
| `support_ticket_opened` | Conexão com helpdesk (HubSpot/Intercom) | `ticket_id`, `category` (`billing`, `bug`, `how_to`, `lgpd_dsar`), `priority` | Backend (webhook helpdesk) | PostHog + Warehouse |
| `nps_survey_shown` | Pesquisa NPS in-app | `survey_id`, `trigger_rule` | Frontend | PostHog |
| `nps_survey_submitted` | Resposta enviada | `score` (0–10), `category` (`promoter`, `passive`, `detractor`), `comment_length` | Frontend | PostHog + Warehouse |
| `nps_referral_prompted` | Promoter (≥ 9) recebe prompt de indicação | `prompt_variant` | Frontend | PostHog |
| `referral_invite_sent` | Tenant envia indicação | `invite_method` (`email`, `whatsapp`, `link_copy`) | Backend | PostHog + Warehouse |
| `referral_converted` | Indicação vira tenant pago | `referrer_tenant_id`, `referred_tenant_id`, `reward_brl` | Backend (derivado) | PostHog + Warehouse |
| `reactivation_email_sent` | Tenant churned recebe campanha de winback | `campaign_id`, `months_since_churn` | Backend | Warehouse |
| `reactivation_converted` | Tenant churned reativa subscription | `previous_subscription_id`, `new_subscription_id`, `months_since_churn` | Backend (derivado) | Warehouse |

#### Triggers de cross-sell (Pricing §7 Estágio 4)

| Trigger | Banner | Evento gerado |
|---|---|---|
| Schedule cliente fez ≥ 200 min encaixe online em 3 meses consecutivos | "Você gastou R$ X em pay-per-minute. Suite te economiza R$ Y" | `cross_sell_banner_shown` com `trigger_rule=schedule_paid_min_3m_200min` |
| Rooms Solo estourou 400 min em 2 meses consecutivos | "Atingiu o limite duas vezes. Clínica te dá 1.500 min + overage menor" | `cross_sell_banner_shown` com `trigger_rule=rooms_solo_overage_2m` |
| Schedule Clínica reduziu no-show ≥ 15% em 3 meses | E-mail celebrando + cross-sell Rooms | `cross_sell_banner_shown` com `trigger_rule=schedule_no_show_reduction` |
| Tenant ≥ 8 médicos ativos em qualquer plano | Lead pra sales-led Enterprise (gera task no CRM) | `cross_sell_banner_shown` com `trigger_rule=tenant_seats_gte_8` + ticket CRM |

Cada trigger vira uma query SQL no warehouse rodando 1x/dia + worker que insere evento e dispara banner via feature flag.

---

## 6. Mapeamento KPI/SLI do GTM → eventos

Cada métrica do KPI tree do GTM (§9) precisa estar derivável de eventos deste plano. Sem mapeamento, métrica não vai pro dashboard.

| KPI (GTM §9) | Definição operacional | Eventos / queries-fonte | Destino |
|---|---|---|---|
| **Visitantes únicos** | `count(distinct distinct_id)` em `page_view` | `page_view` | GA4 + PostHog |
| **Trial signups** | `count(trial_signup_completed)` por SKU | `trial_signup_completed` | PostHog + GA4 conversion |
| **Trial → Paid conversion** | `subscription_activated` / `trial_signup_completed` (mesmo `user_id`, janela 14+7d) | derivado warehouse | Warehouse + Metabase |
| **Activation rate D7** | tenants ativados em ≤ 7d / signups na cohort | `activation_milestone_reached` vs `trial_signup_completed` | Warehouse |
| **Time-to-value (TTV) P50** | percentil 50 de (ativação) − (signup) | derivado | Warehouse |
| **MRR** | soma de `mrr_brl_estimated` em `subscriptions` ativas (status `active`) | `subscription_activated`, `subscription_cancelled`, `plan_upgraded`, `plan_downgraded`, `seat_added`, `seat_removed` | Warehouse (source-of-truth) |
| **ARR** | MRR × 12 | derivado | Warehouse |
| **Net new MRR** | MRR adicionado − MRR perdido no mês | derivado | Warehouse |
| **NRR** | (MRR retido + expansion − contraction − churn) / MRR base 12m atrás | derivado | Warehouse |
| **ARPU por SKU** | MRR / tenants pagos por `product_sku` | derivado | Warehouse |
| **Logo churn mensal** | tenants churned / tenants ativos no início do mês | `subscription_churned` | Warehouse |
| **Revenue churn** | MRR perdido / MRR base no início do mês | derivado | Warehouse |
| **NPS** | promotores% − detratores% últimas 90d | `nps_survey_submitted` | PostHog + Warehouse |
| **CAC** | (custo paid + sales) / new customers no período | manual input mensal (paid spend + headcount) + `subscription_activated` | Warehouse |
| **CAC payback** | CAC / GM mensal por conta | derivado | Warehouse |
| **Suite attach rate** | tenants em Suite / tenants com ≥ 2 SKUs | derivado | Warehouse |
| **Encaixe online minutes (cross-product)** | soma de minutos billed onde `appointment_online_created.tenant_has_rooms_plan=false` | `appointment_online_created` + `room_minute_billed` | Warehouse |
| **Overage % do MRR** | (sum `overage_brl`) / MRR | `invoice_generated.overage_brl` | Warehouse |
| **WhatsApp quality rating** | rating atual por tenant | `whatsapp_quality_rating_changed` (last value) | Warehouse + Alert SRE |
| **Daily Active Tenants** | distinct `tenant_id` em qualquer evento de produto no dia | `room_*`, `appointment_*` | PostHog |
| **Founders Program slots ocupados** | count por batch / 50 | `subscription_started` com `founders_program=true` | PostHog + Warehouse |
| **Pipeline em $$ (sales-led)** | soma de `lead_form_submitted` × estágio (HubSpot/RD) | webhook do CRM → outbox | Warehouse |
| **BDR → AE conversion** | reuniões qualificadas / SQLs | webhook do CRM | Warehouse |

> Toda métrica do dashboard executivo (GTM §9) está coberta. Auditoria de cobertura: query `SELECT metric, has_source FROM kpi_tree` rodando semanal e alertando se algo regredir.

---

## 7. Dashboards

### Dashboards alvo (Metabase) — M3 entrega mínima viável

| Dashboard | Audiência | Atualização | Conteúdo mínimo |
|---|---|---|---|
| **Executive Weekly** | Founder + investors | Diária | MRR, ARR, Net new MRR, Tenants pagos, Churn, NRR, NPS, CAC payback, Trial→Paid |
| **Acquisition** | Growth/Founder | Diária | Visitantes únicos, Trial signups por SKU, CAC por canal, Top 10 keywords SEO, ROI por campanha UTM |
| **Activation** | Product + CSM | Diária | Activation rate D1/D7/D14 por cohort + SKU, TTV P50/P90, Onboarding step drop-off |
| **Revenue** | Founder + Finance | Diária (real-time billing alerts) | MRR breakdown SKU/tier, Overage %, Failed payments queue, Dunning recovery rate |
| **Cross-sell & Retention** | Product + CSM | Semanal | Cross-sell banner CTR/conversão, Suite attach, Encaixe online minutes, NPS trend |
| **Sales pipeline** (M5+) | BDR/AE/Founder | Diária | Funnel BDR→AE→Won, CAC sales-led, Pipeline em $$ por estágio, Win rate |
| **Health / Ops** | SRE + Founder | Real-time | Eventos válidos % por superfície, WhatsApp quality rating por tenant, Stripe/Iugu webhook failure rate, Latência metering tick |
| **Founders Program** | Founder | Semanal | Slots ocupados (3 batches), Founders renewal rate (M15+), Referrals dos Founders |

### SLO de qualidade do tracking

| Superfície | SLO | Owner |
|---|---|---|
| Site (GA4 + PostHog web) | ≥ 95% dos `pricing_page_viewed` têm `utm_*` quando vêm de paid | Fullstack |
| Site | ≤ 2% dos eventos sem `device_id` | Fullstack |
| Produto (PostHog server-side) | ≥ 99% dos eventos têm `tenant_id` e `user_id` (quando user existe) | Backend |
| Produto | ≤ 1% dos eventos com `environment ≠ prod` em dashboards de prod | Backend |
| Billing | ≥ 99,9% dos `subscription_activated` reconciliam com Stripe/Iugu webhook em ≤ 60s | Backend |
| Warehouse | Lag de ingestão Kafka → Postgres ≤ 5 min P95 | SRE |
| PII safety | 100% dos eventos passam pelo proxy DLP sem violação | SRE + Solutions Architect |

---

## 8. Privacidade, LGPD e CFM

### Princípios não-negociáveis

1. **PII de paciente nunca entra em PostHog ou GA4.** Nome, CPF, e-mail, telefone, conteúdo de chamada, transcrição, gravação e qualquer derivado **são proibidos** em propriedades de evento. Identificadores de paciente, quando necessários para análise, são `sha256(cpf || tenant_salt)`.
2. **PII de usuário (médico/admin)** mantém `user_id` (UUID interno) + `tenant_id`. E-mail e nome ficam fora de propriedades — buscados no warehouse via join interno se necessário.
3. **Session replay (PostHog)** desligado por default. Ativado apenas após assinatura de DPA específica pelo tenant + mascaramento agressivo (input fields, áudio/vídeo). Em telas que possam mostrar dado de paciente, replay é **bloqueado por seletor CSS** (`data-replay="block"`).
4. **Consent Mode** (GA4) e `opt_out_capturing_by_default` (PostHog) **antes** do consent. Trial signup só dispara após interação consciente.
5. **Direito de eliminação (LGPD art. 18)**: handler em idp-api faz delete cascateado em PostHog (via API), warehouse e read-models. Owner: `software-engineer`. SLA: 15 dias corridos.

### Consent banner

- Granularidade: **essencial** (sempre), **analytics** (PostHog + GA4 produto), **marketing** (GA4 ads + Meta pixel + LinkedIn pixel).
- Geografia: ativo em BR (e qualquer geo). Render no `site/` via Cookiebot-equivalente open-source ou Klaro!.
- Estado persiste em cookie 1ª parte 12 meses; pode ser revisto via link no footer.

### Proxy DLP de eventos

Antes de evento sair para PostHog/GA4, passa por **proxy interno** (Go, em `platform/backend/plexcare-analytics-proxy/` — a criar) que aplica regex contra:

- CPF `\d{3}\.?\d{3}\.?\d{3}-?\d{2}`
- Telefone BR `\(?\d{2}\)?\s?\d{4,5}-?\d{4}`
- E-mail genérico
- Campos `name`, `email`, `phone`, `cpf`, `address` em qualquer profundidade

Evento que falha a checagem é **dropado** + log de incident para o SRE. Falsos positivos viram allowlist explícita revista pelo DPO.

### Healthcare-specific (CFM 2.314)

- `room_minute_billed` carrega `room_id` e `tenant_id`, **nunca** ID de paciente. Auditoria de gravação fica no banco do teleconf (criptografado), não no warehouse analítico.
- Gravações (S3 SSE-KMS) **não** geram eventos com URL ou identificador acessível. `recording_completed` carrega `room_id` e `recording_bytes` — nada que reidentifique paciente.

### DPO sign-off

Plano de tracking precisa ser revisto e assinado pelo DPO/Solutions Architect antes de M1 (produção do funil de produto). Sem sign-off, eventos de produto ficam em ambiente `staging`.

---

## 9. Roadmap de implementação

> Cada fase amarrada a marcos do GTM (§6). SLO de fase: "eventos válidos ≥ 95% do esperado em 14 dias após go-live".

### Fase 0 — Setup (M0, Jul/26)

| Tarefa | Owner | Output |
|---|---|---|
| Provisionar PostHog Cloud EU + criar projetos `plexcare-prod` e `plexcare-staging` | SRE | API keys em Vault |
| Provisionar GA4 property + Tag Assistant config | Fullstack | GA4 measurement ID |
| Criar GTM container e linkar GA4 | Fullstack | GTM container ID |
| Criar warehouse Postgres analítico + read replica do teleconf | SRE | Conexões em `analytics.*` |
| Provisionar Metabase + integração warehouse | SRE | Metabase URL interna |
| Definir UTM taxonomy em `docs/marketing/utm-taxonomy.md` | Growth/Founder | Doc canônico |
| DPO/Solutions Architect aprova §8 deste plano | Architect | Sign-off doc em `docs/compliance/tracking-dpo-signoff-2026-07.md` |

### Fase 1 — Site e trial (M0–M2, Jul–Set/26)

Bloqueia GA Rooms M3 (sem isso, não medimos aquisição).

| Tarefa | Owner | Eventos / KPIs cobertos |
|---|---|---|
| Implementar Consent Mode + Klaro no `site/` | Fullstack | Pré-requisito |
| Instalar GTM + PostHog snippets no `site/` | Fullstack | `page_view`, `cta_clicked`, autocapture |
| Implementar `pricing_calculator_used` + `pricing_calculator_recommendation_clicked` em `/precos` | Fullstack | KPIs de aquisição §5.1 |
| Implementar `trial_signup_started` + `trial_signup_completed` + alias PostHog | Fullstack + Backend (idp-api) | Funil aquisição→ativação |
| Configurar GA4 Conversions: `pricing_page_viewed`, `trial_signup_completed`, `demo_requested` | Fullstack | Atribuição paid |
| Configurar audiences GA4 + LinkedIn Insight Tag + Meta Pixel (gated por consent marketing) | Fullstack | Remarketing |
| Dashboard Acquisition v1 em Metabase | SRE | Dashboard live em M2 |

**Saída de fase:** 100% dos `trial_signup_completed` aparecem em PostHog + GA4; UTMs preenchidos em ≥ 95% do tráfego pago.

### Fase 2 — Produto Rooms (M1–M3, Ago–Out/26)

Bloqueia GA Rooms M3. Depende de fix metering (P0 GTM §2).

| Tarefa | Owner | Eventos / KPIs cobertos |
|---|---|---|
| posthog-go SDK no teleconf-service com propriedades globais (§4) | Backend | Pré-requisito |
| Consumer Kafka `product.events` → PostHog Capture API | Backend + SRE | Pré-requisito |
| Eventos `room_created`, `room_joined`, `room_ended`, `recording_completed` | Backend | Funil ativação Rooms |
| Eventos `room_minute_billed` → warehouse direto (não PostHog) | Backend | KPI `room_minutes_billed` |
| Eventos `onboarding_*`, `feature_used`, `quota_warning_shown`, `quota_exceeded` | Frontend (teleconf-web) + Backend | Funil ativação |
| Definição operacional + evento derivado `activation_milestone_reached` (Rooms) | Backend (derivado) | Activation rate D7 |
| Proxy DLP de eventos em `plexcare-analytics-proxy` | Backend + SRE | LGPD/CFM |
| Dashboard Activation v1 (Rooms) em Metabase | SRE | Dashboard live em M3 |

**Saída de fase:** ≥ 99% dos `room_ended` reconciliam com `participant_sessions` (ratifica fix metering); `activation_milestone_reached` dispara para ≥ 95% dos tenants que de fato ativam.

### Fase 3 — Billing (M2–M3, Set–Out/26)

Source-of-truth de receita. Trava GA Rooms se não existir.

| Tarefa | Owner | Eventos / KPIs cobertos |
|---|---|---|
| Webhook handlers Stripe + Iugu publicando em outbox `billing.events` | Backend (idp-api) | Pré-requisito |
| Consumer Kafka `billing.events` → PostHog + warehouse | Backend + SRE | Pré-requisito |
| Eventos `checkout_*`, `payment_method_selected`, `coupon_applied` | Frontend | Funil conversão |
| Eventos `subscription_started`, `subscription_activated` | Backend | MRR signal |
| Eventos `invoice_generated`, `invoice_paid`, `payment_failed`, `dunning_*` | Backend | Revenue + retenção involuntária |
| Eventos `subscription_paused/cancelled/churned` | Backend | Churn + NRR |
| Feature flag PostHog `founders_program_rooms_open` (até 50 slots) | Backend | G-4 do GTM |
| Dashboard Revenue v1 em Metabase + alerta `failed_payment` no PagerDuty | SRE | Saúde financeira |

**Saída de fase:** Toda venda de Rooms entra em MRR no warehouse em ≤ 5 min do `invoice.paid`; reconciliação mensal com Stripe Dashboard fecha em 100%.

### Fase 4 — Schedule + cross-sell (M5–M6, Dez/26–Jan/27)

Atrelado a GA Schedule M6 e cross-sell base Rooms.

| Tarefa | Owner | Eventos / KPIs cobertos |
|---|---|---|
| posthog-go no schedule-api + consumer Kafka | Backend + SRE | Pré-requisito |
| Eventos `appointment_*`, `whatsapp_reminder_sent`, `whatsapp_quality_rating_changed` | Backend | Funil ativação Schedule |
| Evento `appointment_online_created` (cross-produto, ADR-0007) | Backend | KPI cross-sell |
| Definição `activation_milestone_reached` (Schedule) | Backend | Activation rate Schedule |
| Worker de triggers cross-sell (queries warehouse) + banner in-app | Backend + Frontend | `cross_sell_banner_shown/clicked/converted` |
| Eventos `seat_added/removed`, `plan_upgraded/downgraded` | Backend | NRR + expansion |
| Dashboard Cross-sell & Retention v1 | SRE | Dashboard live em M6 |
| NPS in-app survey (PostHog Surveys) + `nps_*` events | Frontend | NPS metric |

**Saída de fase:** Cross-sell banner CTR ≥ 8% medido; encaixe online minutes rastreado por tenant; primeira métrica de Suite attach disponível em M8.

### Fase 5 — Suite + retenção avançada (M8–M9, Mar–Abr/27)

Atrelado a GA Suite M9.

| Tarefa | Owner | Eventos / KPIs cobertos |
|---|---|---|
| Eventos `suite_migration_*` | Backend | Migration funnel |
| Sales pipeline import (HubSpot/RD → warehouse via webhook outbox) | Backend + SRE | Pipeline em $$ |
| Dashboard Sales pipeline v1 | SRE | Sales-led KPIs |
| Eventos `referral_*`, `reactivation_*` | Backend | Programa de embaixador (G GTM §5E) |

### Fase 6 — Pool Suite V2 + maturidade (M12, Jul/27)

Atrelado a Pool compartilhado V2 ([ADR-0009](../docs/adr/0009-pool-compartilhado-suite.md)).

| Tarefa | Owner | Eventos / KPIs cobertos |
|---|---|---|
| Eventos `pool_minute_consumed`, `pool_depletion_warning`, `pool_depleted` | Backend | KPIs Suite pool |
| Dashboard Pool health (overage previsto vs realizado) | SRE | Operação Suite |
| Migração warehouse Postgres → BigQuery (gated por volume / MRR ≥ R$ 200k) | SRE | Escala |

---

## 10. Próximos passos e handoff

### Decisões resolvidas em 2026-06-07

- [x] **I-6** Consent banner com **3 níveis granulares** (essencial / analytics / marketing). Defesa ANPD prioritária sobre opt-in agregado.
- [x] **I-8** Trial signup pré-consent: **modelar via GA4 Consent Mode v2**. PostHog permanece silenciado até consent; Smart Bidding mantido funcional.
- [x] **I-9** **6 fases atreladas ao GTM** (Fase 0 setup → Fase 6 Pool V2). Dashboards entregues incrementalmente.
- [x] **I-10** **Mapeamento atual de owners mantido**. Billing+produto no `software-engineer` reduz handoff entre `subscription_activated` e `invoice_paid`.

### Pendências operacionais (não bloqueiam, mas precisam entrar em backlog)

- [ ] DPO/Solutions Architect agenda sign-off de §8 antes de M1
- [ ] Founders Program: cupons Stripe e Iugu pré-criados? Decisão Backend
- [ ] Webhook do CRM (HubSpot/RD) já está em backlog? Confirmar com `software-engineer`

### Handoff `software-engineer`

Abrir issues no GitHub Project #3 (PlexCare Roadmap) com label `area/analytics`:

1. **Issue: analytics-proxy DLP service** — novo serviço Go em `platform/backend/plexcare-analytics-proxy/` que recebe eventos de todos os SDKs server-side, valida contra DLP regex (§8), encaminha para PostHog Capture API. SLA P99 ≤ 50ms.
2. **Issue: posthog-go integration em teleconf-service** — wrapper que carrega propriedades globais (§4) a partir de `context.Context` (tenant_id + plan via read-model ADR-0008). Bloquear se `tenant_id` ausente.
3. **Issue: posthog-node em idp-api** — idem, para eventos de subscription/billing.
4. **Issue: posthog-go em schedule-api** — depois do MVP Schedule (M5+).
5. **Issue: outbox consumers (Kafka → PostHog + Warehouse)** — 3 topics, consumers idempotentes.
6. **Issue: feature flag PostHog `founders_program_*_open`** — auto-close em 50.
7. **Issue: webhook handlers Stripe + Iugu publicando `billing.events`** — testes table-driven cobrindo eventos `invoice.paid`, `payment_failed`, `subscription.deleted` (ambos gateways).
8. **Issue: derived events workers** — cron 1x/dia para `activation_milestone_reached`, `cross_sell_banner_shown` triggers, `subscription_churned`, `referral_converted`.
9. **Issue: derived warehouse views** — `analytics.mrr_daily`, `analytics.cohorts`, `analytics.kpi_tree`.

### Handoff `fullstack-engineer`

Issues com label `area/web`:

1. **Issue: Consent banner Klaro/equivalente em site/** — 3 níveis (essencial/analytics/marketing) + persistência + footer link.
2. **Issue: GTM + GA4 + PostHog snippets no site/** — Consent Mode v2 wiring.
3. **Issue: pricing_calculator events em /precos** — captura inputs sem PII.
4. **Issue: trial_signup_completed + posthog.alias** — chamada após `POST /signup` retornar 201.
5. **Issue: posthog-js em teleconf-web** — identificação automática pós-login via JWT claims.
6. **Issue: cross-sell banners in-app** — feature flag por trigger_rule (PostHog flags).
7. **Issue: NPS in-app survey** — PostHog Surveys; trigger por feature_adoption_milestone.

### Handoff `sre-infra-engineer`

Issues com label `area/observability`:

1. **Issue: provisionar PostHog Cloud EU + Vault secrets**.
2. **Issue: provisionar warehouse Postgres analítico + read replica**.
3. **Issue: provisionar Metabase + 8 dashboards** (§7).
4. **Issue: SLO + alerting** — ingestão lag, webhook failure rate, eventos sem `tenant_id`, WhatsApp quality_rating degraded.
5. **Issue: DLP allowlist process** — runbook para incident de evento bloqueado.
6. **Issue: PostHog → DSAR delete handler** — endpoint para LGPD art. 18.

### Handoff `solutions-architect`

1. **Issue: DPO sign-off §8 deste plano** — documentar em `docs/compliance/tracking-dpo-signoff-2026-07.md`.
2. **Issue: revisar 4 ADRs com lente analítica** — confirmar que [ADR-0008](../docs/adr/0008-plan-data-model.md) cobre todas as propriedades globais que o tracking precisa do read-model.
3. **Issue: criar ADR-0011** se decidirmos abrir warehouse para BigQuery em M12 (gated por volume).

### Pós-tracking (não nesta pipeline)

Itens que ficam para outra pipeline ou são responsabilidade contínua do time:

- Calibração de modelos de Anti-no-show IA (usa eventos `appointment_no_show.was_predicted_no_show`)
- A/B testing de pricing (feature flag + cohort por `tenant_id`)
- Attribution model evoluído (multi-touch, MMM) — gated por volume M12+
- Análise de unit economics em LTV cohort detalhado (Métricas Brasileiras de SaaS)

---

## 11. Checkpoint

**Todas as 10 decisões aprovadas em 2026-06-07:**

- ✅ **I-1** Stack PostHog EU + GA4/GTM + Warehouse Postgres + Metabase
- ✅ **I-2** Stripe + Iugu webhooks como source-of-truth de receita
- ✅ **I-3** Identidade com `user_id` + `tenant_id` + `product_sku` + `plan_id`
- ✅ **I-4** Naming `<objeto>_<ação>` em snake_case
- ✅ **I-5** 4 funis críticos (Aquisição/Ativação/Conversão/Retenção)
- ✅ **I-6** Consent banner LGPD com 3 níveis granulares (essencial / analytics / marketing)
- ✅ **I-7** PII de paciente proibida em qualquer evento; SHA-256 com salt por tenant
- ✅ **I-8** Trial signup pré-consent: modelar via GA4 Consent Mode v2; PostHog silenciado até consent
- ✅ **I-9** Roadmap em 6 fases atrelado aos marcos GA do GTM (M0 → M12)
- ✅ **I-10** Owners: `fullstack-engineer` (site), `software-engineer` (produto+billing), `sre-infra-engineer` (warehouse+DLP+dashboards), `solutions-architect` (DPO sign-off)

**Pipeline `/monetize-plexcare` — fechamento:**

A pipeline de monetização (Sessões 1–4) está completa após validação das decisões pendentes desta etapa. Próximas pipelines naturais:

1. **`/feature` de cada feature de billing/checkout** — discovery → blueprint → spec → tdd
2. **`/adr` para decisões técnicas que vão surgir** (BigQuery migration, métrica de pool em V2)
3. **`/incident` runbook para alertas de receita** — failed payment, webhook drop, churn anomaly

---

## Anexos

### Referências

- Pricing: [`tasks/monetize-1-pricing.md`](monetize-1-pricing.md)
- GTM: [`tasks/monetize-3-gtm.md`](monetize-3-gtm.md)
- Metering: [ADR-0006](../docs/adr/0006-metering-rooms-schedule.md)
- Cross-product: [ADR-0007](../docs/adr/0007-encaixe-online-cross-produto.md)
- Plan data model: [ADR-0008](../docs/adr/0008-plan-data-model.md)
- Pool Suite: [ADR-0009](../docs/adr/0009-pool-compartilhado-suite.md)
- Billing: [ADR-0010](../docs/adr/0010-billing-gateway-stripe-iugu.md)
- Outbox: [ADR-0005](../docs/adr/0005-outbox-worker-poll.md)
- Multi-tenancy: [ADR-0002](../docs/adr/0002-multi-tenancy-via-header-context.md)
- Memórias: `plexcare-monetization-scope`, `plexcare-monetization-gtm`, `plexcare-adr-0008-plan-data-model`, `plexcare-devtenant-security`, `plexcare-metering-root-cause`

### Tabela canônica de eventos (índice)

| Funil | # Eventos | Owner principal | Fase do roadmap |
|---|---|---|---|
| 5.1 Aquisição (site) | 12 | Fullstack | Fase 1 (M0–M2) |
| 5.2 Ativação (produto) | 21 | Backend + Fullstack | Fase 2 Rooms (M1–M3), Fase 4 Schedule (M5–M6) |
| 5.3 Conversão (billing) | 14 | Backend | Fase 3 (M2–M3) |
| 5.4 Expansão & Retenção | 19 | Backend + Fullstack | Fase 4 (M5–M6), Fase 5 (M8–M9), Fase 6 (M12) |
| **Total** | **66 eventos** | — | M0–M12 |

### Convenções de nomenclatura — referência rápida

- Evento: `objeto_acao` (snake_case) — ex.: `room_created`, `subscription_activated`
- Propriedade: `snake_case` — ex.: `product_sku`, `mrr_brl_estimated`
- Valor monetário: sempre sufixo `_brl` (centavos inteiros no warehouse; reais decimais nos eventos)
- Timestamp: ISO 8601 UTC; propriedade sufixo `_at` — ex.: `tenant_signup_at`
- Boolean: prefixo `is_` ou `has_` ou substantivo claro — ex.: `recording_requested`, `tenant_has_rooms_plan`
- Hash de PII: `sha256(valor || tenant_salt)` — propriedade sufixo `_hash`
- Enum: lista fechada documentada neste plano; mudança requer PR + atualização aqui
