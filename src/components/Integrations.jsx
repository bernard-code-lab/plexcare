import { motion, useReducedMotion } from 'framer-motion'
import { CalendarCheck } from 'lucide-react'
import { Reveal } from './primitives'

/* Inline brand glyphs (SVG, not emoji) */
function GoogleCal() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" />
      <rect x="3" y="4" width="18" height="4.5" rx="2" fill="#4285F4" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#4285F4" fontFamily="Arial">
        31
      </text>
    </svg>
  )
}
function Apple() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="#E9F4F1" aria-hidden="true">
      <path d="M16.5 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.15-2.8.85-3.5.85-.7 0-1.85-.83-3-.8-1.55.02-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.78 1.1 1.7 2.4 2.9 2.35 1.16-.05 1.6-.75 3-.75s1.8.75 3 .73c1.24-.02 2.02-1.14 2.78-2.25.87-1.27 1.23-2.5 1.25-2.56-.03-.01-2.4-.92-2.4-3.65zM14.3 5.9c.63-.77 1.06-1.84.94-2.9-.9.04-2 .6-2.65 1.36-.58.68-1.1 1.77-.96 2.8 1 .08 2.03-.5 2.67-1.26z" />
    </svg>
  )
}
function WhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="25" height="25" fill="#25D366" aria-hidden="true">
      <path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1112 20zm4.5-5.9c-.25-.13-1.47-.72-1.7-.8-.23-.08-.4-.13-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.4-.41-.56-.42h-.48c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.16 1.73 2.64 4.2 3.7.59.25 1.04.4 1.4.52.59.18 1.12.16 1.54.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  )
}

const ITEMS = [
  { name: 'Google Calendar', desc: 'Sincronização bidirecional em tempo real.', Glyph: GoogleCal },
  { name: 'Apple / iOS', desc: 'Calendário nativo no iPhone e no iPad.', Glyph: Apple },
  { name: 'WhatsApp Business', desc: 'IA conversacional no canal mais aberto do Brasil.', Glyph: WhatsApp },
]

export default function Integrations() {
  const reduce = useReducedMotion()
  return (
    <section id="integracoes" className="container-page scroll-mt-28 py-24 sm:py-28">
      <div className="glass relative overflow-hidden rounded-[2rem] p-8 shadow-card sm:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-teal-500/14 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-gold-600/12 blur-3xl"
        />
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <Reveal>
              <span className="eyebrow">Integrações nativas</span>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="display mt-6 text-3xl text-cream sm:text-[2.5rem]">
                Conecta com o que sua clínica já usa.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-5 max-w-md text-[1.02rem] leading-relaxed text-mute">
                Nada de obrigar paciente ou equipe a aprender outra ferramenta. A PlexCare entra por cima do que já
                funciona e unifica tudo numa só visão.
              </p>
            </Reveal>
          </div>

          <div className="space-y-3.5">
            {ITEMS.map((it, i) => (
              <motion.div
                key={it.name}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-colors duration-300 hover:border-teal-300/30"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.04]">
                  <it.Glyph />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[1.05rem] font-semibold text-cream">{it.name}</p>
                  <p className="text-[0.88rem] text-mute">{it.desc}</p>
                </div>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-teal-400/12 px-3 py-1.5 text-[0.72rem] font-medium text-teal-200">
                  <CalendarCheck size={13} /> Ativo
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
