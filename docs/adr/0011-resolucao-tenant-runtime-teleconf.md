# ADR-0011 — Resolução de tenant runtime no teleconf-service via JWT do idp-api + read-model Postgres

- **Data:** 2026-06-07
- **Status:** Accepted
- **Deciders:** Solutions Architect, Software Engineer
- **Tags:** `area/backend` `area/security` `compliance/lgpd` `module/plexcare-teleconf-service` `module/plexcare-idp-api`
- **Consultar antes:** [ADR-0002](0002-multi-tenancy-via-header-context.md) (migração JWT prevista), [ADR-0004](0004-idp-proprio-keycloak-oculto.md) (KC oculto), [ADR-0005](0005-outbox-worker-poll.md) (outbox), [ADR-0008](0008-plan-data-model.md) (catálogo idp-api + read-model)

## Contexto

O `internal/room/infrastructure/devtenant/resolver.go` aceita qualquer UUID no header `X-Tenant-Id` e devolve plano `pro` fake com 50 salas. **É blocker de produção** (LGPD/CFM — vazamento de tenant arbitrário) e blocker do pipeline `/monetize-plexcare` (sem plan real, billing factura R$ 0 mesmo com `monthly_usage` correto pós PR #35).

A Issue #3 foi aberta em 2026-06-02 antes do `plexcare-idp-api` existir. Propõe arquitetura conflitante com o que foi mergeado nos últimos dias:

| Fonte | Propõe |
|---|---|
| **Issue #3** (2026-06-02) | Tabela `tenants` própria no Postgres do teleconf; auth via `Authorization: Bearer <api_key>` + bcrypt; endpoint admin local |
| **ADR-0004** (2026-06-05) | idp-api é a fachada de identidade; KC oculto; JWT Ed25519 com claims `account_id`, `roles`, `aud`, `iss` |
| **ADR-0008** (2026-06-07) | Catálogo de tenants/produtos/planos no idp-api MySQL; read-model Postgres no teleconf populado via outbox |
| **ADR-0002** (2026-06-02) | `X-Tenant-Id` UUID cru no header é estado dev; migração para JWT prevista quando o IdP estiver pronto |

Quatro decisões precisam ser tomadas agora, em uma rodada, para destravar o handoff ao Software Engineer.

| ID | Pergunta | Veredito |
|---|---|---|
| **D-1** | Mapping `account_id` (BigInt idp-api MySQL) ↔ `tenant_id` (UUID teleconf Postgres) | Coluna `tenant_uuid UUID` em `account`, exposta no JWT como claim `tenant_id` |
| **D-2** | Resolução em runtime: JWKS verify offline, hop síncrono ou read-model? | JWKS verify offline + read-model Postgres no teleconf + cache LRU 60s |
| **D-3** | Header / contrato de auth no teleconf | `Authorization: Bearer <JWT>` primário; `X-Tenant-Id` mantido como fallback gated por env `ALLOW_DEV_TENANT_HEADER` |
| **D-4** | Destino da Issue #3 | Atualizar (mesmo número, corpo reescrito), apontar para este ADR |

Pedido explícito do stakeholder ("analise ou considere o uso do Keycloak") é respondido na seção [§ Avaliação do Keycloak](#avaliação-do-keycloak).

## Decisão

### D-1. Mapping `account_id ↔ tenant_id`: coluna `tenant_uuid` no idp-api

A tabela `account` (idp-api, MySQL) recebe **uma coluna nova**:

```sql
ALTER TABLE account
  ADD COLUMN tenant_uuid CHAR(36) NOT NULL DEFAULT (UUID());

CREATE UNIQUE INDEX idx_account_tenant_uuid ON account (tenant_uuid);
```

Backfill: gerar `UUID()` para todas as rows existentes (idempotente — DEFAULT já cobre).

O `buildAccessClaims` em `src/modules/token/application/jwt-claims.builder.ts` passa a emitir o claim padrão `tenant_id` no access token:

```typescript
return {
  // ... claims existentes
  account_id: input.active.accountId.toString(),  // mantido por compatibilidade
  tenant_id: input.active.tenantUuid,              // novo — UUID do tenant
  // ...
};
```

`account_id` (BigInt como string) é mantido como **chave interna de auditoria** (CloudEvents, logs do idp-api). `tenant_id` (UUID) é o **identificador externo** consumido pelos serviços downstream.

**Por que não Keycloak Organizations:** ver [§ Avaliação do Keycloak](#avaliação-do-keycloak).

**Por que não UUID determinístico (`uuid_v5(NS, account_id)`):** elegante operacionalmente mas viola simples-operacional — qualquer leitor precisa saber que é derivado; migrar para UUID independente depois exige re-emitir JWTs e re-projetar read-model. Coluna explícita é mais barata e clara.

**Por que não tabela `tenant_account_map` no teleconf:** duplica source-of-truth. ADR-0008 já fixou idp-api como canônico para identidade de tenant.

**Por que não refactor BigInt no teleconf:** custo desproporcional (5+ tabelas com índices, código de domínio, PR #35 já mergeado com `UUID NOT NULL`). Trade-off ruim.

### D-2. Resolução em runtime: JWKS offline + read-model + cache

Fluxo do hot path `POST /api/v1/rooms` e demais endpoints autenticados:

```
Request
   │
   ▼
[1] HTTP middleware extrai Authorization: Bearer <JWT>
   │
   ▼
[2] JWKS verify offline (chaves cacheadas do idp-api /.well-known/jwks.json)
       Valida: assinatura Ed25519, exp, iss (=https://idp-api), aud (=room-service)
       Extrai claims: tenant_id, account_id, sub (idp_user_id), roles, active_role
   │
   ▼
[3] Cache LRU lookup por tenant_id (TTL 60s, capacidade 10k entries)
       Hit  → reuse tenant.Context
       Miss → continua
   │
   ▼
[4] Query no read-model Postgres (tabela tenant_subscription_view):
       SELECT plan_code, max_concurrent_rooms, features
         FROM tenant_subscription_view
        WHERE tenant_id = $1 AND status IN ('active','trialing')
       LIMIT 1
   │
   ▼
[5] Compõe tenant.Context (campos enriquecidos em D-1) e injeta no ctx
   │
   ▼
Próximo handler
```

**Read-model `tenant_subscription_view`** vive no Postgres do teleconf, criado em migration nova (`002_tenant_subscription_view.sql`). É populado via consumer Kafka que escuta o outbox do idp-api ([ADR-0005](0005-outbox-worker-poll.md) + [ADR-0008](0008-plan-data-model.md)).

| Coluna | Tipo | Origem |
|---|---|---|
| `tenant_id` | UUID PK | `account.tenant_uuid` (idp-api) |
| `account_id` | BIGINT NOT NULL | `account.id` (idp-api) — chave de auditoria |
| `plan_code` | TEXT NOT NULL | `tenant_subscription.plan_code` (ADR-0008) |
| `product_sku` | TEXT NOT NULL | `tenant_subscription.product_sku` (rooms/schedule/suite) |
| `plan_tier` | TEXT NOT NULL | derivado (`solo`/`clinica`/`enterprise`/`trial`) |
| `status` | TEXT NOT NULL | `trialing`/`active`/`past_due`/`cancelled`/`churned` |
| `max_concurrent_rooms` | INT NOT NULL | `plan.max_concurrent_rooms` |
| `features` | JSONB NOT NULL | `plan.features` (`{"recording":true,"transcription":false}` …) |
| `trial_ends_at` | TIMESTAMPTZ NULL | `tenant_subscription.trial_ends_at` |
| `current_period_end` | TIMESTAMPTZ NOT NULL | `tenant_subscription.current_period_end` |
| `updated_at` | TIMESTAMPTZ NOT NULL | `MAX(outbox_event.occurred_at)` projetado |

**Política de cache:**
- LRU in-memory por instância do room-service (não Redis no MVP — evita dependência adicional no hot path).
- TTL **60s** — janela aceitável para mudanças de plano. Cobranças de overage não dependem de cache (acumuladas em `participant_sessions`).
- Invalidação ativa: consumer Kafka que projeta o read-model também publica em pubsub local (`tenant.invalidated`) — instância invalida entrada antes do TTL.
- Métrica Prometheus obrigatória: `tenant_resolver_cache_hits_total`, `tenant_resolver_cache_misses_total`, `tenant_resolver_db_lookup_seconds`.

**Tolerância de staleness por campo:**

| Campo | Tolerância | Razão |
|---|---|---|
| `max_concurrent_rooms` | 60s | downgrade de tier raro; overage cobrado |
| `features` (recording, transcription) | 60s | mudança operacional rara |
| `status=cancelled/churned` | **Imediato** via invalidação ativa | bloqueio de novas salas precisa cair em segundos |
| `plan_code`/`product_sku` | 60s | usado para billing — invoice diário/mensal compensa |

**Por que não `GET /v1/me` por request:** hop síncrono no hot path. Latência média 30-80ms ainda dentro do budget p99 < 500ms, mas drena conexões e cria acoplamento operacional: room-service cai se idp-api cair. Read-model isola o blast radius.

**Por que não claims de plan no JWT:** TTL atual do access token é 900s. Plan no claim teria staleness máximo de 15min — pior que cache 60s. Além disso, refresh em mudança de plano não acontece automaticamente.

### D-3. Header / contrato: Bearer JWT primário, X-Tenant-Id em fallback dev

O middleware HTTP é reescrito para suportar dois modos, decididos por **ordem de prioridade**:

1. **Primário:** `Authorization: Bearer <JWT>`. Verify JWKS. Extrai `tenant_id` do claim. Esse é o modo de produção.
2. **Fallback dev:** se Bearer ausente **e** env `ALLOW_DEV_TENANT_HEADER=true`, lê `X-Tenant-Id` cru. Resolver fake (`devtenant`) só é wired neste caminho.
3. **Caso contrário:** `401 Unauthorized` com `WWW-Authenticate: Bearer realm="plexcare"`.

```go
// pseudocódigo do middleware reescrito
func TenantMiddleware(jwt JWTResolver, dev DevTenantResolver, allowDev bool) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if bearer := extractBearer(r); bearer != "" {
                tc, err := jwt.Resolve(r.Context(), bearer)
                if err != nil {
                    writeAuthError(w, err)
                    return
                }
                next.ServeHTTP(w, r.WithContext(tenant.WithContext(r.Context(), tc)))
                return
            }
            if allowDev {
                if id := r.Header.Get(HeaderTenantID); id != "" {
                    tc, err := dev.Resolve(id)
                    if err == nil {
                        next.ServeHTTP(w, r.WithContext(tenant.WithContext(r.Context(), tc)))
                        return
                    }
                }
            }
            writeError(w, http.StatusUnauthorized, "missing_credentials", "Authorization Bearer required")
        })
    }
}
```

**Wiring por ambiente:**

| Env | `ALLOW_DEV_TENANT_HEADER` | Default | Quem aceita |
|---|---|---|---|
| `dev` (local) | `true` | sim | Bearer JWT **ou** X-Tenant-Id |
| `staging` | `false` | sim | Bearer JWT apenas |
| `prod` | `false` | **hardcoded** — boot falha se `true` | Bearer JWT apenas |

Boot do `cmd/room-service/main.go` faz fail-fast se `ENV=prod && ALLOW_DEV_TENANT_HEADER=true`. Mesma técnica do `JWKS_KEK_PROVIDER` do idp-api.

**Sunset do `X-Tenant-Id`:**
- Sprint atual: `plexcare-teleconf-web` ganha cliente HTTP que envia Bearer (vem do `plexcare-login-web` via storage compartilhado / cookie).
- Sprint +1: `ALLOW_DEV_TENANT_HEADER=false` por default em todos os ambientes.
- Sprint +2: código de fallback removido por completo; ADR-0002 atualizado para "Superseded by ADR-0011".

### D-4. Issue #3: atualizar corpo, manter número

Reescrever Issue #3 in-place. Mantém histórico de discussão (comentários, label `area:teleconf`, vínculo com ADR-0002). Novo corpo refletindo este ADR. Sem fechar — close acontece quando PR de implementação for mergeado.

Comando `gh` em [§ Handoff](#handoff-software-engineer).

## Avaliação do Keycloak

O stakeholder pediu explicitamente que avaliássemos o Keycloak como opção. Quatro cenários considerados:

| Cenário | O que mudaria | Veredito |
|---|---|---|
| **A. Promover KC para fachada pública** | Cliente fala direto com KC; idp-api vira proxy ou some | **Descartar**. Contraria ADR-0004 mergeada há 5 dias. Reabrir essa decisão sem incidente é over-engineer. R1/R2 do ADR-0004 ainda não materializaram. |
| **B. KC Organizations representando tenants** | Cada tenant vira uma Organization no KC; ID UUID nativo; idp-api delega gerenciamento de tenant ao KC | **Descartar para este escopo**. Organizations modela B2B partnerships e SSO inter-empresa — fit imperfeito com PlexCare onde tenant = clínica isolada. Versão do KC na stack não declarada no repo (env-based em `KEYCLOAK_BASE_URL`); migrar para KC 26+ é decisão de infra própria. ADR-0008 já tem catálogo de tenants no idp-api MySQL — usar KC Organizations duplica source-of-truth. |
| **C. KC oculto + Organizations interno** | idp-api permanece fachada, mas internamente usa KC Organizations para tenant | **Descartar**. Acoplamento sem ganho — idp-api já tem `account` mapeada em MySQL com Prisma; reimplementar via KC Admin API adiciona latência e modes-de-falha. |
| **D. KC fica como está (credential vault)** | Direct Grant para senha, nada mais | **Adotada (vigente)** — alinhada com ADR-0004. |

**Conclusão sobre Keycloak:** continua oculto. Nenhuma mudança em ADR-0004. Este ADR-0011 trata exclusivamente da camada idp-api ↔ teleconf-service.

**Plano de revisão para Keycloak:** se M9+ (GTM Etapa 3, GA Suite) trouxer demanda concreta de **SSO empresarial** (Azure AD / Google Workspace de rede de clínicas), abrir novo ADR com 3 opções:

1. KC Organizations + Identity Brokering nativo do KC.
2. OIDC federation simples no próprio idp-api (`@nestjs/passport` + provider OIDC).
3. SAML 2.0 dedicado (mais leve para integrar com IdPs corporativos legados).

Decisão depende de quantos prospects Enterprise pedem SSO e qual o IdP de origem deles. Hoje, prematuro.

## Consequências

### Positivas

- Resolve o blocker de produção (`devtenant.Resolver` fake) sem refactor de schema do teleconf.
- Realiza a evolução prevista em ADR-0002 — JWT no boundary, header cru morre gradualmente.
- Enriquece `tenant.Context` com `AccountID`, `Plan`, `ProductSKU`, `Features`, `Roles`, `IdpUserID` — destrava a Etapa 4 (tracking) onde todo evento precisa carregar essas propriedades.
- Mantém isolamento multi-tenant explícito: `tenant_id` UUID continua em todo log/span/query do teleconf (ADR-0002 vivo).
- idp-api permanece source-of-truth de identidade e plano (ADR-0008 honored). Read-model é projeção, não fonte.
- Read-model isola blast radius: teleconf segue funcional mesmo com idp-api degradado (com staleness limitada por TTL).
- Compatibilidade backwards: X-Tenant-Id continua em dev por 2 sprints, permite migração sem flag day.

### Negativas / Trade-offs

- idp-api ganha uma migration em produção (`tenant_uuid` em `account`). Backfill é idempotente mas requer janela ou DEFAULT (escolhido).
- Read-model `tenant_subscription_view` exige consumer Kafka novo no teleconf — mais código operacional. Mitigado por outbox+poll já validado em ADR-0005.
- Cache LRU in-memory implica que invalidação de plan distribui via Kafka — se um pod recebe outbox mas outro não, staleness 60s. Aceitável dada a tolerância documentada em D-2.
- Sunset do `X-Tenant-Id` exige coordenação com `plexcare-teleconf-web` — risco de quebra se o-web não migrar antes do flag `ALLOW_DEV_TENANT_HEADER=false`. Mitigado por janela de 2 sprints.

### Riscos remanescentes

- **R1** — Consumer Kafka que projeta `tenant_subscription_view` precisa de DLQ ou retry decente. ADR-0005 já cobre at-least-once; consumer deve ser idempotente (upsert por `tenant_id`).
- **R2** — Read-model pode divergir do idp-api em caso de falha catastrófica do consumer. Mitigação: cron de reconciliação diário que faz full snapshot vs idp-api (`GET /v1/admin/accounts` interno) e corrige discrepâncias. Não-MVP — abrir issue tracking.
- **R3** — JWKS rotation: idp-api roda `jwks-rotator.worker` mensal. teleconf-service precisa refrescar cache de JWKS quando `kid` desconhecido aparece. Padrão das libs `jose`/`golang-jwt` cobre.
- **R4** — Trial/Founders Program: tenants em trial têm `status=trialing`, `current_period_end` no D+14. View precisa expor isso para que enforcement não bloqueie indevidamente. Reflexão na coluna `status` da view.

### Neutras / a observar

- Métrica `tenant_resolver_cache_hit_ratio` esperada ≥ 95% em regime estável. Alertar se cair abaixo de 80% por mais de 15min (sintoma de invalidações excessivas ou TTL mal-calibrado).
- Cardinalidade Prometheus: `tenant_id` como label é OK até ~5k tenants. Acima disso, recortar com `hash(tenant_id) % N` em métricas de série temporal.
- `account_id` continua como chave interna do idp-api — logs/CloudEvents/audit usam `account_id`. Cross-reference com `tenant_id` via view ou query.

## Alternativas consideradas

### A — JWT carrega plan/features/limits direto

Eliminar read-model; JWT tem tudo.
- Prós: zero infraestrutura nova no teleconf.
- Contras: staleness de 900s (TTL access token), refresh em mudança de plano não acontece automaticamente, JWT vira pesado (limites + features JSON), invalidação imediata impossível.
- Por que não: tolerância de 15min é grande demais para `status=cancelled` (precisa ser segundos).

### B — `GET /v1/me` no idp-api por request

Sem read-model, sem cache; cada request faz hop.
- Prós: zero staleness; idp-api single source-of-truth real-time.
- Contras: latência 30-80ms no hot path; teleconf cai se idp-api cair; idp-api precisa escalar 1:1 com teleconf.
- Por que não: blast radius e acoplamento operacional. Read-model é isolamento clássico.

### C — Cache Redis em vez de LRU in-memory

Cache distribuído entre instâncias do room-service.
- Prós: invalidação única; menos staleness inter-pod.
- Contras: adiciona dependência operacional no hot path (já temos Redis para routing/rate-limit, mas em cache de tenant.Context vira P0 de SRE).
- Por que não no MVP: LRU in-memory + invalidação via Kafka pubsub cobre 99% dos casos. Migrar para Redis se métricas mostrarem inter-pod drift relevante.

### D — Mantér Issue #3 como está (tabela `tenants` no teleconf, API key)

Honrar a issue como escrita.
- Prós: zero coordenação com idp-api.
- Contras: viola ADR-0008 (duplica catálogo); viola ADR-0004 (cria source-of-truth de identidade fora do idp-api); cria contrato API-key que não escala para SSO Enterprise futuro.
- Por que não: três ADRs já decidiram outra direção.

### E — Promover Keycloak

Cobertas em [§ Avaliação do Keycloak](#avaliação-do-keycloak) acima.

### F — UUID determinístico `uuid_v5(NS, account_id)`

Calculado em ambos os lados, sem coluna nova.
- Prós: zero migration.
- Contras: "magia escondida" — leitor precisa saber que é derivado; migrar para UUID independente custa caro depois.
- Por que não: simples-operacional > schema-magro.

## Plano de revisão

Reavaliar se:

- M9+ GTM (GA Suite, Enterprise pipeline) trouxer demanda concreta de SSO empresarial → reabrir KC Organizations + federation (novo ADR).
- Cache hit ratio cair sustentado abaixo de 80% → considerar Redis distribuído (alternativa C).
- Read-model lag (medido por `tenant_subscription_view.updated_at` vs `outbox_event.published_at`) ultrapassar 30s p99 → revisitar consumer (paralelismo, batching).
- Volume de tenants ativos passar de 5k → revisitar cache LRU capacity (10k → 50k) e cardinalidade Prometheus.
- `plexcare-teleconf-web` não migrar para Bearer até fim do Sprint atual → bloquear merge da remoção do fallback `X-Tenant-Id`.

## Referências

- Issue: #3 (atualizada por este ADR)
- ADRs consultados: [0002](0002-multi-tenancy-via-header-context.md), [0004](0004-idp-proprio-keycloak-oculto.md), [0005](0005-outbox-worker-poll.md), [0008](0008-plan-data-model.md)
- Código vigente:
  - `platform/backend/plexcare-teleconf-service/internal/room/infrastructure/http/middleware.go` — middleware que será reescrito
  - `platform/backend/plexcare-teleconf-service/internal/room/infrastructure/devtenant/resolver.go` — resolver fake que sai do hot path em prod/staging
  - `platform/backend/plexcare-teleconf-service/pkg/tenant/context.go` — `tenant.Context` que será enriquecido
  - `platform/backend/plexcare-idp-api/src/modules/token/application/jwt-claims.builder.ts` — onde claim `tenant_id` será adicionado
  - `platform/backend/plexcare-idp-api/prisma/schema.prisma` — model `account` recebe `tenantUuid`
- Memórias: [[plexcare-devtenant-security]] · [[plexcare-adr-0008-plan-data-model]] · [[plexcare-teleconf-api]]
- Compliance: LGPD art. 18 (rastreabilidade de tenant em DSARs preserved via `tenant_id` único), CFM 2.314 (identificação inequívoca do profissional via JWT)
