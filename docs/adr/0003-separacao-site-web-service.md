# ADR-0003 — Separação `site` / `plexcare-teleconf-web` / `plexcare-teleconf-service`

- **Data:** 2026-06-03
- **Status:** Accepted
- **Deciders:** Rafael Carvalho (plataforma)
- **Tags:** `area/frontend` `area/backend` `area/infra` `compliance/lgpd` `module/plexcare-teleconf`

## Contexto

Até esta decisão, o monorepo tinha dois alvos de UI conflitantes no mesmo artefato `site/`:

1. **Landing institucional** (Hero, Pricing, FAQ, DemoScheduler) — público, indexável, sem auth.
2. **Sandbox da sala virtual** (`src/sandbox/RoomSandbox.jsx` na rota `#/sandbox/room`) — interno, dependia de `livekit-client` (~300 KB), exigia desligar React StrictMode condicionalmente para evitar loops de reconexão WebRTC.

Esse acoplamento gerava três problemas:

- **Bundle inflado** do site institucional carregava `livekit-client` mesmo para visitantes que nunca entrariam numa sala.
- **CSP/segurança divergente** — landing precisa CSP estrito (sem `wss:`, sem `media-src`); sala precisa `wss://livekit.*`, `stun:`, `turn:`, `media-src 'self' blob:`. Servir as duas no mesmo domínio força CSP frouxo.
- **Footprint de compliance ambíguo** — `RoomSandbox` rodava sem `ConsentModal` (LGPD) nem banner CFM 2.314 porque era "só sandbox", mas evoluiria para o produto real. Continuar nesse caminho misturaria UI de marketing com UI sujeita a Res. CFM 2.314/2022.

Simultaneamente, o backend Go (`platform/plexcare-teleconf/`) recebeu o sufixo `-service` para abrir espaço a um irmão web (`platform/plexcare-teleconf-web/`) na mesma taxonomia (`plexcare-<contexto>-<tipo>`).

Pergunta a decidir agora: **como separar institucional, produto-web e backend para que cada um evolua sob constraints próprios sem refatoração futura?**

## Decisão

Três artefatos distintos, cada um com fronteira de responsabilidade explícita:

| Artefato | Papel | Stack | Porta dev | Domínio prod (futuro) |
|---|---|---|---|---|
| `site/` | Site institucional puro (marketing + showcase de design) | Vite + React 18 + Tailwind | 5173 | `plexcare.com.br` |
| `platform/plexcare-teleconf-web/` | UI do produto sala virtual | Vite + React 18 + React Router + LiveKit Client + TanStack Query | 5174 (fixa, `strictPort: true`) | `app.plexcare.com.br` |
| `platform/plexcare-teleconf-service/` | Backend Go (room/metering/webhooks) | Go 1.26, chi, pgx, LiveKit Server SDK, Kafka | 8080 | `api.plexcare.com.br` |

Regras estruturais decorrentes:

1. **`site/` perde toda dep LiveKit** (`@livekit/components-react`, `@livekit/components-styles`, `livekit-client`) e o `src/sandbox/RoomSandbox.jsx`. StrictMode passa a ser incondicional.
2. **`plexcare-teleconf-web/` é o único caminho de UI para a sala** em qualquer ambiente. O `RoomSandbox` antigo virou `Room.jsx` produtivo, agora com `ConsentModal` bloqueante (LGPD/CFM) e `ComplianceBanner` persistente.
3. **`plexcare-teleconf-service/` libera CORS via env `CORS_ALLOWED_ORIGINS`**, default dev = `http://localhost:5174`, prod = `https://app.plexcare.com.br`.
4. **Design system começa como cópia**: `src/components/ui/`, `tailwind.config.js`, `lib/utils.js` e tokens em `index.css` foram replicados de `site/` para `plexcare-teleconf-web/`. Promover para `packages/ui/` (workspace npm) só quando divergência custar mais que sync manual — fica como ADR-0004 pendente.
5. **Auth boundary**: token efêmero LiveKit emitido por `POST /api/v1/rooms` do `-service/` (v1). OIDC / magic link via futuro `plexcare-auth-api` (issue #17) fica como ADR-0005 quando o auth-api existir.
6. **CSP**:
   - `site/`: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';` (sem media/ws).
   - `plexcare-teleconf-web/`: acima + `connect-src 'self' wss://livekit.* https://api.plexcare.com.br`, `media-src 'self' blob:`, `worker-src 'self' blob:`.
7. **Telemetria divergente**: `site/` foca CWV (Plausible/GA). `plexcare-teleconf-web/` foca UX errors de sala (Sentry) + funil de conversão de consulta (PostHog).

## Consequências

**Positivas**

- Site institucional emagrece (~800 KB → 455 KB bundle JS).
- CSP do site pode ficar estrito sem comprometer o produto.
- Compliance da sala (`ConsentModal`, `ComplianceBanner`) vive num único artefato — fácil auditar.
- Deploy independente: o site pode ser reaberto a uma agência ou refeito em headless CMS sem tocar o produto.
- Backend ganha sufixo `-service` consistente; abre caminho para outros `<contexto>-web` no monorepo (ex: `plexcare-schedule-web`).
- `plexcare-teleconf-web` é o único lugar com gotchas LiveKit no client (StrictMode condicional, memoização de props) — concentra conhecimento num CLAUDE.md dedicado.

**Negativas / Trade-offs**

- Duplicação inicial de design system (`src/components/ui/` cópia exata). Risco de drift até a promoção para `packages/ui/`.
- Time precisa rodar duas instâncias Vite (5173 + 5174) em dev se mexer nos dois — mitigado pelo `/up` slash command que cobre ambos.
- Tokens LiveKit ainda fluem via state navigation no client (`sessionStorage`). Não é o ideal — endpoint dedicado tipo `GET /rooms/:name/credentials` resolveria, fica como follow-up.
- Auth boundary "header `X-Tenant-Id` em dev" continua valendo até `plexcare-auth-api` existir — herda risco já registrado em [ADR-0002](0002-multi-tenancy-via-header-context.md) e issue #3.

**Neutras / a observar**

- Bundle do `plexcare-teleconf-web` é ~970 KB (280 KB gzip) com `livekit-client`. Lazy-import da rota `/rooms/:n/live` corta para ~280 KB no caminho Home/Dashboard — só vale fazer quando medirmos LCP fora do orçamento.
- A taxonomia agora exige `<tipo>` explícito (`-service`, `-web`). README raiz foi atualizado.

## Alternativas consideradas

### Manter `site/` como mono-app (status quo)
- **Prós:** zero refatoração, um deploy só, design system unificado por default.
- **Contras:** todos os problemas que motivaram este ADR (bundle, CSP, compliance ambíguo).
- **Por que não:** o RoomSandbox ia inevitavelmente virar produto. Adiar o split só aumentaria a dívida.

### Next.js (App Router) no `plexcare-teleconf-web` em vez de Vite + React Router
- **Prós:** SSR/middleware nativo, edge functions, mais aderente a OIDC com cookies.
- **Contras:** stack diferente do `site/` (overhead cognitivo), SSR é irrelevante pós-login, build mais complexo.
- **Por que não:** o produto é SPA pós-login — nenhuma rota precisa de SEO. Manter Vite reduz drift de stack com o `site/`.

### Extrair `packages/ui/` (workspace npm) já no bootstrap
- **Prós:** zero divergência de design system desde o dia 1.
- **Contras:** custo de setup (npm/pnpm workspaces, build tooling de pacote), duplica package.json/tsconfig, e ainda não temos prova de que site e web vão divergir.
- **Por que não:** YAGNI. Promover quando custar — cobertura via ADR-0004 quando chegar a hora.

## Plano de revisão

Esta decisão deve ser reavaliada se:

- `plexcare-teleconf-web` precisar de SSR (ex: link de entrada na sala virar shareable público que precise meta-tags dinâmicas) → migrar para Next.
- Site e web divergirem o suficiente para que sync manual do design system custe > 1 PR/semana → extrair `packages/ui/` (ADR-0004).
- Quando `plexcare-auth-api` existir → ADR-0005 redesenha o auth boundary (token efêmero → OIDC).
- Lighthouse mobile do `-web/` cair abaixo de 70 por causa do bundle → lazy-import da sala.

## Referências

- README raiz (taxonomia `<contexto>-<tipo>`)
- `platform/plexcare-teleconf-web/CLAUDE.md` (gotchas LiveKit no client)
- `platform/plexcare-teleconf-service/CLAUDE.md` (CORS env + endpoints)
- [ADR-0002](0002-multi-tenancy-via-header-context.md) — multi-tenancy via header (auth boundary atual)
- Memória: [[plexcare-monorepo-structure]], [[plexcare-livekit-dev-gotchas]]
