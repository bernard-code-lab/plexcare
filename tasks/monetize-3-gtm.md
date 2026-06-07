# Etapa 3 — Go-to-Market PlexCare (Jul 2026 → Out 2027)

> Artefato da pipeline `/monetize-plexcare`. Sessão 3 de 4. Antes de avançar para a Etapa 4 (instrumentação), valide as decisões marcadas como **G-N** com o stakeholder responsável.
>
> **Horizonte:** 16 meses (M0 = Jul 2026, M16 = Out 2027) — cobre Pre-GA Rooms → GA Suite + 6 meses pós-GA.
> **Sequência de lançamento:** Rooms → Schedule → Suite (decisão de stakeholder em 2026-06-07).
> **Contexto canônico:** [`tasks/monetize-1-pricing.md`](monetize-1-pricing.md), ADRs [0006](../docs/adr/0006-metering-rooms-schedule.md), [0007](../docs/adr/0007-encaixe-online-cross-produto.md), [0008](../docs/adr/0008-plan-data-model.md), [0009](../docs/adr/0009-pool-compartilhado-suite.md), [0010](../docs/adr/0010-billing-gateway-stripe-iugu.md). Memórias: `plexcare-product`, `plexcare-monetization-scope`, `plexcare-competitor-communicare`.

---

## 1. Resumo executivo (TL;DR)

| Decisão GTM | Escolha | Razão curta |
|---|---|---|
| **G-1** ICP primário | **Médico solo telemed** (Rooms) → **Clínica 4–15 multichannel** (Schedule/Suite) | Médico solo converte rápido (PLG); clínica é o SKU campeão (Suite Clínica = LTV R$ 161k) |
| **G-2** Channel mix por fase | Beta fechado: **field-led** (10 design partners). GA Rooms: **PLG self-service** + content. GA Suite: **PLG + Sales-led Enterprise** | Casa com maturidade do produto e tipo de buyer (médico = PLG; clínica média = híbrido; rede = sales-led) |
| **G-3** Posicionamento | **"Plataforma de saúde componível"** — Rooms standalone, Schedule standalone, ou Suite. Ataque direto a Communicare ("suite monolítica fechada") | Diferencial estrutural (multi-tenant + API + componibilidade); ICP-greenfield prefere comprar sob medida |
| **G-4** Oferta de lançamento | **Founders Program** primeiros 50 tenants: 50% off em assinatura anual por 12 meses + acesso prioritário ao roadmap + suporte direto da liderança | Compra rápido com fricção mínima; gera 50 case-studies e referências para o segundo onda |
| **G-5** Sequência de SKUs | **Rooms (M3 GA) → Schedule (M6 GA) → Suite (M9 GA)** | Rooms já tem código produzindo (fix metering = caminho crítico); Schedule é scaffold; Suite é bundle dos dois |
| **G-6** Geografia M0–M12 | **Capitais BR (SP, RJ, BH, POA, BSB, Curitiba, Salvador, Recife)** + atendimento remoto qualquer estado | Concentra esforço de field-marketing onde está 70% do mercado privado de saúde |
| **G-7** Especialidades-alvo | **Psiquiatria, Endocrinologia, Nutrição, Dermatologia, Cardiologia** (telemed-friendly) primeiro; pediatria/ginecologia segunda onda | Tele-receita CFM-permitida; consultas curtas (15–25 min) ≈ ARPU previsível; baixa fricção física |
| **G-8** Parcerias estratégicas | Sociedades médicas (SBP, SBEM, SBC, SBD, SBP-Psiq); convênios médicos secundários (Amil/Hapvida out); incubadoras (Eretz.bio, Hospital Albert Einstein, InovaHC) | Acesso direto ao ICP via canais que ele já confia; trade: split de receita ou patrocínio de evento |
| **G-9** Métricas de sucesso M9 (GA Suite) | **MRR R$ 220k** + **350 tenants pagos** + **Suite attach rate ≥ 35%** + **NRR ≥ 105%** | Base sustentável para Série Seed/A; signal-de-product-market-fit em B2B saúde |
| **G-10** Métricas de sucesso M16 (pós-GA + 6m) | **MRR R$ 850k** + **1.200 tenants pagos** + **NRR ≥ 115%** + **CAC payback ≤ 4 meses** | Eficiência de capital comprovada; abre janela para Série A com unit-economics positivos |
| **G-11** Setor Público + Operadoras | **Adiado para M13+** (não bloqueia MVP) | Ciclo de venda 9–18 meses; entra após Suite GA com SLA já provado |

> **Bloqueio para Etapa 4 (instrumentação):** G-1, G-2, G-3, G-5 são premissas da pipeline e já foram confirmadas. **G-4, G-7, G-8, G-9, G-10 e G-11 confirmar antes de fechar instrumentação.**

---

## 2. Premissas e dependências

### Dependências de produto (bloqueios para o GTM)

| Dependência | Origem | Bloqueia o quê | Status / Owner |
|---|---|---|---|
| Fix metering Rooms (`participant_sessions` vazia) | Memória `plexcare-metering-root-cause`; ADR-0006 | **Tudo de Rooms billing.** Sem isso, invoice subestima uso → perda de receita | P0 — `software-engineer` (fix antes do M2) |
| `devtenant.Resolver` fake substituído por IdP real | Memória `plexcare-devtenant-security`; Issue #3 | **Tudo de produção.** Bypass de tenant é blocker LGPD/CFM | P0 — `software-engineer` (M0–M1) |
| Plan data model implementado (MySQL idp-api + read-model Postgres teleconf) | ADR-0008; memória `plexcare-adr-0008-plan-data-model` | Subscription, trial, gate de plano em runtime | P1 — `software-engineer` (M1–M2) |
| Stripe Metered + Iugu PIX/Boleto | ADR-0010 | Checkout self-service Rooms/Schedule | P1 — `software-engineer` (M2) |
| Schedule MVP (agenda multichannel + WhatsApp Business API) | Scaffold atual `plexcare-schedule-api`; ADR-0007 | Tudo de Schedule e Suite | P1 — `software-engineer` (M3–M5) |
| Página `/precos` no `site/` com calculator dinâmico | `tasks/monetize-1-pricing.md` §7 | Conversão PLG self-service | P2 — `fullstack-engineer` (M2) |
| Checkout self-service + onboarding 3-step | ADR-0008 § subscription lifecycle | Conversão trial → paid | P2 — `fullstack-engineer` (M2–M3) |
| Encaixe online cross-produto Schedule → Rooms (pay-per-minute) | ADR-0007 | Cross-sell Schedule-puro → Rooms | P3 — `software-engineer` (M5–M6) |
| Suite billing agregador (sem pool no MVP, só 15% off) | ADR-0009 (pool deferido) | GA Suite | P3 — `software-engineer` (M7–M8) |
| Tracking plan + LGPD review | Etapa 4 | Comprovar ativação, churn, conversão | **Etapa 4 desta pipeline** |

### Premissas de mercado (validar com SDR ou design partner antes de M3)

- TAM Brasil de telemedicina/agenda multichannel é **R$ 4–6 bi/ano** (consultórios médicos + ~30k clínicas pequenas/médias) — fonte: ANS + IBGE + relatórios Distrito 2025
- **70% da consulta privada** está em capitais (G-6 anchored aqui)
- **Reach orgânico via sociedades médicas é 10x mais eficiente** que LinkedIn ads para médico, mas exige relacionamento longo (3–6 meses para um patrocínio aprovado)
- Médico **brand-loyal** depois da primeira escolha de software — janela de entrada limitada a primeira contratação ou troca por falha do incumbente

---

## 3. ICP (Ideal Customer Profile) detalhado

### Primary ICP — "Dra. Mariana" (Rooms Solo)

| Atributo | Valor |
|---|---|
| Perfil | Médica solo, 32–45 anos, atende em consultório próprio + tele, 25–35 atendimentos/mês |
| Especialidade | Psiquiatria, Endocrinologia, Nutrição |
| Geografia | Capitais BR, atende paciente de qualquer estado via tele |
| Ferramentas atuais | Doctoralia (agenda), Zoom (sala), WhatsApp manual para lembretes |
| Dores | Zoom não tem gravação CFM-compliant; lembrete manual cansa; quer link branded com nome dela |
| Trigger de compra | Recebeu 2ª solicitação de gravação por advogado de paciente; CRM-pessoal já saturou |
| Cycle | 7–14 dias trial → paid (Single-decision; sem comitê) |
| Canal de aquisição | Content (SEO "sala virtual cfm"), comunidade de psiquiatras, indicação |
| ACV alvo | R$ 1.428/ano (Rooms Solo anual) |

### Secondary ICP — "Clínica Vitae" (Schedule + Suite Clínica)

| Atributo | Valor |
|---|---|
| Perfil | Clínica multispecialty, 4–15 médicos, 1.500–4.000 consultas/mês |
| Especialidades | Mix: ortopedia + neuro + endocrino + nutrição + psicologia |
| Geografia | Capital, sede física + tele |
| Ferramentas atuais | iClinic (prontuário+agenda) OU agenda em Excel + WhatsApp manual; Zoom for healthcare |
| Dores | No-show de 22–30%; lembretes manuais ocupam 1 secretária full-time; tele encaixe ad-hoc |
| Trigger de compra | Diretor administrativo recebeu meta de no-show ≤ 15%; quer reduzir headcount de secretaria; busca "agenda + IA" no Google |
| Cycle | 30–60 dias (decisão envolve diretor administrativo + sócio-médico) |
| Canal de aquisição | LinkedIn ads para administradores, eventos SBA/Hospitalar, parceria SBP (pediatria) |
| ACV alvo | R$ 1.908/ano × 8 médicos = R$ 15.264/ano (Schedule Clínica) OU R$ 29.148/ano (Suite Clínica) |

### Tertiary ICP — "Rede Bem-Estar" (Suite Enterprise)

| Atributo | Valor |
|---|---|
| Perfil | Rede 3–8 unidades, 30–80 médicos, 8.000–25.000 consultas/mês, possivelmente franquia |
| Geografia | 2+ capitais, atende convênio + particular |
| Ferramentas atuais | Sistema proprietário ou Feegow Enterprise; Zoom for healthcare; integrações HL7 sob demanda |
| Dores | Falta de pool unificado de minutos; sem white-label; suporte slow; preço por médico inflado para profissionais part-time |
| Trigger de compra | Renegociação anual de contrato vigente; RFP por compliance LGPD; M&A consolidando unidades |
| Cycle | 4–9 meses (RFP + POC + comitê executivo + legal review) |
| Canal de aquisição | Sales-led (BDR outbound), parcerias SBC/SBP, indicação de cliente Clínica satisfeito |
| ACV alvo | R$ 168k+/ano (custom) — projetado para 60% upsell Clínica→Enterprise dos primeiros 30 contratos |

### Anti-personas (NÃO vender no GTM 16 meses)

- **Médico hospitalar puro (não atende particular)** — comprado pela TI hospitalar via RFP enterprise; ciclo 12m+
- **Pequeno consultório com 1 secretária, atende só convênio Amil/Hapvida com integração SOAP** — exige integração HL7 já-pronta; sem ROI no MVP
- **Estética/odontologia** — fora do CFM 2.314 (regulação diferente); sai do escopo de produto
- **Hospital público / SUS** — adiado para M13+ (G-11)

---

## 4. Posicionamento e mensagem-chave

### Narrativa unificada

> **"PlexCare é a plataforma de saúde componível que cresce com você."**
>
> Comece com a sala virtual CFM-compliant ou a agenda multichannel — ative o outro quando precisar. A única plataforma B2B brasileira com **multi-tenant nativo, API pública e gravação CFM-pronta**, projetada para o médico que não quer trocar prontuário e para a clínica que quer parar de juntar 5 ferramentas com WhatsApp.

### Por SKU (mensagens e value propositions)

#### Rooms — "Sala virtual sem amarração"

- **Tagline:** "A sala virtual do médico que já tem prontuário."
- **Os 3 pontos que vendem:**
  1. **Gravação CFM-compliant out-of-the-box** (S3 com KMS, 30/90 dias de retenção, audit log LGPD) — Zoom não tem
  2. **Link branded com seu nome ou da clínica** — paciente entra em `plexcare.com.br/dra-mariana` (não `zoom.us/aleatório`)
  3. **API + Webhooks no plano Clínica** — integra com qualquer prontuário (iClinic, Memed, hospital próprio)
- **Anti-mensagem (evitar):** não vender contra Zoom em preço (Rooms é mais caro). Vender em compliance, branding e ausência de amarração com agenda alheia.

#### Schedule — "Agenda que conversa"

- **Tagline:** "Agenda multichannel com IA anti-no-show. WhatsApp incluso."
- **Os 3 pontos que vendem:**
  1. **WhatsApp Business API oficial incluído** em todos os tiers (concorrentes usam workaround não-oficial e arriscam ban)
  2. **Anti-no-show IA real** — não é regra de "mandar 24h antes"; é modelo que prediz no-show e oferece remarcação automática (Clínica+)
  3. **Encaixe online em 1 clique** — secretária encaixa consulta tele do PlexCare Rooms sem trocar de sistema, sem pagar Zoom à parte
- **Anti-mensagem:** não competir com Doctoralia em "achar paciente" (marketplace) — somos a agenda **interna** da clínica.

#### Suite — "Sala + Agenda, sem trade-off"

- **Tagline:** "Sua plataforma clínica completa, sem prontuário monolítico."
- **Os 3 pontos que vendem:**
  1. **15% off no anuário** — economia direta no day-1
  2. **Painel unificado de uso** (uma fatura, um dashboard, um suporte)
  3. **Roadmap de pool compartilhado de minutos** (em V2) — sinaliza investimento contínuo
- **Anti-mensagem:** não posicionar Suite como "tudo-em-um" tipo Communicare. Posicionar como "os dois melhores módulos juntos, sob seus termos".

### Posicionamento competitivo (one-liner por concorrente)

| Concorrente | Como nos posicionamos |
|---|---|
| **Conexa Saúde** | "Conexa é só sala. Quando você precisar de agenda, vai ter que comprar outro software. PlexCare cresce com você." |
| **Doctoralia** | "Doctoralia é marketplace de paciente novo; PlexCare é a agenda interna que organiza paciente fiel." |
| **iClinic / Feegow** | "iClinic é ótimo de prontuário, mas a sala virtual deles é redirect pro Zoom. PlexCare integra com iClinic e entrega sala própria CFM-compliant." |
| **Communicare** | "Communicare exige você jogar fora o que você já usa. PlexCare entra ao lado do seu prontuário." |
| **Zoom for Healthcare** | "Zoom é genérico; não tem gravação CFM, não tem branding, não tem multi-tenant pra clínica gerenciar médicos." |
| **Twilio Video** | "Twilio é API-only — você ainda precisa contratar dev pra construir sala. PlexCare é app pronto + API pra quando quiser estender." |

---

## 5. Estratégia de canal por fase

### Channel mix evolutivo

```
M0 ─────────── M3 ─────────── M6 ─────────── M9 ─────────── M12 ────────── M16
Beta fechado   GA Rooms       GA Schedule    GA Suite       Expansion      Pós-GA escala
─────────────  ─────────────  ─────────────  ─────────────  ─────────────  ─────────────
Field-led      PLG dominant   PLG + Content  PLG + Sales    Sales-led      PLG + Sales-led
(design        (paid + SEO    (LinkedIn ads  (Enterprise    growth         + Channels
partners)      + comunidade)  + sociedades)  outbound)      (parcerias)    (sociedades)
```

### Detalhe por canal

#### A) Product-Led Growth (PLG) — Rooms Solo / Schedule Solo / Suite Solo

- **Site institucional** (`site/`): página `/precos` com calculator dinâmico, landing por especialidade (`/psiquiatria`, `/endocrino`, `/nutricao`), comparativo vs Conexa/Doctoralia
- **SEO orgânico** (M2–M16): conteúdo focado em pain-keywords: "sala virtual CFM 2.314", "agenda WhatsApp clínica", "como evitar no-show consulta médica", "API telemedicina Brasil". Meta: 30 artigos pillar até M9, 80 até M16
- **Trial 14d** (decisão D-4 de Pricing) self-service, sem cartão exigido
- **In-app activation tour** + e-mails sequenciais (até trial expirar)
- **Quem é o owner:** `fullstack-engineer` constrói; growth/founder cria conteúdo

#### B) Sales-led — Suite Clínica / Suite Enterprise / Rede

- **BDR + AE assistido por playbook** (M5+ Schedule, M8+ Suite). 1 BDR full-time até M9; 1 BDR + 1 AE M10+
- **ICP outbound list:** clínica 4–15 médicos via Apollo/RD Station + LinkedIn Sales Navigator. Filtros: localização (capital), especialidade (G-7), tamanho time, software atual
- **Demo customizada** (60 min) com sandbox espelho do tenant prospect
- **POC pago R$ 1–3k retornável** (mensionado em Pricing §7 Estágio 5)
- **Contrato anual com faturamento mensal** + TCO breakdown
- **Quem é o owner:** founder M0–M9; BDR contratado M5; AE contratado M9

#### C) Conteúdo + Comunidade — Top-of-funnel barato

- **Blog institucional** (`site/blog`) — 2 artigos/semana M3+ (alvo: rankear top-3 nas 10 keywords primárias)
- **YouTube** demos curtas (5–10 min): "PlexCare em 3 minutos", "Configurando agenda para clínica de psiquiatria", "Como gravar consulta CFM-compliant"
- **LinkedIn pessoal do founder** — posts 3x/semana: storytelling de jornada + casos de cliente + análise de mercado
- **Comunidade de médicos** (Discord ou Circle): early adopters compartilhando uso, founder responde dúvidas
- **Quem é o owner:** founder + creator part-time (M6+)

#### D) Parcerias estratégicas — G-8

- **Sociedades médicas:**
  - SBP (Pediatria) — começar conversação M0
  - SBEM (Endocrino/Metabolismo) — começar conversação M1
  - SBC (Cardiologia) — começar M3
  - SBD (Dermato) — começar M5
  - ABP (Psiquiatria) — começar M0 (especialidade hero)
- **Patrocínio de evento médico** (M6+): 1 evento grande por trimestre. Ex.: Congresso ABP, Congresso SBP, Hospitalar São Paulo
- **Incubadoras de healthtech:**
  - Eretz.bio (Albert Einstein) — aplicar M2
  - InovaHC (FMUSP) — aplicar M3
- **Convênios médicos (secundário, alta complexidade):**
  - Amil/Hapvida — abrir conversação M9+ (exige integração HL7 sólida; entra em V2)

#### E) Indicação / Referral (M6+)

- **Founders Program** (G-4): primeiros 50 tenants têm bônus por indicar — 1 mês grátis por tenant indicado que vira pago
- **Programa de embaixador** (M9+): médico com 3+ indicações vira "PlexCare Champion" — recebe convite para advisory board + créditos
- **NPS-driven referral** (M9+): após cliente atingir NPS ≥ 9, prompt automático "indique um colega"

#### F) Account-Based Marketing (ABM) — Rede / Enterprise (M10+)

- Lista curada de 50 redes alvo (Dr. Consulta, OdontoCompany, Amor Saúde, BP, NotreDame Saúde unidades regionais, etc.)
- Outreach personalizado por LinkedIn + InMail + Direct Mail físico (livro + carta)
- Eventos privados (jantar com 8 prospects)

---

## 6. Roadmap detalhado mês-a-mês (M0 → M16)

> Datas absolutas: M0 = **Julho 2026**, M16 = **Outubro 2027**. Marcos GA: Rooms (M3 = Out/2026), Schedule (M6 = Jan/2027), Suite (M9 = Abr/2027).

### Fase I — Pre-GA Rooms (M0–M2 / Jul–Set 2026): Beta fechado

**Objetivo:** validar metering+billing fix, fechar 10 design partners de Rooms, calibrar onboarding.

| Sprint | Marco produto | Marco GTM |
|---|---|---|
| **M0 (Jul/26)** | Fix `participant_sessions` + `devtenant` substituído (P0) | Lista de 30 candidatos a design partner via rede founder. Conversações com SBP e ABP iniciadas |
| **M1 (Ago/26)** | Plan data model live; Stripe sandbox integrado | 10 design partners assinados (NDA + acordo de feedback). Founders Program (G-4) anunciado privado |
| **M2 (Set/26)** | Página `/precos` no site live; checkout self-service em sandbox | Beta Rooms aberto para os 10. SLA primeira semana: NPS ≥ 8 OU iteração imediata |

**Métricas de saída M2:**
- 10/10 design partners ativos (1ª sala criada e gravada com sucesso)
- 0 incidentes de billing
- NPS Beta ≥ 8
- 5 testimonials gravados (vídeo 60s para landing page)

### Fase II — GA Rooms (M3–M5 / Out–Dez 2026): PLG + Founders Program

**Objetivo:** primeiro MRR sustentável; validar funil PLG sem sales humano.

| Sprint | Marco produto | Marco GTM |
|---|---|---|
| **M3 (Out/26)** | GA Rooms público; landing por especialidade live (Psiquiatria, Endocrino, Nutrição); blog com 8 artigos pillar | Lançamento PR: ProductHunt (categoria SaaS Healthcare), LinkedIn founder, comunidades médicas. Founders Program aberto público (limite 50). 1 evento de patrocínio: Congresso ABP |
| **M4 (Nov/26)** | Schedule MVP em alpha interno; refinamento de onboarding Rooms baseado em data dos primeiros 30 tenants | Paid ads ramp-up: R$ 30k/mês LinkedIn + Google. SDR em onboarding (contratado fim M3) |
| **M5 (Dez/26)** | Schedule beta fechado para 10 design partners (clínicas selecionadas dos próprios Rooms clients ou indicações SBP) | Conversação SBEM avança; conteúdo "case study Dra. Mariana" publicado. SDR roda 50 reuniões/mês com clínicas |

**Métricas de saída M5:**
- **80 tenants pagos Rooms** (40 Solo + 35 Clínica + 5 Enterprise)
- **MRR R$ 38k**
- Trial → paid: **≥ 32%**
- 10 design partners Schedule ativos
- 5 artigos rankeando top-10 nas keywords primárias

### Fase III — GA Schedule + Founders Program 2 (M6–M8 / Jan–Mar 2027)

**Objetivo:** validar Schedule + cross-sell para base Rooms; preparar Suite GA.

| Sprint | Marco produto | Marco GTM |
|---|---|---|
| **M6 (Jan/27)** | **GA Schedule público.** Encaixe online Schedule→Rooms (pay-per-minute) live | Lançamento Schedule: PR + LinkedIn + e-mail para base Rooms ("agora você tem agenda"). Founders Program 2 reaberto para Schedule (limite 50). Patrocínio Hospitalar São Paulo |
| **M7 (Fev/27)** | Suite alpha interno + Suite billing agregador | Cross-sell para base Rooms: in-app banner "+ Schedule por R$ 79/médico". Meta: 20% upgrade Rooms→Suite-style (Rooms+Schedule juntos). BDR escala — 80 reuniões/mês |
| **M8 (Mar/27)** | Suite beta com 10 clientes que já têm os dois | Suite beta program. Conteúdo "comparativo Communicare vs PlexCare componível" (sem cita nome no SEO; cita em sales material) |

**Métricas de saída M8:**
- **180 tenants pagos** total (110 Rooms + 50 Schedule + 20 que têm os dois)
- **MRR R$ 110k**
- Schedule trial → paid: **≥ 28%** (mais B2B = ciclo maior)
- **Cross-sell rate Rooms→Schedule: ≥ 18%** após 90 dias
- 10 testimonials Schedule
- SDR booking rate ≥ 25% (reunião → POC)

### Fase IV — GA Suite + Sales-led ramp (M9–M11 / Abr–Jun 2027)

**Objetivo:** validar Suite como SKU campeão; abrir motion sales-led para Enterprise; bater R$ 220k MRR.

| Sprint | Marco produto | Marco GTM |
|---|---|---|
| **M9 (Abr/27)** | **GA Suite público.** AE contratado | Lançamento Suite: PR coordenado + evento online "PlexCare Day" (300+ médicos inscritos via base) + Founders Program 3 reaberto. AE inicia outbound Enterprise (50 contas-alvo) |
| **M10 (Mai/27)** | API pública v1 documentada (CSAT booster para Enterprise); white-label config | Patrocínio Congresso SBP; presença em SBEM. ABM Rede iniciado (5 prospects-alvo) |
| **M11 (Jun/27)** | Anti-no-show IA v2 com retraining em dados reais (CSAT + diferenciação Schedule) | 1ª POC Enterprise (R$ 3k retornável) com Rede de Clínicas 5 unidades. Comunidade Discord lançada com 500 membros |

**Métricas de saída M11 (≈ G-9 alvo M9):**
- **350 tenants pagos**
- **MRR R$ 220k**
- **Suite attach rate ≥ 35%** (de tenants com ≥ 2 SKUs, 35% migram pra Suite)
- **NRR ≥ 105%** (overage + upgrades)
- 3 contratos Enterprise em pipeline late-stage
- Cobertura de keywords: top-3 em 12 keywords primárias

### Fase V — Pós-GA escala (M12–M16 / Jul–Out 2027)

**Objetivo:** prova de eficiência de capital; pipeline Enterprise saudável; sinal Série A.

| Sprint | Marco produto | Marco GTM |
|---|---|---|
| **M12 (Jul/27)** | Pool compartilhado Suite V2 (deferida em ADR-0009) released | Anúncio público pool Suite: e-mail Suite base + LinkedIn. Eventos Q3 |
| **M13 (Ago/27)** | Setor Público tier overage-only (Pricing §12) | Conversação SUS estadual (PR de estado capital com governo amigo). Não bloqueia receita; valida funil |
| **M14 (Set/27)** | Integração HL7/FHIR Enterprise (custom por contrato) | 2 contratos Rede fechados (8–25 unidades) → adicionam R$ 80–120k MRR. AE+ contratado |
| **M15 (Out/27)** | Operadora de plano de saúde tier (per-vidas) em alpha | Apresentação Amil/Hapvida via parceria PSC ou via consultoria especializada. Ciclo 12m+ |
| **M16 (Out/27)** | Roadmap V3 público (prontuário SOAP MVP gated por MRR Suite ≥ R$ 200k atingido em M14) | Métricas Série A: produto V2 estável, NRR ≥ 115%, payback ≤ 4 meses. Preparação de fundraising |

**Métricas de saída M16 (≈ G-10 alvo):**
- **1.200 tenants pagos**
- **MRR R$ 850k** (ARR R$ 10,2M)
- **NRR ≥ 115%**
- **CAC payback ≤ 4 meses** (média ponderada)
- **Suite attach rate ≥ 50%**
- 8 contratos Rede ativos
- **Pipeline Enterprise R$ 1,2M MRR potencial** em estágios avançados
- Cobertura SEO: top-3 em 30+ keywords primárias

---

## 7. Beta program & Design partners

### Founders Program (G-4)

**Termos:**
- **Quem se qualifica:** primeiros 50 tenants que assinarem anual em cada SKU (Rooms / Schedule / Suite separados — 50 + 50 + 50, máx 150 totais)
- **Benefícios:**
  - 50% off em assinatura anual nos primeiros **12 meses**
  - Acesso prioritário a roadmap (vota nas próximas 3 features)
  - Slot mensal de 30 min com fundador
  - Logo na página `/clientes` (opt-in)
  - "PlexCare Champion" badge (M9+)
- **Compromisso de contrapartida:**
  - 1 case-study escrito ou vídeo
  - 2 indicações qualificadas em 6 meses
  - Feedback estruturado mensal (form 10 perguntas)

### Critérios de seleção dos 10 design partners por SKU

**Rooms (M0–M2):**
- 1 psiquiatra solo (Psiquiatria)
- 1 endocrino solo (SBEM lead)
- 1 nutricionista solo (volume alto de tele)
- 1 cardiologista solo
- 1 dermato solo
- 2 clínicas pequenas (4–8 médicos) — 1 multispecialty + 1 saúde mental
- 1 grupo médico (8–15 médicos)
- 2 vagas reservadas para indicação de parceiro estratégico (SBP, ABP)

**Schedule (M5–M6):**
- 3 da própria base Rooms (cross-sell teste)
- 5 clínicas indicadas por SBP / SBEM
- 2 grupos que já usam Doctoralia (teste de troca)

**Suite (M8–M9):**
- 8 da base Rooms+Schedule que já têm os dois SKUs ativos
- 2 outbound novo (clínica greenfield 6–10 médicos)

### Selection score (rubrica)

| Critério | Peso | Como avaliar |
|---|---|---|
| ICP fit (especialidade × tamanho × geografia) | 30% | Score 0–10 baseado em §3 |
| Disponibilidade pra feedback (entrevistas, formulário) | 25% | Reunião de discovery confirma |
| Influência (sociedade médica, KOL, lista de seguidores) | 20% | LinkedIn + indicação |
| Atitude (pioneer mindset, não exige produto 100% pronto) | 15% | Reunião de discovery |
| Diversidade do pool (não 10 psiquiatras) | 10% | Compor por SKU |

---

## 8. Pricing rollout e ofertas de lançamento

### Cadência de preço

| Mês | Preço list | Oferta ativa | Tickets máximos |
|---|---|---|---|
| M0–M2 | (não-público; só design partners) | Beta gratuito | 30 (10 por SKU × ... só Rooms ativo M2) |
| M3 | Lista oficial Rooms publicada | Founders Program Rooms 50% off anual | 50 Rooms |
| M6 | Lista oficial Schedule publicada | Founders Program Schedule 50% off anual + cross-sell para base Rooms (1º mês de Schedule grátis) | 50 Schedule |
| M9 | Lista oficial Suite publicada | Founders Program Suite 50% off anual + bônus pool compartilhado promessa para M12 | 50 Suite |
| M10+ | Lista oficial estável | Lifetime referral (1 mês grátis por indicação que vira paid) | — |
| M13+ | Tier "Setor Público" overage-only mínimo R$ 5k/mês | Conversação direta, sem oferta pública | — |

### Calculator de preço na página /precos

Inputs:
- Médicos ativos (1–50)
- Consultas/mês (0–500)
- % de consultas online (0–100%)
- Lembretes WhatsApp/mês (estimar)

Output: SKU recomendado + preço mensal/anual + "Economia anual" se Suite + breakdown de overage potencial.

> Implementação: `fullstack-engineer` constrói no site/ usando API leve do plan-catalog (cached). Tracking obrigatório de cada cálculo → input para Etapa 4.

### Negociação Sales-led — política de desconto

| SKU | Desconto máx self-service AE | Aprovação founder necessária acima de |
|---|---|---|
| Rooms Clínica anual | 10% | 15% |
| Schedule Clínica anual | 10% | 15% |
| Suite Clínica anual | 10% (sobre os 15% já dado) | 25% total |
| Enterprise (qualquer SKU) | 18% | 25% |
| Multi-year (24m+) | 12% adicional | 20% adicional |

> AE NÃO pode negociar overage rate — sempre tabela fixa (Pricing §3, §4).

---

## 9. Métricas de sucesso por fase (KPI tree)

### Funil PLG (M3+)

```
Visitor (site/landing)
  → Trial signup     [meta: 8% conversion]
    → Activated      [meta: 70% — criou 1 sala/agendou 1 consulta]
      → Paid         [meta: 35% — Rooms; 28% — Schedule]
        → Activated paid  [meta: 90% no D7]
          → Expanded (overage OR upgrade)  [meta: 40% em 6m]
            → Cross-sell (segundo SKU)  [meta: 18% em 90d M6+]
              → Suite migration  [meta: 35% em 12m M9+]
```

### Dashboard executivo (atualização semanal)

**Acquisition**
- Visitantes únicos site `/precos` e landings
- Trials iniciados (por SKU)
- Cost per trial (paid channels)
- Tráfego orgânico SEO (sessões + posição média)

**Activation**
- Activation rate (D1, D7, D14)
- Time-to-value (até 1ª sala criada / 1º agendamento confirmado)
- Trial → paid conversion (por SKU)

**Revenue**
- MRR (total + por SKU)
- ARR
- Net new MRR (adições - churn)
- NRR
- ARPU por SKU

**Retention**
- Logo churn mensal (alvo: ≤ 4% self-service, ≤ 1,5% sales-led)
- Revenue churn (≤ 3,5%)
- NPS (>= 50 alvo self-service; >= 65 sales-led)

**Sales (M5+)**
- Pipeline em $$ por estágio
- Conversion BDR → AE → Closed Won
- CAC blended (sales+marketing custo / new customers)
- CAC payback

**Cross-sell / Expansion**
- Attach rate Suite
- Encaixe online minutes (Schedule-puro → Rooms pay-per-minute)
- Overage % do MRR
- % de tenants em upgrade tier (Solo → Clínica → Enterprise)

**Health (input para Etapa 4 — Tracking)**
- Daily Active Tenants
- Salas criadas/dia
- Lembretes WhatsApp enviados/dia
- Quality rating WhatsApp BR
- Incidentes de billing (Stripe webhook failures, Iugu rejections)

### Targets por marco (consolidado)

| Marco | MRR | Tenants pagos | NRR | Suite Attach | CAC Payback |
|---|---|---|---|---|---|
| M5 (Fim Fase II) | R$ 38k | 80 | — | — | ≤ 5m |
| M8 (Fim Fase III) | R$ 110k | 180 | ≥ 100% | — | ≤ 5m |
| M11 (Fim Fase IV) | R$ 220k | 350 | ≥ 105% | ≥ 35% | ≤ 4,5m |
| M16 (Fim Fase V) | R$ 850k | 1.200 | ≥ 115% | ≥ 50% | ≤ 4m |

---

## 10. Materiais de marketing por estágio

### Sales / Marketing collateral checklist

| Asset | M3 (GA Rooms) | M6 (GA Schedule) | M9 (GA Suite) | M16 (V2) |
|---|---|---|---|---|
| Landing principal `/precos` | ✅ | atualizado | atualizado | atualizado |
| Landing por especialidade (5) | ✅ | + 3 novas | + 2 novas | continua |
| Comparativo PlexCare vs Conexa | ✅ | — | — | — |
| Comparativo PlexCare vs Doctoralia | — | ✅ | — | — |
| Comparativo PlexCare vs iClinic | — | — | ✅ | — |
| Sales deck (Sales-led 30 slides) | — | rascunho | finalizado | atualizado |
| Demo video PlexCare em 3 minutos | ✅ | atualizado | atualizado | atualizado |
| Case studies (vídeo + texto) | 5 | + 5 | + 5 | + 10 |
| White paper "Telemedicina CFM-compliant: o guia técnico" | ✅ | — | — | — |
| White paper "Anti-no-show com IA: o guia para clínicas" | — | ✅ | — | — |
| Webinar mensal (M3+) | 1 | 3 (Q1) | 3 (Q2) | 6 |
| Newsletter mensal | 1 | 4 | 7 | 16 |
| Documentação pública API | — | rascunho | v1 publicado | v1.x atualizado |
| Documentação developer hub | — | — | ✅ | atualizado |

### Calendário editorial — blog (M3 alvo: 8 artigos pillar GA)

1. "Sala virtual CFM-compliant: o que você precisa em 2026" (SEO hero)
2. "Como gravar consulta médica respeitando CFM 2.314 e LGPD"
3. "Anti-no-show em clínicas: do template manual à IA preditiva"
4. "WhatsApp Business API para clínica: por que oficial é a única opção"
5. "Multi-tenant em saúde: o que rede de clínicas precisa olhar"
6. "Encaixe online: como agendar consulta tele em 1 clique"
7. "Comparativo: PlexCare Rooms vs Conexa Saúde"
8. "Guia completo: API de telemedicina para integrar ao seu prontuário"

### Cadência paid ads M3+

| Canal | Budget mês 1 | Budget mês 6 | Foco |
|---|---|---|---|
| Google Ads (search) | R$ 12k | R$ 35k | Keywords intent-high: "sala virtual médica preço", "agenda clinica whatsapp", "alternativa zoom telemedicina" |
| LinkedIn Ads | R$ 10k | R$ 30k | Médicos + administradores de clínica; especialidades-alvo G-7 |
| Meta (Facebook + Instagram) | R$ 3k | R$ 15k | Lookalike de clientes pagos; retargeting visitors `/precos` |
| YouTube ads | R$ 2k | R$ 10k | Pre-roll em canais de saúde |
| **Total mensal** | **R$ 27k** | **R$ 90k** | CAC blended alvo ≤ R$ 500 (Solo) / ≤ R$ 3.500 (Clínica) |

---

## 11. Sales Playbook (M5+)

### Estrutura de time

| Mês | Founder/CEO | BDR | AE | CSM |
|---|---|---|---|---|
| M0–M4 | 100% sales (50 reuniões/mês) | — | — | — |
| M5–M8 | 60% sales (assist closes) | 1 (50 reuniões/mês outbound) | — | founder ocasional |
| M9–M11 | 30% sales (Enterprise only) | 1 | 1 (gerencia pipeline Clínica) | 1 (50 contas top) |
| M12–M16 | 15% sales (deals estratégicos) | 2 | 2 (Clínica + Enterprise) | 2 |

### Sales process

```
Lead (inbound / outbound)
  → BDR qualification call (15min)
    → AE Discovery call (45min) ←─ MEDDPICC framework
      → Demo customizada (60min)
        → POC pago R$ 1–3k (Enterprise only)
          → Proposta + negociação
            → Closed Won / Closed Lost
              → CSM handoff (onboarding)
```

### MEDDPICC mínimo no Discovery

- **M**etrics — quanto vale para o cliente? (ex.: reduzir no-show de 25% → 15% = R$ X/mês)
- **E**conomic Buyer — quem assina? Sócio-médico ou administrador
- **D**ecision Criteria — checklist do que ele precisa ver
- **D**ecision Process — quantas pessoas e quanto tempo
- **P**aper Process — contrato, compliance, RFP?
- **I**dentify Pain — dor real (não wish-list)
- **C**hampion — quem dentro da org vai vender por nós
- **C**ompetition — está olhando Conexa? Communicare? iClinic?

### Objection handling (top 5)

| Objeção | Resposta |
|---|---|
| "Já uso Zoom for healthcare" | "Zoom é genérico; não tem gravação CFM, branding ou multi-tenant. Você vai precisar contratar advogado se receber pedido de auditoria. Quanto custa esse risco?" |
| "Vou esperar Communicare ter API" | "Communicare é arquitetura monolítica single-tenant; API real exige reescrita. Em 12 meses você ainda estará esperando. PlexCare já tem API hoje." |
| "É caro pra clínica pequena" | "Solo é R$ 79/médico/mês. Calcula 1 paciente recuperado de no-show (R$ 250) — paga 3 meses. ROI é o argumento, não preço." |
| "E se eu quiser sair?" | "Dados são seus, exportáveis via CSV. Sem amarração contratual fora do anual. Mas vamos focar em por que você sairia — onde está o risco que vê?" |
| "Quero falar com cliente atual" | "Posso conectar você com [Case-study X] que é especialidade similar. Esses 10 min de conversa são o teste mais sincero que existe." |

---

## 12. Parcerias estratégicas — playbook (G-8)

### Sociedades médicas

**Sequência de approach:**
1. **ABP (Psiquiatria)** — M0: founder vai a evento mensal, conhece presidente. M2: propõe webinar "Tele-psiquiatria CFM-compliant" co-marca. M3: anúncio parceria + benefício para sócios (15% off Rooms).
2. **SBP (Pediatria)** — M0: contato via membro do board (rede founder). M3: patrocínio Congresso SBP (M10).
3. **SBEM (Endocrinologia)** — M1: webinar co-criado com KOL. M6: parceria oficial.
4. **SBC (Cardiologia)** — M3: contato via comitê de telemedicina. M9: patrocínio congresso (M14 ou M15).
5. **SBD (Dermatologia)** — M5: contato. M12: avaliar parceria.

**Modelo de parceria:**
- 15% off Rooms/Schedule para sócios da entidade
- 5% de receita gerada via cupom volta como apoio à pesquisa/educação
- Co-branding em material educacional
- Acesso preferencial a roadmap (1 voz por sociedade no quarterly review)

### Incubadoras / Aceleradoras

| Parceiro | Approach | Marco |
|---|---|---|
| Eretz.bio (Albert Einstein) | Aplicação programa M2 | Selected M4–M9 (6 meses) — acesso a hospital, mentoria |
| InovaHC (FMUSP) | Aplicação M3 | Selected M5–M11 |
| Distrito Healthtech | Visibility (events) | M3+ |
| Cubo Itaú Healthtech | Networking | M6+ |

### Convênios médicos (entrada cautelosa — V2)

- **NÃO no escopo M0–M9** (exige integração HL7/FHIR e SLA 99,95%+)
- M9+: avaliação técnica de Amil/Hapvida API spec
- M12+: POC com 1 operadora regional (ex.: Unimed Curitiba)
- M16+: piloto Amil ou Hapvida (R$ 100k+ MRR potencial por contrato)

### Hospitais privados (entrada V2)

- BP (Beneficência Portuguesa), Sírio-Libanês, Albert Einstein, Hospital Alemão Oswaldo Cruz — relação via Eretz.bio
- Modelo: licenciamento white-label + per-vidas atendidas
- M12+: 1 POC; M16+: 1 contrato fechado (ponto de inflexão para Série A)

---

## 13. Riscos do GTM e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Metering fix atrasa além de M1** → bloqueia tudo de billing Rooms | Média | Alto (slip GA 1–2 meses) | Founder pessoalmente alocado no fix; Etapa 2 ADR-0006 definiu approach claro. PR review semanal |
| **Schedule MVP escorrega Q4/26 → Q1/27** | Alta | Médio (slip Schedule GA 1–2 meses; não afeta Rooms) | Plan B: lançar Suite com Schedule beta-limited M9 e GA Schedule independente M10 |
| **Founders Program esgota antes de M3 com perfil errado** (gente que não vira case-study) | Média | Médio (compromete provas sociais) | Selection rubric rígido (§7); rejeitar quem não fit; rolar lista de espera |
| **CAC paid sobe acima de R$ 700 (Solo) ou R$ 5k (Clínica)** | Média | Alto (payback explode) | Cap mensal de paid ads; se CAC > 130% do alvo por 2 meses, reduzir spend e dobrar conteúdo orgânico |
| **Conexa anuncia agenda nativa antes de GA Schedule** | Média | Alto (perde diferenciação) | Acelerar lançamento Schedule via beta paid se necessário (Schedule beta paid M5); reforçar diferenciação WhatsApp + IA no-show |
| **Communicare lança API ou multi-tenant** | Baixa | Médio (perde diferenciação) | Não credível em 16m (arquitetura legada); manter monitoramento PRs e LinkedIn |
| **WhatsApp Business API rebaixa quality rating PlexCare** → Schedule fica sem mensageria | Média | Alto | Estratégia de templates aprovados + opt-in claro + monitoramento ratio block/complaint diário. Plano B: SMS fallback (degraded UX) |
| **Sociedade médica rejeita parceria** | Média | Baixo (não bloqueia, só perde alavanca) | Sequência paralela com 3+ sociedades; se uma rejeita, próxima |
| **Design partner gira reviews negativas públicas** | Baixa | Alto (PR ruim) | Selection rubric pega atitude; contrato Founders inclui "feedback structured" antes de público; SLA primeira semana NPS ≥ 8 |
| **Sales-led não fecha primeira Enterprise até M12** | Média | Alto (alvo M16 não-bate) | Plano B: focar 100% em Clínica self-service até M13; AE ramp-up a partir do M14; ajusta target Enterprise M16 para "pipeline cheio" não "fechado" |
| **Investidor Série Seed/A não materializa** | Baixa | Médio (ritmo pós-M11 reduz) | Bootstrap-compatible: GTM 16m é desenhado pra fechar break-even M14 mesmo sem captação extra |
| **Compliance LGPD/CFM exige re-arquitetura** | Baixa | Alto | Solutions Architect monitora ANPD + CFM; ADR-0009 + ADR-0008 já antecipam isolamento |
| **Cliente Enterprise exige white-label completo (UI/domínio) antes de M10** | Média | Médio | Roadmap white-label adiantado pra M9 (já planejado); negociar deadline com cliente |
| **Comunicação confusa "plataforma componível"** — cliente não entende e prefere monolítico | Média | Médio | Página `/precos` calculator deve mostrar cenários claros; case-studies abrem com "minha clínica já tinha prontuário e..." |

---

## 14. Budget GTM 16 meses (estimativa)

> Estimativa para informar planejamento financeiro. Não-aprovado — depende de captação ou orgânico de receita.

| Categoria | M0–M5 (6m) | M6–M11 (6m) | M12–M16 (5m) | Total 16m |
|---|---|---|---|---|
| Paid ads (Google + LinkedIn + Meta + YT) | R$ 60k | R$ 360k | R$ 500k | **R$ 920k** |
| Conteúdo (creator + redator + SEO tools) | R$ 40k | R$ 70k | R$ 80k | **R$ 190k** |
| Patrocínio de eventos | R$ 30k | R$ 120k | R$ 150k | **R$ 300k** |
| Tooling sales (Apollo + Sales Nav + HubSpot) | R$ 8k | R$ 25k | R$ 35k | **R$ 68k** |
| Salários (BDR M5+, AE M9+, CSM M9+) | R$ 0 | R$ 220k | R$ 480k | **R$ 700k** |
| Founders Program desconto (recovery) | R$ 35k | R$ 80k | — | **R$ 115k** |
| Documentação API + developer hub | — | R$ 25k | R$ 15k | **R$ 40k** |
| Misc (PR boutique, design contractor) | R$ 15k | R$ 40k | R$ 60k | **R$ 115k** |
| **Total** | **R$ 188k** | **R$ 940k** | **R$ 1.320k** | **R$ 2,45M** |

### Receita acumulada projetada (cenário base)

| Marco | MRR | ARR (run-rate) | Receita acumulada 16m |
|---|---|---|---|
| M5 | R$ 38k | R$ 456k | R$ 92k |
| M8 | R$ 110k | R$ 1,3M | R$ 314k |
| M11 | R$ 220k | R$ 2,6M | R$ 760k |
| M16 | R$ 850k | R$ 10,2M | R$ 3,4M |

**Break-even GTM 16m:** ≈ M13 (Receita acumulada > GTM spend acumulada). Margem para captar antes de queimar pista.

---

## 15. O que precisa estar pronto para a Etapa 4 (instrumentação)

A Etapa 4 (`/analytics-tracking`) precisa instrumentar:

1. **Funil PLG end-to-end** — visitor → trial → activated → paid → expanded → cross-sell → suite (eventos em §9)
2. **Atribuição multi-touch** — qual canal trouxe o tenant? Self-reported source + UTM + LinkedIn Insight Tag + Google Click ID
3. **Metering Rooms + Schedule** — já está no escopo do ADR-0006 (produto); analytics consome via outbox event `usage.recorded`
4. **Billing events** — `subscription.created`, `invoice.generated`, `payment.succeeded`, `payment.failed`, `subscription.canceled` — todos via outbox + Stripe webhooks
5. **Cross-sell triggers** (Pricing §7) — 200 min encaixe online em 3 meses; Rooms Solo overage 2 meses; tenant ≥ 8 médicos — todos métricas derivadas do metering
6. **NPS surveys automatizadas** (CSAT trigger pós-onboarding D14, NPS trimestral)
7. **Dashboard executivo** — MRR/ARR/NRR/churn por SKU; CAC por canal; LTV blended; pipeline sales-led
8. **LGPD compliance** — consentimento antes de evento sair do tenant; anonimização para reports agregados; audit log de cada evento de billing
9. **Healthcheck de canais** — quality rating WhatsApp; SEO position tracker; paid ROAS por campanha
10. **Tracking de Founders Program** — cupom resgatado, indicações geradas, status case-study

> Etapa 4 produz `tasks/monetize-4-tracking.md` com plano de eventos detalhado, schema de dados e Mermaid de fluxo, mais review LGPD.

---

## 16. Checkpoint

**Decisões aprovadas (todas — 2026-06-07):**

- ✅ **G-1** ICP primário Solo → Clínica → Rede
- ✅ **G-2** Channel mix por fase (PLG → híbrido → sales-led)
- ✅ **G-3** Posicionamento "plataforma componível"
- ✅ **G-4** Founders Program (50% off anual × 12m, limite 50 por SKU, 150 totais)
- ✅ **G-5** Sequência Rooms → Schedule → Suite
- ✅ **G-6** Capitais BR primeiro
- ✅ **G-7** Especialidades-alvo (Psiquiatria, Endocrino, Nutrição, Dermato, Cardio wave 1; Pedia/Gineco wave 2)
- ✅ **G-8** Parcerias (ABP, SBP, SBEM como wave 1; SBC, SBD wave 2; convênios M9+)
- ✅ **G-9** Métricas M9: MRR R$ 220k + 350 tenants + Suite attach ≥ 35% + NRR ≥ 105%
- ✅ **G-10** Métricas M16: MRR R$ 850k + 1.200 tenants + NRR ≥ 115% + CAC payback ≤ 4m
- ✅ **G-11** Adiar Setor Público + Operadoras para M13+

> Fase 3 fechada. Próxima etapa: instrumentação (`/analytics-tracking`).

**Decisões adiadas (entram em V2 — pós M16, ou pipeline própria):**

- Tier per-vidas para operadora (modelo de risco específico)
- Tier overage-only para Setor Público / SUS
- Pricing USD/EUR para expansão internacional
- Reentrada de Laudo Digital, IA Saúde, Distribuição Jurídica como add-ons cross-sell

---

## Anexos

### A. Referências cruzadas

- Modelo de pricing (Etapa 1): [`tasks/monetize-1-pricing.md`](monetize-1-pricing.md)
- ADRs (Etapa 2):
  - [ADR-0006 — Metering Rooms/Schedule](../docs/adr/0006-metering-rooms-schedule.md)
  - [ADR-0007 — Encaixe online cross-produto](../docs/adr/0007-encaixe-online-cross-produto.md)
  - [ADR-0008 — Plan data model](../docs/adr/0008-plan-data-model.md)
  - [ADR-0009 — Pool compartilhado Suite (V2)](../docs/adr/0009-pool-compartilhado-suite.md)
  - [ADR-0010 — Billing gateway Stripe + Iugu](../docs/adr/0010-billing-gateway-stripe-iugu.md)
- Compliance e stack: [`CLAUDE.md`](../CLAUDE.md)
- Memórias: `plexcare-product`, `plexcare-monetization-scope`, `plexcare-competitor-communicare`, `plexcare-adr-0008-plan-data-model`, `plexcare-metering-root-cause`, `plexcare-devtenant-security`

### B. Cronograma visual (Gantt simplificado)

```text
                M0  M1  M2  M3  M4  M5  M6  M7  M8  M9  M10 M11 M12 M13 M14 M15 M16
                Jul Ago Set Out Nov Dez Jan Fev Mar Abr Mai Jun Jul Ago Set Out Out
                26  26  26  26  26  26  27  27  27  27  27  27  27  27  27  27  27

Fix metering    ███████
DevTenant fix   ███████
Plan data mdl       ████████
Stripe+Iugu             ████
Rooms Beta              ████
Rooms GA                    ██████████████████████████████████████████████████████
Schedule MVP                ████████████████
Schedule Beta                       ████████
Schedule GA                                 ██████████████████████████████████████
Suite Beta                                          ████████████
Suite GA                                                    ██████████████████████
Sales-led ramp                              ████████████████████████████████████
Pool Suite V2                                                       ████████████
Setor Público                                                           ████████
Founders P. Rooms       ████████████████
Founders P. Sched               ████████████████
Founders P. Suite                           ████████████████
Patrocínio Eventos          ▓       ▓               ▓           ▓       ▓
Parceria ABP            ████
Parceria SBP                ████
Parceria SBEM                       ████
Parceria SBC                            ████
```

### C. Lista de 50 prospects-alvo Sales-led M9+ (placeholder — SDR popula)

> Estrutura para `pipeline.csv` mantida pelo BDR a partir de M5. Critérios: capital BR, 4–25 médicos, especialidade G-7, software atual identificado.

| # | Org | Região | Médicos | Software atual | Status pipeline |
|---|---|---|---|---|---|
| 1 | (placeholder Clínica BR1) | SP | 12 | iClinic | TBD |
| ... | ... | ... | ... | ... | ... |
| 50 | (placeholder Rede BR50) | SP+RJ | 32 | Communicare | TBD |

### D. Próxima sessão

```
/clear
/analytics-tracking — input: tasks/monetize-1-pricing.md + tasks/monetize-3-gtm.md
                    + ADR-0006 (metering)
                  → output: tasks/monetize-4-tracking.md
```

Foco da Etapa 4: instrumentar funil PLG, billing events, NRR/churn, atribuição multi-touch, com revisão LGPD obrigatória.
