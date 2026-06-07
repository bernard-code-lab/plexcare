# Discovery — Agente conversacional de IA no PlexCare Schedule

> Documento de discovery (pré-blueprint, pré-spec, pré-código). Clarifica problema, atores, sucesso, escopo e decisões pendentes. Inspirado em Leadster + investigação técnica do stack deles (2026-06-07), com construção interna como postura.
>
> **Contexto canônico:** [`tasks/monetize-1-pricing.md`](monetize-1-pricing.md) §4 (Schedule SKU), [`tasks/monetize-3-gtm.md`](monetize-3-gtm.md) §6 (cronograma Schedule GA M6), [`tasks/monetize-4-tracking.md`](monetize-4-tracking.md) §5.2 (tracking de uso), ADRs [0007](../docs/adr/0007-encaixe-online-cross-produto.md), [0008](../docs/adr/0008-plan-data-model.md), [0011](../docs/adr/0011-resolucao-tenant-runtime-teleconf.md), [0012](../docs/adr/0012-gateway-unico-asaas.md). Pesquisa Leadster registrada em 2026-06-07: ChatGPT + LangChain + RAG sobre FAQ Markdown; cliente conecta WhatsApp Business API próprio via BSP.

---

## 1. Resumo executivo (TL;DR)

| # | Achado / decisão proposta | Por quê |
|---|---|---|
| **A-1** | Feature alvo: **agente conversacional IA por tenant no canal WhatsApp Business API do PlexCare Schedule**. Não substitui consulta médica; libera tempo de secretária respondendo FAQ + (V2) faz triagem administrativa de agendamento | Schedule já tem WhatsApp + lembretes one-way. Gap real é resposta conversacional (60-70% das mensagens do dia são repetitivas) |
| **A-2** | **Construir interno, não integrar Leadster** | Stack Leadster (ChatGPT + LangChain + RAG sobre FAQ) é commodity técnica. Não há defensible IP. Build interno preserva controle de margem, compliance, abstração de provider |
| **A-3** | Modelo WhatsApp confirmado: **1 número por tenant**. Tenant conecta WhatsApp Business próprio via BSP (PlexCare como facilitador Meta tech provider). Mesmo modelo de Leadster, e é a única forma legal no Brasil hoje | Meta exige 1 WABA = 1 CNPJ verificado = 1 número dedicado |
| **A-4** | **Escopo MVP V1 = FAQ-only com handoff explícito**. Sem agendamento ativo, sem triagem clínica, sem opinião médica. Guardrails fortes desde o dia 1 | Reduz risco CFM/Anvisa em 90%; permite ship em ~6 semanas pós-Schedule GA |
| **A-5** | **Tier de entrada: Clínica+** (Solo não recebe). Custo LLM justifica preço de Clínica | Solo é margem comprimida; Schedule Clínica (R$ 159/médico) absorve R$ 3-15/tenant de LLM sem dor |
| **A-6** | Abstração `LLMProvider` desde dia 1 — Claude/OpenAI/Llama atrás de interface. **Provider escolhido em ADR-0013 (futuro)**, não neste discovery | Vendor lock-in é risco real; comparativa nos planos GTM Enterprise inevitavelmente vai pedir provider X |
| **A-7** | **Cronograma sugerido**: discovery (este doc) → ADR-0013 LLM provider → ADR-0014 vector store → blueprint → spec → MVP. Entrega-alvo: **M7-M8 GTM** (Fev-Mar/27, depois de Schedule GA em M6) | Feature define **um diferencial real do Schedule Clínica** vs concorrentes (Doctoralia, iClinic) |

> **Bloqueios para `/blueprint`:** as **6 decisões Q1-Q6** da §7 precisam ser confirmadas pelo stakeholder. Sem isso, blueprint vai ter trade-offs ambíguos.

---

## 2. Problema clarificado

### Dor concreta do tenant (clínica/médico)

Hoje, num tenant médio do Schedule Clínica (8 médicos, ~1.200 consultas/mês), o fluxo de mensagens recebidas pelo WhatsApp da clínica é aproximadamente:

| Categoria de mensagem | % do volume | Quem responde hoje | Tempo médio |
|---|---|---|---|
| **FAQ "operacional"**: horário, endereço, convênio aceito, valor consulta, especialidades disponíveis | 60-70% | Secretária digita manual | 1-3 min cada |
| **Agendamento**: "quero marcar com Dr. X dia Y" | 15-20% | Secretária consulta agenda + responde | 3-5 min |
| **Remarcação / cancelamento** | 5-10% | Secretária | 2-4 min |
| **Resultado de exame / pedido médico** (encaminhado pra médico) | 3-5% | Secretária roteia, médico responde | varia |
| **Urgência / dúvida clínica** | 1-3% | Sempre encaminhado pra médico | varia, crítico |
| **Outros** (cobrança, prontuário, etc) | 2-5% | Vário | varia |

Capacidade real de secretária: ~80-120 mensagens/dia atendidas com qualidade. Acima disso, paciente espera, desiste ou marca em concorrente.

### O que JÁ existe no Schedule e por que não basta

- **Lembretes WhatsApp** (Etapa 1 §4): one-way template Meta-aprovado ("Sua consulta com Dr. X é amanhã às 14h. Confirmar [Sim] [Remarcar]"). Não conversa.
- **Anti-no-show IA**: modelo prevê probabilidade de no-show e prioriza lembrete + remarcação proativa. Predição interna, sem interação.
- **Encaixe online** ([ADR-0007](../docs/adr/0007-encaixe-online-cross-produto.md)): clínica cria sala virtual e manda link. Não envolve diálogo com paciente.

O canal WhatsApp do tenant **recebe** mensagens (não só envia), mas hoje o PlexCare não orquestra **conversação inteligente** — secretária trata cada mensagem manualmente.

### Gap mensurável

Tomando o tenant médio acima:

- Volume WhatsApp entrante: ~50-80 mensagens/dia
- Tempo secretária respondendo FAQ: **~3 horas/dia** (60% × 60 msg × 3min)
- Custo: 3h × R$ 25/h × 22 dias úteis = **R$ 1.650/mês** "queimados" em FAQ repetitiva
- Comparativo: Schedule Clínica custa R$ 159/médico × 8 médicos = **R$ 1.272/mês**
- **Valor liberado por agente de IA respondendo 70% das FAQ ≈ R$ 1.155/mês** ≈ **90% do que o tenant já paga pelo Schedule**

A feature **dobra o ROI percebido** do Schedule Clínica sem aumentar muito o preço. Esse é o problema central.

### Por que **construir** e não **integrar Leadster**

| Critério | Leadster integrado | Interno PlexCare |
|---|---|---|
| Time-to-market MVP | 2-3 semanas (configurar) | 6-10 semanas (build) |
| Custo recorrente | Pricing custom Leadster (R$ ?, opaco) | Custo direto LLM API (R$ 3-15/tenant) |
| Controle de compliance CFM | Depende de roadmap Leadster | Nosso, totalmente customizável |
| Diferenciação de produto | Zero — qualquer concorrente integra Leadster também | Defensável — guardrails CFM próprios + integração nativa com agenda/encaixe |
| Vendor risk | Alto (single supplier para feature central) | Baixo (abstração permite trocar provider) |
| Margem | Espremida (margem dupla — Leadster + PlexCare) | Boa — só custo LLM |

**Decisão:** construir interno. Aceita time-to-market maior em troca de defensibilidade e margem.

---

## 3. Atores e jornadas

### Tenant Admin (sócio-médico ou administrador da clínica)

**Quando interage:** onboarding inicial + atualizações trimestrais do FAQ.

**Jornada de configuração inicial:**
1. Admin entra no Schedule web → seção "Agente IA do WhatsApp"
2. Define **persona do agente**: nome ("Sofia", "Carlos"), foto, tom ("formal" / "amigável") — escolha guiada
3. Sobe **base de conhecimento** (3 caminhos): (a) upload FAQ em Markdown; (b) cola URL do site da clínica para crawl; (c) preenche form-guiado com 15-20 perguntas padrão (horário, convênio, preço, etc)
4. Configura **escopo** (V1: só FAQ; V2: também agendamento básico). Toggle por categoria.
5. Configura **guardrails obrigatórios** (não desativáveis): nunca dar opinião médica, sempre escalar urgência, sempre oferecer humano sob demanda
6. Configura **horário do agente**: 24/7 ou janelas (clínica decide se agente atende fora do expediente)
7. **Preview**: testa em sandbox antes de ativar
8. **Ativa** → confirma com aceite de termos (CFM/LGPD/Anvisa cláusulas)

### Médico (sócio ou empregado)

**Quando interage:** revisão periódica + auditoria sob demanda.

**Funcionalidades:**
- Painel "últimas 50 conversas do agente" com filtro por médico/especialidade
- Botão "marcar resposta como inadequada" — gera feedback que reentra na avaliação semanal
- Veto categórico: "agente nunca pode responder sobre [tópico X]" — adiciona regra customizada
- Recebe notificação quando paciente sob seus cuidados teve handoff por urgência detectada

### Secretária / Atendente

**Quando interage:** durante o dia, recebe handoffs.

**Jornada:**
1. Agente identifica que precisa escalar → marca conversa como "handoff" no painel da secretária
2. Secretária vê **conversa completa** (não só última mensagem) + motivo do handoff + sugestão de resposta gerada pelo agente
3. Secretária responde manualmente OU aceita sugestão com edição
4. Secretária pode "treinar agente" — marcar "essa resposta foi boa" / "agente deveria ter respondido X"

### Paciente final

**Quando interage:** qualquer momento.

**Jornada típica:**
1. Paciente manda mensagem ao número WhatsApp da clínica
2. Agente responde em < 5s com disclaimer **na primeira interação do dia**: *"Olá! Eu sou [Sofia], assistente virtual da Clínica X. Posso ajudar com horários, agendamento e dúvidas administrativas. Para urgências médicas, ligue 192 (SAMU). Para falar com uma pessoa, digite 'atendente'."*
3. Conversa flui — agente responde FAQ, agenda (V2), encaminha quando necessário
4. Em qualquer momento paciente pode digitar "atendente" → handoff imediato

**Linhas vermelhas obrigatórias na UX:**
- Disclaimer claro e visível no primeiro contato do dia (não só uma vez na vida)
- Comando "atendente" / "pessoa" / "humano" funciona sempre, sem fricção
- Detecção de palavra-chave de urgência (lista: "dor peito", "falta ar", "sangrar", "desmaiou", "convulsão", "suicid", "machuc grave", ...) → handoff imediato + mensagem com SAMU 192

### PlexCare time interno

**Operação:**
- Dashboard: custo LLM por tenant, latência p99, taxa de handoff, alertas de "fora do escopo detectado"
- Alertas SRE: provider LLM down, custo/tenant excede budget

**Suporte:**
- Tickets de tenant: "agente não está respondendo", "agente disse X errado"
- Treinamento básico para tenants Solo/Clínica

**Compliance:**
- **Sample manual semanal** de 1% das conversas (mínimo 50/semana) — auditoria de hallucination, opinião médica vazada, PII vazado
- Process de retreinamento: feedback → ajuste prompt sistema / base FAQ / guardrails
- Reporting LGPD: solicitação de paciente "delete minhas conversas" → handler

**Produto:**
- A/B test de prompts
- Análise de gaps: "perguntas que agente errou X vezes esta semana" → recomendar atualização de FAQ ao tenant

---

## 4. Critérios de sucesso (mensuráveis)

### Métricas de produto

| Métrica | Definição operacional | Alvo MVP (M9 GTM, Abr/27) | Alvo M16 |
|---|---|---|---|
| **Deflection rate** | (mensagens resolvidas pelo agente sem handoff) / (mensagens totais entrantes) | ≥ 35% | ≥ 55% |
| **Handoff seamless** | % de handoffs onde histórico chegou completo na fila da secretária em ≤ 30s | ≥ 95% | ≥ 99% |
| **Latência p95 resposta agente** | (timestamp resposta) − (timestamp mensagem paciente) | ≤ 8s | ≤ 4s |
| **Time-to-value (TTV) tenant** | (primeira mensagem real respondida pelo agente) − (ativação do agente) | ≤ 1h | ≤ 15min |
| **Agent satisfaction** (paciente) | survey opcional após N=10 mensagens: "essa conversa te ajudou?" | ≥ 70% sim | ≥ 80% sim |

### Métricas de negócio

| Métrica | Definição | Alvo M11 | Alvo M16 |
|---|---|---|---|
| **Adoption rate Schedule Clínica+** | % de tenants Clínica+ com agente IA ativado | ≥ 30% | ≥ 60% |
| **NPS feature** | NPS do tenant com a feature ativa, vs sem | +20pts vs baseline | +30pts |
| **Schedule MRR uplift** | MRR adicional atribuído ao add-on IA (se overage) ou retenção atribuída (se incluso) | R$ 30k/mês | R$ 120k/mês |
| **Churn redution** | Churn de Schedule Clínica com agente vs sem (cohort matching) | −20% | −35% |

### Métricas de risco (não-negociáveis)

| Métrica | Definição | Alvo |
|---|---|---|
| **Hallucination rate** | (respostas marcadas como "falsa/incorreta" via sample manual + reports de secretária) / total avaliado | **≤ 0.5%** |
| **Opinião médica vazada** | conversas onde agente deu opinião sobre sintoma/diagnóstico/medicamento detectadas em audit | **0 por mês** |
| **PII de paciente em prompt LLM** | logs do prompt mostrando CPF/email/tel não-sanitizados | **0 por mês** |
| **Meta ban incidents** | número WhatsApp Business do tenant banido por culpa atribuível ao agente | **0 por trimestre** |
| **Custo LLM/tenant (Clínica)** | gasto OpenAI/Claude API médio em tenant Clínica | **≤ R$ 30/mês** (preserva margem 70%) |
| **SLA disponibilidade do agente** | uptime do pipeline IA do agente (rollup mensal) | **≥ 99.5%** |

---

## 5. Out-of-scope (V1 / MVP)

### Explicitamente fora do MVP

- **Agendamento ativo via conversa**: paciente diz "marcar dia 10" e agente já agenda → **V2** (M11+). MVP só responde "para agendar, acesse [link da agenda online]".
- **Triagem de sintomas**: paciente descreve sintomas → **NUNCA**. Sempre handoff.
- **Voz/áudio**: TTS/STT — **V2/V3**, só texto na V1.
- **Multi-canal**: Instagram DM, Telegram, SMS — **V3**. Só WhatsApp Business API na V1.
- **Multi-idioma**: PT-BR only. EN/ES para turismo médico em capitais → **V2**.
- **Integração ativa com PEP**: ler/escrever prontuário → **NUNCA** (escopo regulatório totalmente diferente).
- **Vídeo/imagem entrada**: paciente manda foto/laudo → **V2** (e exige análise muito mais cuidadosa).
- **Cobrança via conversa**: paciente paga consulta via PIX no chat → **V3**.
- **Multi-agente por tenant**: agente diferente por especialidade dentro da mesma clínica → **V2** (V1: 1 agente por tenant).

### Linhas vermelhas (jamais cruza, nem em V2/V3)

- Agente **nunca dá diagnóstico** ou opinião médica
- Agente **nunca prescreve** ou recomenda medicamento, dosagem ou interação
- Agente **nunca interpreta** resultados de exame
- Agente **nunca diz** "estável", "grave", "leve" sobre estado clínico de paciente
- Agente **nunca substitui** consulta médica — sempre redireciona
- **Em suspeita de urgência**: handoff imediato + número 192 (SAMU) explícito
- **PII de paciente** (CPF, RG, endereço, data nascimento) **nunca** entra em prompt LLM sem hashing/redação

### Comportamentos que exigem ADR separado antes de implementar

- Integração com prontuário (PEP) parceiro (iClinic, Memed) — exige ADR-NN
- Modelo de IA self-hosted (Llama, Mistral) — exige ADR-NN avaliando custo infra vs API
- Fine-tuning per tenant — exige ADR-NN avaliando data leakage e custo
- Agent-to-agent (agente conversa com outro agente de outra clínica) — exige ADR-NN sobre orchestration

---

## 6. Riscos e dependências

### Riscos críticos (P0 — bloqueiam ship sem mitigação)

| ID | Risco | Probabilidade | Impacto | Mitigação proposta |
|---|---|---|---|---|
| **R1** | Agente dá opinião médica → processo CFM contra tenant E contra PlexCare | Média | **Crítico** | Guardrails em 3 camadas: (a) classificador na ingestão da FAQ (LLM-as-judge rejeita FAQ que induz triagem); (b) prompt sistema fortíssimo com exemplos de recusa; (c) classificador na saída (revisa cada resposta antes de mandar). Sample manual semanal + retraining. |
| **R2** | LGPD: PII de paciente vaza para OpenAI/Anthropic | Alta sem mitigação | Crítico | Sanitizer regex antes do LLM (CPF, email, telefone, nome composto longo). DPA assinado com provider. Logs do prompt em zona criptografada com retenção 30d. |
| **R3** | Anvisa classifica feature como SaMD (Software as Medical Device) | Média | Alto (regulatório) | Escopo no contrato + disclaimer paciente + zero diagnóstico = feature é "assistente administrativo", não SaMD. Validação jurídica antes do GA. |
| **R4** | Tenant sobe FAQ que viola CFM (ex: "remédio para X é Y") | Alta | Crítico | Classificador na ingestão (rejeita); revisão humana opcional pra tenants Enterprise; default "rejeitar dúvida em vez de errar" no prompt do agente. |

### Riscos altos (P1 — degradam negócio)

| ID | Risco | Mitigação |
|---|---|---|
| **R5** | Custo LLM escala linear com volume; tenant ativo gera R$ 30+/mês de API | Cap mensal por tenant (configurável), overage cobrado, abstração `LLMProvider` permite mudar pra modelo mais barato sob pressão |
| **R6** | Vendor lock-in OpenAI/Anthropic | Abstração `LLMProvider` desde dia 1 (igual `BillingGateway` do ADR-0012); avaliação trimestral de provider |
| **R7** | Latência > 8s mata UX | Cache de resposta (FAQ idênticas), prompt menor, modelo mais rápido (Haiku/gpt-4o-mini), streaming |
| **R8** | Meta ban do número Business por mensagem fora janela 24h | Enforcement no scheduler (agente NUNCA inicia conversa fora 24h); usa template Meta-aprovado se precisa); rate limit por tenant |
| **R9** | Alucinação reputational viral ("Clínica X recomendou remédio errado via WhatsApp") | Sample manual + facilidade de reportar + emergência: kill switch global por tenant em 1 clique |
| **R10** | Conflito com cliente que já usa Leadster integrado ao Doctoralia/iClinic | Aceitar — feature é diferencial PlexCare, não bloqueia Schedule MVP |

### Riscos médios (P2 — monitorar)

| ID | Risco | Status |
|---|---|---|
| **R11** | Modelo do provider muda (ex: GPT-5 fica disponível, GPT-4 deprecated) → re-tuning de prompts | Aceito — abstração protege |
| **R12** | Sample manual 1% escala mal (1000 tenants × 1000 msg = 10k/semana amostradas) | Híbrido: PlexCare amostra 0.5%, tenant amostra opcional 100% via UI |
| **R13** | Tenant abandona o agente após 30 dias (churn da feature) | Adoption metric + onboarding ativo pelo CSM Enterprise |

### Dependências (precisam existir antes)

| Dep | O que precisa estar pronto | Status atual | Bloqueia? |
|---|---|---|---|
| **D1** | PlexCare Schedule MVP em GA (canal WhatsApp + envio de templates funcional) | Em desenvolvimento, alvo M6 GTM (Jan/27) | **Sim** |
| **D2** | Issue #3 fechada (tenant_id confiável via JWT do idp-api) | PRs 1-3 entregues em `feat/issue-3`; PR-4 a PR-7 pendentes | **Sim** |
| **D3** | ASAAS billing operacional (Issue #36, ADR-0012) para cobrar overage IA | Pendente | Não para MVP closed beta; **sim** para GA |
| **D4** | DPA assinado com provider LLM (Anthropic/OpenAI) com cláusulas LGPD-friendly | Pendente | **Sim** |
| **D5** | Process operacional de sample manual semanal (humano + dashboard) | Não existe | **Sim** antes do GA |
| **D6** | Vector store decidido (pgvector vs Pinecone vs Weaviate) | ADR pendente | Sim para começar build |
| **D7** | LLM provider decidido (Anthropic vs OpenAI vs híbrido) | ADR pendente | Sim para começar build |

---

## 7. Decisões pendentes — perguntas para o stakeholder

### Q1 — Escopo MVP: FAQ-only ou com agendamento?

- **Opção A** — **FAQ-only**: agente só responde dúvida operacional. Agendamento continua manual (secretária ou link). Ship em ~6 semanas pós-Schedule GA.
- **Opção B** — **FAQ + agendamento assistido**: agente busca slot livre, propõe horário, marca. Ship em ~12 semanas. Complexidade maior em compliance (paciente identificado, consentimento, etc).
- **Recomendação SE/SA**: A (FAQ-only). Permite ship + medir; agendamento entra em V2 quando temos métricas reais.

### Q2 — Gate de ativação do agente: aprovação humana obrigatória ou self-service?

- **Opção A** — **Aprovação PlexCare obrigatória**: tenant sobe FAQ → time interno revisa em até 48h → ativa. Mais seguro CFM, escala mal.
- **Opção B** — **Self-service com guardrails automáticos**: tenant ativa direto após aceite de termos; classificador automático rejeita FAQs problemáticas; sample manual posterior. Escala melhor, mais risco.
- **Opção C** — **Híbrido**: Solo/Clínica self-service; Enterprise sempre revisado pelo CSM. Compromisso.
- **Recomendação SE/SA**: C. Balanceia risco/escala com tier-aware.

### Q3 — Como cobrar o agente?

- **Opção A** — **Incluso no Schedule Clínica+** (não no Solo). Custo LLM é absorvido na margem (Clínica margem 86% → cai para ~80%). Adoção máxima.
- **Opção B** — **Add-on à parte** (R$ 49/mês por tenant Schedule Clínica para liberar agente, com cap de 1.000 msg/mês incluso, overage R$ 0,15/msg). Protege margem, reduz adoção.
- **Opção C** — **Híbrido**: 200 msg/mês inclusos no Schedule Clínica grátis; overage R$ 0,15/msg. Trial automático.
- **Recomendação SE/SA**: C. "Hook" gratuito ativa adoção; overage cobra usage real.

### Q4 — Gatilhos OBRIGATÓRIOS de handoff humano

Lista mínima proposta (todos devem estar):
- Paciente pediu explicitamente ("atendente", "pessoa", "humano", "alguém")
- Detecção de urgência (lista de keywords + LLM classifier)
- Agente respondeu "não sei" / "não tenho essa informação" 2 vezes seguidas
- Tópico fora da base do tenant + sem fallback safe
- Sentimento detectado: raiva ou frustração severa (rage)
- Paciente identificou-se como menor de idade

Adicionar mais? Tirar algum?
- **Recomendação SE/SA**: manter os 6. Adicionar #7 *paciente disse "emergência" / "urgente" / "agora"*.

### Q5 — Sample manual: responsabilidade de quem?

- **Opção A** — **PlexCare amostra 1% global**: caro em ops, controle total.
- **Opção B** — **Tenant amostra 100% via UI**: barato pra PlexCare, exige treinamento do tenant, risco de "ninguém amostra".
- **Opção C** — **Híbrido**: PlexCare amostra 0.5% (operação concentrada), tenant tem UI de amostragem opcional com nudges semanais.
- **Recomendação SE/SA**: C. Cumpre compliance + escala.

### Q6 — Tiers que recebem o MVP

- **Opção A** — **Apenas Enterprise** (V1 em closed beta com 5-10 redes). Validação controlada, baixo risco.
- **Opção B** — **Clínica+ e Enterprise** (V1 público). Adoção maior, risco médio.
- **Opção C** — **Todos os tiers Schedule** (Solo, Clínica, Enterprise). Adoção máxima, risco máximo (Solo é margem comprimida).
- **Recomendação SE/SA**: A → B (closed beta primeiro 8 semanas, depois público Clínica+).

### Perguntas para responder **antes de `/spec`** (pós-blueprint)

- **Q7** — Estratégia de retraining/feedback: manual via UI semanal? Auto-retrain por janela?
- **Q8** — Multi-língua quando? Mercado de turismo médico em capitais é real?
- **Q9** — Como medir hallucination automaticamente em produção? LLM-as-judge over sample, ou modelo classifier separado?

---

## 8. Próximos passos

Sequência sugerida, em ordem de execução. Cada passo bloqueia o próximo.

| # | Passo | Skill | Output | Quando |
|---|---|---|---|---|
| 1 | Stakeholder responde Q1-Q6 deste discovery | — | Decisões em comentário ou follow-up | **Agora** |
| 2 | ADR-0013 — Escolha de LLM provider + abstração `LLMProvider` | `/solutions-architect` | `docs/adr/0013-llm-provider.md` | Após Q1-Q6 |
| 3 | ADR-0014 — Vector store (pgvector vs Pinecone vs Weaviate vs in-Postgres) | `/solutions-architect` | `docs/adr/0014-vector-store.md` | Após ADR-0013 |
| 4 | Blueprint da feature end-to-end (ingestão FAQ → RAG → resposta WhatsApp → handoff) | `/blueprint` | `tasks/ia-conversacional-schedule-blueprint.md` | Após ADRs |
| 5 | Spec implementável com testes | `/spec` | `tasks/ia-conversacional-schedule-spec.md` | Após blueprint |
| 6 | Issues GitHub (1 issue por componente: ingestão, retriever, gerador, handoff, dashboards) | `/feature` ou manual `gh` | Issues #NN | Antes de PR-1 |
| 7 | TDD nos PRs implementando | `/software-engineer` | PRs em branches `feat/issue-NN` | M7-M8 GTM |
| 8 | QA com cenários críticos (hallucination, opinião médica, urgência) | `/qa-engineer` | Test plan + execução | Pre-closed-beta |
| 9 | Closed beta com 5-10 tenants Enterprise | — | Métricas + feedback | M8 |
| 10 | Lançamento público Clínica+ | — | GA Marketing | M9+ |

---

## 9. Checkpoint

**Achados que entram como premissas no blueprint (não revisitar):**

- ✅ **A-1** Feature alvo é agente WhatsApp por tenant no Schedule
- ✅ **A-2** Construir interno (não integrar Leadster)
- ✅ **A-3** 1 número WhatsApp por tenant (modelo Meta + BSP)
- ✅ **A-6** Abstração `LLMProvider` obrigatória dia 1

**Decisões aprovadas pendentes (Q1-Q6 da §7):**

- [ ] **Q1** Escopo MVP FAQ-only vs FAQ+agendamento
- [ ] **Q2** Gate de ativação self-service / gated / híbrido
- [ ] **Q3** Pricing: incluso / add-on / híbrido
- [ ] **Q4** Lista de gatilhos de handoff humano
- [ ] **Q5** Sample manual: PlexCare / tenant / híbrido
- [ ] **Q6** Tiers atendidos em V1

**Decisões adiadas (Q7-Q9 — entram no spec):**

- Q7 — Estratégia de retraining
- Q8 — Multi-língua
- Q9 — Medição automática de hallucination

---

## Anexos

### Referências

- Leadster (investigado 2026-06-07):
  - [`leadster.com.br/leadster-ai`](https://leadster.com.br/leadster-ai/) — ChatGPT + LangChain + RAG sobre FAQ
  - Loom "Dicas para criar sua base de treinamento" (Gabriel Lisboa) — padrão FAQ Markdown com hashtags
  - Artigo [`help.leadster.com.br/article/220`](https://help.leadster.com.br/article/220-aprenda-como-produzir-um-conteudo-de-ia)
- Compliance:
  - CFM 2.314/2022 (telemedicina) — escopo do agente NÃO é ato médico
  - Parecer CFM 11/2024 (IA na medicina) — assistente administrativo é zona segura
  - LGPD art. 7º, 18º — base legal + direito do paciente
  - Anvisa RDC 657/2022 — SaMD scope; assistente administrativo está fora
- Stack disponível PlexCare:
  - Postgres 16 (+ pgvector trivial), Redis 7, Kafka, NestJS/Go, WhatsApp Business API em produção
- Tasks relacionadas:
  - [`tasks/monetize-1-pricing.md`](monetize-1-pricing.md) §4 — Schedule SKU
  - [`tasks/monetize-3-gtm.md`](monetize-3-gtm.md) §6 — GA M6 Schedule
  - [`tasks/monetize-4-tracking.md`](monetize-4-tracking.md) §5.2 — eventos `whatsapp_*`
- ADRs:
  - [ADR-0007](../docs/adr/0007-encaixe-online-cross-produto.md) — encaixe online
  - [ADR-0011](../docs/adr/0011-resolucao-tenant-runtime-teleconf.md) — tenant_id confiável
  - [ADR-0012](../docs/adr/0012-gateway-unico-asaas.md) — ASAAS para cobrança IA overage

### Origem dos números

- Volume WhatsApp por tenant: benchmarking Doctoralia/Leadster cases + estimativa baseada em consultas/mês × 1.2 mensagens médias
- Custo LLM: tabela pública Anthropic (Claude Haiku $0.25/M input, $1.25/M output) + OpenAI (gpt-4o-mini $0.15/M input, $0.60/M output); 1 conversa típica ~2k tokens
- Tempo secretária: estimativa interna baseada em entrevistas com clínicas-protótipo
- Margens Schedule: tabela §6 de `tasks/monetize-1-pricing.md`
