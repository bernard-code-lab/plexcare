# site — Marketing site (Vite + React 18)

> Carregado quando Claude trabalha em `site/**`. Veja também `../CLAUDE.md` (raiz) para contexto do produto.

## Antes de explorar o código — leia estes 6 arquivos

São os "load-bearing files" do site. Cobrem composição, design tokens e componentes-fundação. Qualquer task de UI começa por aqui:

| Arquivo | Por que importa |
|---|---|
| `src/App.jsx` | Composição da landing — ordem das seções e provider |
| `src/index.css` | Design tokens, fontes, animações com `prefers-reduced-motion` |
| `tailwind.config.js` | Cores reais, sombras, keyframes — fonte da verdade do tema |
| `src/lib/utils.js` | Helper `cn()` (clsx + tailwind-merge) usado em **toda** classe |
| `src/components/primitives.jsx` | Building blocks compartilhados (containers, headings) |
| `src/components/ui/aurora-background.jsx` | Background ambiente — referencia `var(--<cor>)` injetadas pelo Tailwind plugin |

## Pesquisa antes de ler

- Para "onde está o componente X?" → use `/graphify` primeiro. `Read` em arquivo inteiro só depois de localizar.
- Para token de cor / espaçamento → SEMPRE `tailwind.config.js` + `src/index.css`. Nunca chute hex.
- `site/sandbox/` (raiz, NÃO `src/sandbox/`) contém scaffolds antigos (`plexcare-backend/frontend/infra/sre`) — **ignore** ao buscar código real.
- `src/sandbox/RoomSandbox.jsx` é o **único** sandbox vivo — rota `#/sandbox/room?token=...&url=...` para smoke test de sala LiveKit. Guard `import.meta.env.PROD` desabilita em prod. Não confundir com `site/sandbox/`.

## O que é

Landing page de marketing da **Agenda Inteligente** (agendamento multicanal Google/iOS/WhatsApp + IA anti-no-show) para médicos, clínicas e advogados no Brasil. Não é o app SaaS — é o site público de aquisição.

## Stack

- **Vite 5** + **React 18** + **JavaScript** (não TS ainda — `jsconfig.json` para path alias)
- **Tailwind CSS v3** com tema customizado (dark-luxury: teal/dourado)
- **shadcn/ui** em `src/components/ui/` (Radix UI + cva)
- **Framer Motion** para animações
- **lucide-react** para ícones
- **react-day-picker** + **date-fns** para o demo scheduler

## Layout

```
site/
├── src/
│   ├── App.jsx              Composição das seções da landing
│   ├── main.jsx             Entry React
│   ├── index.css            Design tokens, fontes, utilities
│   ├── components/
│   │   ├── ui/              Componentes shadcn (Button, Avatar, etc.)
│   │   └── ...              Seções: Hero, CTA, etc.
│   └── lib/utils.js         cn() helper (clsx + tailwind-merge)
├── docs/ONBOARDING.md       Onboarding (não tocar sem motivo)
├── public/                  Estáticos (PWA, OG image, favicons)
├── tailwind.config.js
├── vite.config.js           Path alias @/ → src/
└── package.json
```

> `site/sandbox/` contém scaffolds antigos (`plexcare-backend/frontend/infra/sre`) que **não são parte do site** — vieram da migração para monorepo. Ignore ao editar; pode ser removido em cleanup futuro.

## Design system — não quebre

**Cores reais** (extraídas do `tailwind.config.js` — fonte da verdade):

| Token | Valor | Uso |
|---|---|---|
| `bg-background` / `ink-950` | `#04100E` | Fundo principal (dark-luxury) |
| `ink-900` / `ink-800` / `ink-700` | `#061613` → `#0E2A25` | Camadas de profundidade |
| `text-foreground` / `cream` | `#E9F4F1` | Corpo de texto |
| `text-mute` | `#8AA8A1` | Texto secundário |
| `teal-400` (primary) | `#2DD4BF` | CTA, foco, ring |
| `teal-500` | `#14B8A6` | Hover/destaque secundário |
| `gold-500` / `gold-400` | `#E09E1F` / `#F2B53B` | Acento dourado |
| `border` / `input` | `#15362F` | Bordas em superfícies escuras |

**Tipografia:** `font-display` = Cabinet Grotesk (títulos), `font-sans` = Switzer (corpo).
**Sombras assinatura:** `shadow-glow` (halo teal), `shadow-card` (depth interna).
**Efeitos:** film grain, vignette, `AuroraBackground` (componente custom).

Qualquer nova tela usa as classes Tailwind acima — **nunca** hex inline.

## Componentes custom não-óbvios

Estes UI components em `src/components/ui/` **não são shadcn padrão** — são autorais e têm contratos específicos:

| Componente | Comportamento |
|---|---|
| `aurora-background.jsx` | Background ambient via gradients animados; depende do plugin `addVariablesForColors` no Tailwind |
| `illuminated-hero.jsx` | Hero com spotlight + parallax; checa `prefers-reduced-motion` |
| `calendar-scheduler.jsx` | Demo interativo de agendamento (não é o produto real) — usa `react-day-picker` + `date-fns` |
| `glow-menu.jsx` | Menu com indicador animado entre items |
| `call-to-action-cta.jsx` | CTA principal — variantes via `cva` |

Componentes padrão shadcn (`button`, `card`, `input`, `avatar`, `calendar`) seguem o esperado.

## Convenções

- **Componentes shadcn:** props via interface explícita, variantes com `cva`, composição com Radix quando necessário.
- **Estado:** local-first. Nenhum global store sem justificativa.
- **Acessibilidade:** WCAG AA. Touch targets ≥ 44×44px. `aria-label` em ícones-only. Focus visível.
- **Animações:** sempre checar `prefers-reduced-motion` (ver utilitário no `index.css`).
- **Imagens:** WebP, `srcset`, `loading="lazy"`. Reservar espaço para evitar CLS.
- **Performance:** alvo Core Web Vitals "Good" (LCP < 2.5s, INP < 200ms, CLS < 0.1).

## Comandos

```bash
npm install
npm run dev          # http://localhost:5173 (HMR)
npm run build        # gera dist/
npm run preview      # serve o build local

# Verificações manuais antes de PR:
# 1. Abrir em browser e navegar nas seções principais
# 2. Lighthouse (mobile) ≥ 90 em performance e accessibility
# 3. Checar console limpo (sem warnings React/Vite)
```

> Não há suite de testes automatizada ainda. Quando for adicionar, use **Vitest + Testing Library** para unit e **Playwright** para E2E (alinhado ao agente E2E).

## Quando invocar agentes

- Tela ou componente novo → `/fullstack-engineer`
- Acessibilidade, contraste, motion → `/fullstack-engineer` (referencia `ui-ux-pro-max`)
- Decidir nova lib (state mgmt, animação) → `/solutions-architect`

## Do / Don't específicos

| ✅ Faça | ❌ Não faça |
|---|---|
| Usar `cn()` de `lib/utils.js` para classes | Concatenar strings de className |
| Adicionar `data-testid` em interativos | Confiar em texto visível para E2E |
| Importar via alias `@/components/...` | `../../components/...` |
| Manter componente leaf antes de container | Começar pelo container |
| Respeitar `prefers-reduced-motion` | Forçar animação em quem desabilitou |
