# ADR 0004 — IdP próprio com Keycloak oculto

**Status:** Aceita — 2026-06-05
**Decisores:** Solutions Architect, Software Engineer
**Substitui:** —
**Consultar antes:** [discovery `plexcare-idp-api`](../../tasks/idp-api-discovery.md), [blueprint](../../tasks/idp-api-blueprint.md) §1, §6 TO-1, [spec](../../tasks/idp-api-spec.md)

## Contexto

A PlexCare precisa de um Authorization Server que sirva ao `plexcare-login-web` (em produção) e ao futuro `plexcare-platform-web`. As alternativas avaliadas foram:

| Opção | Como funciona | Trade-off principal |
|---|---|---|
| **IdP próprio (NestJS) + KC oculto** | Cliente fala só com o `idp-api`; KC só recebe Direct Grant server-side. JWT emitido pelo Nest com Ed25519. | Mais código próprio; superfície de segurança que precisa de TDD. |
| KC público | login-web redireciona direto ao KC; consome `id_token` do KC. | UX presa ao tema KC; claims customizados via mappers KC; mais superfície de ataque KC público. |
| KC + Authenticator SPI (Java) | Pluga código Java no KC para enriching de claims. | Time NestJS não escreve Java; SPI = lock-in; CI/CD KC mais lento. |

## Decisão

Adotamos um **Authorization Server próprio** em NestJS:

- Cliente nunca fala com Keycloak diretamente.
- Senha valida via **Direct Grant** server-side (KC fica oculto atrás do `idp-api`).
- JWT emitido por nós com **Ed25519** (`jose`), claims `account_id`, `roles[]`, `active_role`, `doctor_id?`.
- Refresh **opaco** em `idp_session`, rotacionável + reuse detection (ver ADR-0005 e [blueprint §5.3](../../tasks/idp-api-blueprint.md#53-refresh-token-rotação--detecção-de-reuso)).
- JWKS público em `/.well-known/jwks.json` para validação offline pelos demais serviços.

## Consequências

### Positivas

- UX customizada (login-web tem o tema PlexCare em todo o fluxo).
- Claims de negócio (`account_id`, `roles`, `doctor_id`) embutidos no JWT — microserviços validam offline.
- KC permanece como _credential vault_ — pode ser trocado no futuro substituindo apenas `KeycloakService` (ver EXT-8 do blueprint).
- Auditoria centralizada via outbox CloudEvents.

### Negativas

- Mais código próprio = mais superfície de bug em segurança. Mitigado por **TDD obrigatório** (D8 do discovery) em PKCE, lockout, JWT signer, session rotation.
- Divergência arquitetural vs. `plexcare-teleconf-service` (Go hexagonal). Mitigado por hexagonal-lite no NestJS (`domain/`, `application/`, `infrastructure/` por módulo).

### Riscos remanescentes

- **R1** (manutenção mental dual Go/Nest) — revisitar em 6 meses; se time sentir custo, considerar migrar serviço novo para Go.
- **R2** (lock-in KC) — KeycloakService é o único acoplamento; refator para interface `CredentialVault` quando houver caso de troca.

## Referências

- [blueprint §1, §2, §6 TO-1](../../tasks/idp-api-blueprint.md)
- [discovery decisões D1, D3, D5](../../tasks/idp-api-discovery.md)
- [spec — Etapas 5, 7, 14-20](../../tasks/idp-api-spec.md)
