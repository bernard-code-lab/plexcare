# PlexCare — Agenda Inteligente

Landing page premium da **Agenda Inteligente** da PlexCare: agendamento multicanal (Google, iOS e WhatsApp) com IA anti-no-show, para médicos, clínicas e advogados no Brasil.

## Stack

- **Vite** + **React 18**
- **Tailwind CSS v3**
- **Framer Motion** (animações / reveals com respeito a `prefers-reduced-motion`)
- **lucide-react** (ícones SVG)
- Componentes em `src/components/ui/` no padrão shadcn (alias `@/` → `src/`)

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run preview  # serve o build
```

## Estrutura

- `src/App.jsx` — composição das seções da landing
- `src/components/` — seções (Hero, Features, Pricing, CTA, FAQ, ...)
- `src/components/ui/` — componentes reutilizáveis (avatar, button, input, aurora-background, illuminated-hero, call-to-action-cta)
- `src/index.css` — tema (cores teal/dourado, tipografia Cabinet Grotesk + Switzer), keyframes e efeitos

## Rotas

- `/` — site principal
- `/#/showcase` — showcase isolado do componente IlluminatedHero
