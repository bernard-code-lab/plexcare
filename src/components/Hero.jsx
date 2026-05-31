import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Check, MessageCircle, Sparkles, Star } from 'lucide-react'
import { Reveal, Tilt } from './primitives'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const TRUSTED = [
  { src: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=80&h=80&fit=crop&crop=faces', fb: 'DR' },
  { src: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=80&h=80&fit=crop&crop=faces', fb: 'AC' },
  { src: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80&h=80&fit=crop&crop=faces', fb: 'MF' },
  { src: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=80&h=80&fit=crop&crop=faces', fb: 'JS' },
]

function AgendaMock() {
  const reduce = useReducedMotion()
  const slots = [
    { t: '08:30', name: 'Ana Ribeiro', tag: 'Confirmado', state: 'ok' },
    { t: '09:15', name: 'Carlos Menezes', tag: 'Confirmado', state: 'ok' },
    { t: '10:00', name: 'Encaixe — IA', tag: 'Sugerido', state: 'ai' },
    { t: '10:45', name: 'Júlia Tavares', tag: 'Lembrete enviado', state: 'pending' },
  ]

  return (
    <Tilt className="relative will-change-transform">
      {/* glow base */}
      <div className="absolute -inset-6 -z-10 rounded-[2.4rem] bg-teal-500/20 blur-3xl" aria-hidden="true" />
      <div
        className="absolute -right-10 -top-10 -z-10 h-40 w-40 rounded-full bg-gold-500/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="glass rounded-[1.8rem] p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-300" />
            <span className="text-sm font-medium text-cream/90">Terça, 14 mai</span>
          </div>
          <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 text-[0.68rem] font-medium text-teal-200">
            96% de comparecimento
          </span>
        </div>

        <div className="space-y-2">
          {slots.map((s, i) => (
            <motion.div
              key={s.t}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-3"
            >
              <span className="w-12 shrink-0 text-[0.78rem] tabular-nums text-mute">{s.t}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.92rem] font-medium text-cream">{s.name}</p>
                <p
                  className={`text-[0.72rem] ${
                    s.state === 'ok'
                      ? 'text-teal-300'
                      : s.state === 'ai'
                        ? 'text-gold-300'
                        : 'text-mute'
                  }`}
                >
                  {s.tag}
                </p>
              </div>
              <span
                className={`grid h-7 w-7 place-items-center rounded-full ${
                  s.state === 'ok'
                    ? 'bg-teal-400/15 text-teal-300'
                    : s.state === 'ai'
                      ? 'bg-gold-400/15 text-gold-300'
                      : 'bg-white/[0.05] text-mute'
                }`}
              >
                {s.state === 'ai' ? <Sparkles size={14} /> : <Check size={14} strokeWidth={2.6} />}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating WhatsApp AI card */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`absolute -bottom-7 -left-4 w-[15.5rem] sm:-left-10 ${reduce ? '' : 'animate-floaty'}`}
      >
        <div className="glass rounded-2xl p-3.5 shadow-glow">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#25D366]/15 text-[#25D366]">
              <MessageCircle size={15} fill="currentColor" stroke="none" />
            </span>
            <span className="text-[0.74rem] font-medium text-cream/90">WhatsApp · IA PlexCare</span>
          </div>
          <p className="text-[0.78rem] leading-snug text-cream/80">
            Olá, Júlia! Confirma sua consulta de amanhã às 10:45? Responda <b className="text-teal-200">1</b> para
            confirmar.
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-teal-400/12 px-2.5 py-1 text-[0.68rem] font-medium text-teal-200">
            <Check size={12} strokeWidth={3} /> Confirmado em 2 min
          </div>
        </div>
      </motion.div>
    </Tilt>
  )
}

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 sm:pt-40">
      {/* atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14rem] h-[34rem] w-[44rem] -translate-x-1/2 rounded-full bg-teal-500/18 blur-[120px]" />
        <div className="absolute right-[-10rem] top-[6rem] h-[26rem] w-[26rem] rounded-full bg-gold-500/14 blur-[120px]" />
        <div className="absolute left-[-8rem] top-[20rem] h-[22rem] w-[22rem] rounded-full bg-gold-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-screen grain"
          style={{ backgroundSize: '180px' }}
        />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(150,240,222,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(150,240,222,0.05) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 60% 50% at 50% 30%, #000 0%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 30%, #000 0%, transparent 75%)',
          }}
        />
      </div>

      <div className="container-page grid items-center gap-14 pb-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div>
          <Reveal>
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300" /> Agenda Inteligente · PlexCare
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="display mt-6 text-[2.7rem] text-cream sm:text-6xl lg:text-[4.2rem]">
              A agenda que combate o <span className="text-gradient">no-show</span> sozinha.
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-6 max-w-xl text-[1.06rem] leading-relaxed text-mute">
              Agendamento multicanal pelo Google, iOS e WhatsApp — com uma IA que confirma, lembra e reagenda
              automaticamente. O coração operacional da sua clínica, sem planilha e sem ligação manual.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#precos" className="btn-primary">
                Começar agora
                <ArrowUpRight size={18} strokeWidth={2.4} />
              </a>
              <a href="#como-funciona" className="btn-ghost">
                Ver como funciona
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.32}>
            <div className="mt-9 flex items-center gap-4">
              <div className="flex -space-x-2.5">
                {TRUSTED.map((p, i) => (
                  <Avatar key={i} className="h-9 w-9 ring-2 ring-ink-950">
                    <AvatarImage src={p.src} alt={`Profissional de saúde ${i + 1}`} />
                    <AvatarFallback className="bg-teal-600 text-[0.7rem] font-semibold text-ink-950">
                      {p.fb}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 text-teal-300">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} fill="currentColor" stroke="none" />
                  ))}
                </div>
                <p className="text-[0.82rem] text-mute">
                  <b className="text-cream">+1.200</b> profissionais de saúde já usam
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2} y={30}>
          <AgendaMock />
        </Reveal>
      </div>
    </section>
  )
}
