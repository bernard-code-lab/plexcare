# site — Marketing site (Vite + React 18)

> Carregado quando Claude trabalha em `site/**`. Veja também `../CLAUDE.md` (raiz) para contexto do produto.

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

| Token | Valor |
|---|---|
| Cor primária | teal `#14B8A6` e variações |
| Cor destaque | dourado/amber `#E3B341` |
| Fundo | quase-preto `#020807`, `#0D1117` |
| Títulos | Cabinet Grotesk |
| Corpo | Switzer |
| Efeitos | film grain, vignette, aurora-background |

Detalhes completos em `tailwind.config.js` e `src/index.css`. Qualquer nova tela respeita esses tokens.

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
