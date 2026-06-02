<p align="center">
  <img src="https://img.shields.io/badge/vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/tailwind-3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind 3" />
  <img src="https://img.shields.io/badge/framer--motion-animations-FF0055" alt="Framer Motion" />
</p>

# PlexCare — Site

Marketing site da PlexCare: landing page da **Agenda Inteligente** com agendamento multicanal (Google, iOS e WhatsApp) e IA anti-no-show, para medicos, clinicas e advogados no Brasil.

---

## Stack

| Tecnologia | Uso |
|---|---|
| **Vite + React 18** | Build e runtime |
| **Tailwind CSS v3** | Estilizacao com tema customizado |
| **Framer Motion** | Animacoes com respeito a `prefers-reduced-motion` |
| **shadcn/ui** | Componentes em `src/components/ui/` |
| **Radix UI** | Primitives headless (avatar, slot) |
| **lucide-react** | Icones SVG |

## Design System

| Propriedade | Valor |
|---|---|
| Cor primaria | teal `#14B8A6` |
| Cor de destaque | dourado `#E3B341` |
| Fundo | quase-preto `#020807`, `#0D1117` |
| Titulos | Cabinet Grotesk |
| Corpo | Switzer |
| Efeitos | film grain, vignette, aurora-background |

## Desenvolvimento Local

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/
npm run preview    # serve o build
```

## Estrutura

```
site/
  src/
    App.jsx                    Composicao das secoes da landing
    index.css                  Tema, keyframes, efeitos
    components/
      Hero.jsx                 Hero section
      Features.jsx             Features grid
      Pricing.jsx              Planos e precos
      CTA.jsx                  Call to action
      Nav.jsx                  Navegacao responsiva
      DemoScheduler.jsx        Agendamento de demo
      ui/                      Componentes reutilizaveis (shadcn)
        avatar.jsx
        button.jsx
        calendar.jsx
        card.jsx
        glow-menu.jsx
        aurora-background.jsx
        call-to-action-cta.jsx
  public/                      PWA assets, favicon, manifest
  docs/
    ONBOARDING.md              Guia de onboarding do projeto
```

## Rotas

| Rota | Descricao |
|---|---|
| `/` | Site principal |
| `/#/showcase` | Showcase isolado do IlluminatedHero |
