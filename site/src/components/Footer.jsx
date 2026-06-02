import { Logo } from './primitives'

const COLS = [
  {
    title: 'Plataforma',
    links: ['Agenda Inteligente', 'Laudo Digital', 'Teleconsulta', 'IA para Saúde'],
  },
  {
    title: 'Empresa',
    links: ['Sobre a PlexCare', 'Segurança e LGPD', 'Carreiras', 'Contato'],
  },
  {
    title: 'Recursos',
    links: ['Central de ajuda', 'Status', 'API & Docs', 'Blog'],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="container-page py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[0.94rem] leading-relaxed text-mute">
              A plataforma vertical de saúde que começa na agenda e vai até o laudo com validade jurídica. Tech
              brasileira, posicionamento premium.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLS.map((c) => (
              <div key={c.title}>
                <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-cream/80">
                  {c.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-[0.92rem] text-mute transition-colors duration-200 hover:text-cream cursor-pointer"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-7 sm:flex-row sm:items-center">
          <p className="text-[0.82rem] text-mute">
            © {new Date().getFullYear()} PlexCare Tecnologia. Feito no Brasil.
          </p>
          <div className="flex items-center gap-6 text-[0.82rem] text-mute">
            <a href="#" className="transition-colors hover:text-cream cursor-pointer">
              Privacidade
            </a>
            <a href="#" className="transition-colors hover:text-cream cursor-pointer">
              Termos
            </a>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_10px_2px_rgba(45,212,191,0.6)]" />
              Todos os sistemas no ar
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
