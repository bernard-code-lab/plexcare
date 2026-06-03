# ADR-0002 — Multi-tenancy via header `X-Tenant-Id` propagado por `context.Context`

- **Data:** 2026-06-02
- **Status:** Accepted (com migração JWT planejada — issue #17)
- **Deciders:** equipe de plataforma (Rafael)
- **Tags:** `area/backend` `compliance/lgpd` `area/security` `module/plexcare-teleconf`

## Contexto

PlexCare é SaaS B2B multi-tenant — cada clínica/hospital é um tenant com sua configuração, plano, limites e faturamento. O isolamento entre tenants é **inegociável** (LGPD + risco reputacional).

Pergunta: **como `tenant_id` chega do request HTTP até a query Postgres, logs/spans e métricas, sem ninguém esquecer?**

Constraints:
- Toda query Postgres precisa carregar `tenant_id` no `WHERE` — esquecer é vazamento.
- Logs/spans/métricas precisam de `tenant_id` como atributo/label para que dashboards e auditoria sejam por tenant.
- Decisão precisa funcionar **hoje** (vertical slice TDD) e ser compatível com o `plexcare-auth-api` planejado (issue #17, JWT issuing).
- Não pode bloquear smoke test no browser (cliente real ainda não existe).

## Decisão

### Estado atual (dev)

1. **Header HTTP `X-Tenant-Id`** carrega o `tenant_id` como UUID em todo request.
2. **Middleware** (`internal/room/infrastructure/http/middleware.go`) extrai o header, valida formato UUID, chama o `TenantResolver` para obter o objeto `Tenant` (limites do plano etc.) e injeta no `context.Context`.
3. **Resolver atual** é `devtenant.Resolver` — aceita qualquer UUID e devolve plano Pro fake (50 salas). **Não é seguro.** Tracked em **issue #3**.
4. **Propagação** via `pkg/tenant`:
   - `tenant.WithContext(ctx, t)` injeta.
   - `tenant.FromContext(ctx)` extrai.
   - `tenant.IDFromContext(ctx)` extrai só o ID (uso em queries).
5. **Repository** (`internal/room/infrastructure/postgres/room_repository.go`) **rejeita** qualquer query sem `tenant_id` no context (`ErrMissingTenant`).
6. **Logs (zap)** e **spans (OTel)** carregam `tenant_id` como campo/atributo via interceptor.
7. **Schema** — coluna `rooms.tenant_id` é `UUID NOT NULL`. Tentar inserir string não-UUID retorna `SQLSTATE 22P02`.

### Estado futuro (após issue #17 — `plexcare-auth-api`)

- Cliente autentica em `auth-api`, recebe JWT com claim `tenant_id`.
- Middleware passa a validar o JWT e extrair `tenant_id` do claim — **não mais do header cru**.
- `X-Tenant-Id` cru continua aceito apenas no modo dev (`devtenant.Resolver`), bloqueado em staging/prod via feature flag/env.

Esta decisão **não muda** a propagação interna via `context.Context` — só a origem do `tenant_id` no boundary HTTP. Por isso o ADR cobre as duas fases.

## Consequências

**Positivas**
- Propagação uniforme: qualquer função que recebe `context.Context` tem acesso ao tenant — Go enforced via convenção `ctx` como primeiro arg.
- Não invade o payload das entidades de domínio (Room, Usage não precisam carregar tenant explícito).
- Tracing OTel funciona naturalmente: `span.SetAttribute("tenant_id", id)` no middleware → propaga para todos os spans filhos.
- Repository pode ser teu último guarda — query sem tenant trava com erro tipado, não com vazamento silencioso.
- Migração para JWT é trocar uma linha do middleware — domínio e adapters não mudam.

**Negativas / Trade-offs**
- **Header cru é inseguro hoje.** `devtenant.Resolver` aceita qualquer UUID. Documentado em [[plexcare-devtenant-security]]. Mitigação: nunca subir para staging/prod sem issue #3 fechada.
- `tenant_id` no context é "magia escondida" — dev novo pode escrever query sem perceber que o repo enforça. Mitigação: erro tipado `ErrMissingTenant` com mensagem explícita.
- Migração JWT exige cliente atualizar header → bearer token. Hoje sem custo (sem cliente prod). Em 6 meses pode ser bloqueante.

**Neutras / a observar**
- Roles/permissions ainda não foram pensados nesse modelo. Quando vierem, ou entram no JWT como claims, ou viram lookup no `Tenant` carregado pelo resolver.
- Cache do `Tenant` em memória/Redis: hoje o resolver fake retorna instantâneo. Resolver real (issue #3) precisará de cache para não bater no DB a cada request.

## Alternativas consideradas

### JWT-only desde o início (sem fase de header cru)
- Prós: seguro desde sempre, sem dívida.
- Contras: bloquearia o vertical slice TDD que entregamos (sem cliente HTTP fake, sem smoke test browser inicial).
- Por que não: trade-off explícito de velocidade vs segurança em **dev local**. Em prod a decisão é JWT.

### Subdomínio (`acme.plexcare.com.br` → tenant_id derivado)
- Prós: UX bonito para tenant ("nossa clínica.plexcare").
- Contras: exige DNS + cert wildcard ou per-tenant, complexidade de roteamento, fricção para self-service onboarding.
- Por que não: não agrega ao backend (ainda teríamos que injetar `tenant_id` no context internamente) e adiciona ops. Considerar quando UX virar prioridade.

### `tenant_id` como query string / path param (`/api/v1/tenants/{id}/rooms`)
- Prós: explícito no URL, fácil de logar.
- Contras: polui logs com IDs sensíveis (URL aparece em access log, browser history, referer header), confunde paths REST que já têm múltiplos IDs (`/tenants/{tid}/rooms/{rid}/participants/{pid}` é hostil).
- Por que não: vaza dados em camadas que não controlamos (browser, proxy).

### `tenant_id` no payload (body do request)
- Prós: independente de header.
- Contras: GET não tem body. Cliente pode inventar tenant arbitrário (mesmo problema do header cru, sem benefício). Não funciona para webhook do LiveKit.
- Por que não: nem resolve o problema de origem nem é uniforme.

## Plano de revisão

Reavaliar se:
- Issue #17 (`plexcare-auth-api`) for fechada — atualizar status deste ADR para "Superseded por ADR-NNNN" se a mudança JWT virar contrato diferente.
- Adicionarmos federation/SSO via SAML/OIDC — pode ser que tenant venha do `iss` do JWT em vez de claim explícito.
- Aparecer requisito de "usuário de uma clínica acessar dado de outra clínica parceira" (compartilhamento legítimo) — modelo binário tenant-ou-não vai precisar de scope/grant.

## Referências

- Issue: #3 (Tenant Config Service real — bloqueia prod), #17 (`plexcare-auth-api` com JWT)
- Código:
  - `platform/plexcare-teleconf/pkg/tenant/context.go` — API canônica
  - `platform/plexcare-teleconf/internal/room/infrastructure/http/middleware.go` — extração do header
  - `platform/plexcare-teleconf/internal/room/infrastructure/devtenant/resolver.go` — resolver fake (NÃO usar em prod)
  - `platform/plexcare-teleconf/internal/room/infrastructure/postgres/room_repository.go` — enforcement no query
- Memória: [[plexcare-devtenant-security]] · [[plexcare-teleconf-api]]
- Compliance: LGPD (isolamento de dados pessoais entre tenants), CFM 2.314 (identificação do profissional/paciente — implícita via tenant)
</content>
</invoke>