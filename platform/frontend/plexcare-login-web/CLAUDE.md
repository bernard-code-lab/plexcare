# plexcare-login-web — IdP / Single sign-on UI (Vite + React 18)

> Carregado quando Claude trabalha em `platform/frontend/plexcare-login-web/**`. Veja `../../../CLAUDE.md` (raiz) para contexto do produto + compliance.

## Antes de explorar o código — leia estes 6 arquivos

São os "load-bearing files" do módulo:

| Arquivo | Por que importa |
|---|---|
| `src/main.jsx` | Entry — RouterProvider + StrictMode |
| `src/routes/router.jsx` | Mapa das 6 rotas — `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/account/password`, `*` |
| `src/lib/auth.js` | Cliente do IdP (POST /auth/*) + `AuthError` tipado + redirect OIDC para providers sociais |
| `src/components/AuthShell.jsx` | Layout 2-colunas (BrandPanel + form) — wrapper de todas as telas |
| `src/components/BrandPanel.jsx` | Painel à esquerda (lg+) com marca, eyebrow, selos LGPD/CFM, aurora glow |
| `src/components/SocialButtons.jsx` | Google/Apple/Microsoft → `auth.socialRedirect(provider)` (Keycloak `kc_idp_hint`) |

## O que é

UI única de **identidade** da PlexCare — o único entrypoint visual de login/cadastro/recuperação para todos os apps web do ecossistema (`plexcare-teleconf-web`, futuros `plexcare-schedule-web`, etc.). Após autenticação bem-sucedida, redireciona para a query `?redirect=...` ou para `VITE_DEFAULT_REDIRECT_URI`.

Telas:

| Rota | Tela | Estado |
|---|---|---|
| `/login` | Login (email + senha + social) | Stub, integra com `VITE_AUTH_API_URL` |
| `/signup` | Cadastro com força de senha + aceite Termos/LGPD | Stub |
| `/forgot-password` | Solicitar link de redefinição | Resposta neutra (não enumera contas) |
| `/reset-password?token=…` | Definir nova senha via link | Valida token presente |
| `/account/password` | Trocar senha (logado) | Pendente de guard de sessão |
| `*` | 404 | OK |

## Stack

- **Vite 5** + **React 18** + **JavaScript** (path alias `@/` → `src/`)
- **react-router-dom v6** (`createBrowserRouter`)
- **Tailwind CSS v3** com tema dark-luxury (cópia do `site/`)
- **shadcn/ui** mínimo em `src/components/ui/` (button, card, input, label, alert, checkbox)
- **@radix-ui/react-label** (a11y) + **@radix-ui/react-slot** (`asChild`)
- **lucide-react** (ícones) + **framer-motion** (futuras micro-interações)
- Zero deps de gerenciamento de form — `useState` + validação inline (mantém bundle enxuto: 87 KB gzip)

## Layout

```
platform/frontend/plexcare-login-web/
├── index.html
├── vite.config.js               porta fixa 5175 + alias @
├── tailwind.config.js           tema dark-luxury (espelha o site)
├── postcss.config.js
├── jsconfig.json
├── .env.example                 VITE_AUTH_API_URL, VITE_OIDC_*, VITE_ENABLE_GOOGLE/APPLE/MICROSOFT
├── src/
│   ├── main.jsx
│   ├── App.jsx                  Shell mínimo (Outlet); cada página usa AuthShell
│   ├── index.css                Tokens, .glass, .btn-primary, prefers-reduced-motion
│   ├── routes/router.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── ResetPassword.jsx
│   │   ├── ChangePassword.jsx
│   │   └── NotFound.jsx
│   ├── components/
│   │   ├── AuthShell.jsx        layout 2-colunas
│   │   ├── BrandPanel.jsx       painel esquerdo com selos compliance
│   │   ├── Logo.jsx             wordmark Plex + Care (gradient gold)
│   │   ├── SocialButtons.jsx
│   │   ├── PasswordInput.jsx    toggle show/hide acessível
│   │   ├── PasswordStrength.jsx meter 0-4 sem libs externas
│   │   ├── FormField.jsx        label + erro + hint, ids consistentes
│   │   ├── Divider.jsx
│   │   └── ui/                  shadcn primitives (button, card, input, label, alert, checkbox)
│   └── lib/
│       ├── auth.js              cliente HTTP + AuthError tipado + OIDC redirect
│       ├── password.js          scorePassword() (heurística OWASP-leve)
│       └── utils.js             cn() helper (clsx + tailwind-merge)
```

## Contrato com o backend (`plexcare-idp-api`)

Hoje o `plexcare-idp-api` está vazio (apenas diretório). Quando subir, deve expor:

| Endpoint | Payload | Sucesso | Erros tipados |
|---|---|---|---|
| `POST /auth/login` | `{ email, password }` | `{ accessToken, refreshToken }` | `invalid-credentials`, `account-locked` |
| `POST /auth/signup` | `{ name, email, password, organization? }` | `202` (verificação por email) | `email-in-use` |
| `POST /auth/forgot-password` | `{ email }` | `204` neutro (sempre) | — |
| `POST /auth/reset-password` | `{ token, password }` | `204` | `token-invalid`, `token-expired` |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` (cookie/sessão) | `204` | `invalid-credentials` |

`fetch` usa `credentials: 'include'` para suportar cookies HttpOnly do BFF. CORS no IdP deve permitir `http://localhost:5175` em dev.

Como atalho, login social vai **direto** para Keycloak via `auth.socialRedirect(provider)` usando `kc_idp_hint` (sem passar pelo BFF) — o redirect cai no app destino com o `code` OIDC.

## Compliance — não-negociável

- O **aceite explícito** de Termos + Política de Privacidade no `/signup` é **bloqueante** (LGPD art. 7º, I). Não remover sem ADR.
- A resposta de `/forgot-password` é **neutra**: nunca confirma se o e-mail existe (evita account enumeration).
- Senhas: mínimo 12 chars + variedade (≥3 categorias) → `scorePassword().score >= 2`. Alinhado a OWASP ASVS L1.
- Após `reset-password` e `change-password` o IdP deve **invalidar** todas as sessões ativas; a UI já comunica isso ao usuário.
- Nenhum token é persistido neste app — após login, redirecionamos para o app destino que recebe os cookies do BFF ou o `code` OIDC.

## Gotchas (não repetir)

1. **Porta dev fixa em 5175.** `vite.config.js` usa `strictPort: true` para falhar se ocupada — evita colisão silenciosa com `site/` (5173) e `teleconf-web/` (5174). Atualizar `CORS_ALLOWED_ORIGINS` no `plexcare-idp-api` se mudar.

2. **Design system é cópia.** `tailwind.config.js`, `src/lib/utils.js`, `src/components/ui/`, tokens em `index.css` vieram do `site/`. Quando teleconf-web + login-web + futuros começarem a divergir, promover para `packages/ui/` (workspace npm) — ADR-0004 (pendente).

3. **`credentials: 'include'` em todo `fetch`.** O BFF coloca o cookie de sessão como `HttpOnly + SameSite=Lax + Secure`. Sem `credentials: 'include'` os cookies não viajam e o usuário "loga mas não loga".

4. **Login social não passa pelo BFF.** `auth.socialRedirect()` envia o navegador direto para Keycloak (`/realms/plexcare/protocol/openid-connect/auth?kc_idp_hint=...`). O `redirect_uri` é a SPA destino, **não** este IdP — caso contrário criamos um pingue-pongue.

5. **`scorePassword` é heurística simples** (sem zxcvbn). Suficiente para feedback inline; a validação canônica fica no backend. Não é fingerprint de força real para política corporativa.

6. **Resposta neutra do forgot-password é intencional.** Mesmo se a chamada de API falhar, exibimos "se houver conta, você receberá um link" — não vaze a existência do e-mail.

## Comandos

```bash
npm install
cp .env.example .env             # ajustar VITE_AUTH_API_URL e VITE_OIDC_*
npm run dev                       # http://localhost:5175

# Build de produção
npm run build                     # → dist/  (~272 KB JS, ~87 KB gzip; ~23 KB CSS)
npm run preview                   # serve dist/ local

# Verificações manuais antes de PR:
# 1. /login → e-mail inválido bloqueia submit; submit válido tenta API
# 2. /signup → meter de senha sobe; aceite de Termos é obrigatório
# 3. /forgot-password → resposta neutra mesmo em erro de rede
# 4. /reset-password sem ?token= → tela de "link inválido"
# 5. /account/password → bloqueia se nova == atual
# 6. Console limpo (sem warnings React/Vite/a11y)
# 7. Tab order acessível em todas as telas; Esc fecha foco (futuro)
```

## Quando invocar agentes

- Tela ou ajuste visual → `/fullstack-engineer`
- Contrato API com IdP / Keycloak → `/solutions-architect`
- Test cases por tela (login feliz, errors, reset com token expirado) → `/qa-engineer`
- E2E Playwright (jornada completa cadastro→verificação→login) → `/e2e-engineer`
- Helm/deploy do IdP UI (estático em S3+CloudFront, por ex.) → `/devops-platform-engineer`

## Do / Don't

| ✅ Faça | ❌ Não faça |
|---|---|
| `credentials: 'include'` em chamadas ao BFF | Esperar cookie funcionar sem isso |
| `AuthError` tipado com `code` | `throw new Error('texto')` em hot paths |
| Resposta neutra em forgot/login para casos sensíveis | Mensagem "conta não existe" |
| `data-testid` em interativos | Selecionar por texto em E2E |
| Atualizar `.env.example` ao adicionar var | Esconder env nova só no `.env` local |
| Reusar `AuthShell` + `FormField` em telas novas | Reimplementar layout 2-colunas do zero |
| Validar score ≥ 2 no client; backend re-valida | Aceitar senha fraca confiando no client |
