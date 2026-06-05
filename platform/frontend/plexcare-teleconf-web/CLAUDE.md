# plexcare-teleconf-web — App web da sala virtual (Vite + React 18)

> Carregado quando Claude trabalha em `platform/plexcare-teleconf-web/**`. Veja `../../CLAUDE.md` (raiz) para contexto do produto + compliance e `../plexcare-teleconf-service/CLAUDE.md` para a contraparte backend.

## Antes de explorar o código — leia estes 6 arquivos

São os "load-bearing files" do módulo. Cobrem composição, fluxo de sala, contrato com o backend e gotchas LiveKit. Qualquer task começa por aqui:

| Arquivo | Por que importa |
|---|---|
| `src/main.jsx` | Entry point — StrictMode **condicional** (off em rota live; ver gotcha 1) |
| `src/routes/router.jsx` | Mapa das 6 rotas — fluxo Home → New → Waiting → Live → Feedback |
| `src/pages/Room.jsx` | `<LiveKitRoom>` wrapping + memoização de props + onDisconnected → feedback |
| `src/pages/WaitingRoom.jsx` | ConsentModal + permissões mic/cam antes de liberar entrada |
| `src/components/ConsentModal.jsx` | Modal bloqueante LGPD/CFM — não remover sem ADR de compliance |
| `src/lib/api.js` | Cliente do `-service` (base URL via `VITE_TELECONF_SERVICE_URL`, injeta `X-Tenant-Id`) |

## Pesquisa antes de ler

- Para "onde está o componente X?" → use `/graphify` primeiro. `Read` em arquivo inteiro só depois.
- Para token de cor / espaçamento → SEMPRE `tailwind.config.js` + `src/index.css` (copiados do `site/`, ver gotcha 3).
- Para contratos HTTP → o backend é fonte da verdade: `../plexcare-teleconf-service/internal/room/infrastructure/http/handler.go`.

## O que é

Interface web do **produto sala virtual** — distinta do `site/` (institucional). Cobre:

- Login do médico (futuro — hoje aceita tenant dev via env)
- Criação de consulta (form que chama `POST /api/v1/rooms`)
- Waiting room com `ConsentModal` (LGPD + CFM 2.314) e pre-call checks (mic/cam)
- Sala LiveKit (`<LiveKitRoom>` + `<VideoConference>`)
- Post-call (feedback NPS + confirmação de consent registrado)
- Dashboard / histórico (consome `GET /api/v1/rooms` cursor-paginated)

## Stack

- **Vite 5** + **React 18** + **JavaScript** (path alias `@/` → `src/` via `jsconfig.json`)
- **react-router-dom v6** (`createBrowserRouter` — NÃO mais hash routing)
- **@livekit/components-react** + `livekit-client` + `@livekit/components-styles`
- **@radix-ui/react-dialog** (ConsentModal)
- **@tanstack/react-query** (Dashboard, futuras telas com dados remotos)
- **Tailwind CSS v3** com tema dark-luxury copiado do `site/`
- **shadcn/ui** em `src/components/ui/` (cópia inicial — promover para `packages/ui/` quando divergir)

## Layout

```
platform/plexcare-teleconf-web/
├── index.html
├── vite.config.js               porta fixa 5174 + alias @
├── tailwind.config.js           copiado do site/
├── postcss.config.js
├── jsconfig.json                path alias @/* → src/*
├── .env.example                 VITE_TELECONF_SERVICE_URL, VITE_LIVEKIT_URL, VITE_DEV_TENANT_ID
├── src/
│   ├── main.jsx                 StrictMode condicional (off em /rooms/:n/live)
│   ├── App.jsx                  Layout shell (Nav some na live)
│   ├── routes/router.jsx        createBrowserRouter
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── NewRoom.jsx          POST /api/v1/rooms
│   │   ├── WaitingRoom.jsx      ConsentModal + permissões
│   │   ├── Room.jsx             <LiveKitRoom> + onDisconnected → feedback
│   │   ├── PostCall.jsx         NPS + clearSession
│   │   └── Dashboard.jsx        GET /api/v1/rooms (cursor-paginated)
│   ├── components/
│   │   ├── Nav.jsx
│   │   ├── ConsentModal.jsx     LGPD + CFM 2.314 — bloqueante
│   │   ├── ComplianceBanner.jsx Banner persistente em telas de sala
│   │   └── ui/                  Cópia inicial do site (button, card, input, etc.)
│   ├── lib/
│   │   ├── api.js               fetch wrapper + X-Tenant-Id
│   │   ├── storage.js           sessionStorage para token entre rotas
│   │   ├── query-client.js      QueryClient
│   │   └── utils.js             cn() helper
│   └── index.css                Design tokens + Tailwind directives
```

## Contrato com o backend

| Endpoint | Quando |
|---|---|
| `POST /api/v1/rooms` | `NewRoom.jsx` cria sala, recebe `host_token`, `guest_token`, `livekit_name`, `expires_at` |
| `GET /api/v1/rooms?limit=&cursor=` | `Dashboard.jsx` lista salas do tenant (paginação cursor-based opaca) |
| **TODO** `POST /rooms/:name/consent` | Audit beacon ao aceitar `ConsentModal` |
| **TODO** `POST /rooms/:name/feedback` | NPS pós-consulta |

`X-Tenant-Id` é injetado automaticamente por `lib/api.js`. Em dev vem de `VITE_DEV_TENANT_ID`. Em prod virá do token de auth quando `plexcare-auth-api` existir.

## Compliance — não-negociável

`ConsentModal` é **bloqueante** antes de entrar na sala. Os 3 itens cobrem:
1. Identificação do paciente / responsável legal
2. Autorização do audit log (LGPD)
3. Ciência de gravação se ativada

`ComplianceBanner` (Res. CFM 2.314/2022 + LGPD) é visível em **toda** tela do fluxo de sala (waiting / live / feedback). Não remover sem ADR.

## Gotchas (não repetir)

1. **StrictMode + LiveKit é mortal na rota live.** Em dev o React StrictMode faz mount → unmount → mount; cada unmount dispara `room.disconnect()` e a negociação WebRTC entra em loop de reconexão (bug que já tomou ~2h em sessão anterior). Solução em `src/main.jsx`: detectar pathname `/rooms/:name/live` antes do `ReactDOM.createRoot` e renderizar **sem** `<StrictMode>` só nessa rota. Todas as outras mantêm StrictMode.

2. **Memoize props passados ao `<LiveKitRoom>`.** Strings ou booleans recriados a cada render fazem o LiveKit interpretar como prop changed → reconnect. `serverUrl` e `connect`/`video`/`audio` flags devem ser estáveis (ver `useMemo` em `Room.jsx`).

3. **Design system é cópia, não package.** `src/components/ui/`, `tailwind.config.js`, `src/lib/utils.js` e tokens em `index.css` vieram do `site/`. Quando ambos os apps começarem a divergir, promover para `packages/ui/` (workspace npm) — ADR-0004 (pendente).

4. **Porta dev fixa em 5174.** `vite.config.js` usa `strictPort: true` para falhar se ocupada — evita conflito silencioso com o `site/` em 5173. Se mudar, atualize também `CORS_ALLOWED_ORIGINS` no `plexcare-teleconf-service`.

5. **Bundle pesa ~970 KB (280 KB gzip).** O culpado é `livekit-client`. Otimização futura: lazy-import da rota `/rooms/:name/live` para que Home/Dashboard/NewRoom carreguem só ~200 KB. Não otimizar antes de medir.

6. **`sessionStorage`, não `localStorage`.** Token LiveKit é efêmero e some ao fechar a aba. `clearSession()` no PostCall garante limpeza ao terminar fluxo.

## Comandos

```bash
npm install
cp .env.example .env             # ajustar se backend/livekit não estão em localhost
npm run dev                       # http://localhost:5174

# Em outro terminal, subir o backend:
cd ../plexcare-teleconf-service && docker compose -f docker-compose.dev.yml up -d

# Build de produção
npm run build
npm run preview                   # serve dist/ local

# Verificações manuais antes de PR:
# 1. Home → New → Waiting → Live → Feedback (smoke do fluxo completo)
# 2. ConsentModal bloqueia entrada se algum checkbox desmarcado
# 3. Dashboard pagina (criar > 20 salas no -service)
# 4. Console limpo (sem warnings React/Vite/LiveKit)
```

## Quando invocar agentes

- Tela ou componente novo → `/fullstack-engineer`
- Integração LiveKit (qualidade, devices, gravação) → `/fullstack-engineer` (referencia gotcha 1)
- Decidir nova lib (state mgmt, animação) → `/solutions-architect`
- E2E (Playwright) → `/e2e-engineer`

## Do / Don't

| ✅ Faça | ❌ Não faça |
|---|---|
| `useMemo` nos props do `<LiveKitRoom>` | Passar literals/objects criados no render |
| `data-testid` em interativos | Confiar em texto visível para E2E |
| Import via `@/components/...` | `../../components/...` |
| `sessionStorage` para token | `localStorage` (vaza entre abas/sessões) |
| Reusar componentes do `site/` ao trazer | Reimplementar do zero antes de checar `src/components/ui/` |
| Atualizar `.env.example` ao adicionar env var | Esconder env var nova só no `.env` local |
