import { useRef } from 'react'
import { motion, useReducedMotion, useSpring, useMotionValue } from 'framer-motion'
import {
  Bot,
  CalendarCheck,
  MessageCircle,
  Clock4,
  ShieldCheck,
  Wand2,
} from 'lucide-react'
import { Reveal, SectionGlow, Spotlight } from './primitives'

function Card({ icon: Icon, title, desc, className = '', accent = 'teal', children }) {
  const isIris = accent === 'iris'
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 })
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 })

  function onMove(e) {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 4)
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 4)
  }
  function reset() {
    rx.set(0)
    ry.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      className={`group glass relative overflow-hidden rounded-3xl p-6 shadow-card transition-colors duration-300 will-change-transform sm:p-7 ${
        isIris ? 'hover:border-gold-300/30' : 'hover:border-teal-300/30'
      } ${className}`}
    >
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${
          isIris ? 'bg-gold-500/14' : 'bg-teal-500/10'
        }`}
      />
      <Spotlight tone={isIris ? 'rgba(247,207,114,0.13)' : 'rgba(94,234,212,0.14)'} />
      <span
        className={`grid h-11 w-11 place-items-center rounded-xl border transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${
          isIris
            ? 'border-gold-400/25 bg-gold-400/[0.1] text-gold-300'
            : 'border-teal-400/20 bg-teal-400/[0.08] text-teal-300'
        }`}
      >
        <Icon size={20} strokeWidth={1.9} />
      </span>
      <h3 className="mt-5 font-display text-xl font-semibold tracking-tight text-cream">{title}</h3>
      <p className="mt-2.5 text-[0.95rem] leading-relaxed text-mute">{desc}</p>
      {children}
    </motion.div>
  )
}

function ChannelViz() {
  const reduce = useReducedMotion()
  const items = [
    { label: 'Google Calendar', c: '#4285F4' },
    { label: 'Apple / iOS', c: '#E9F4F1' },
    { label: 'WhatsApp', c: '#25D366' },
  ]
  return (
    <div className="mt-6 space-y-2.5">
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          initial={reduce ? false : { opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.c }} />
          <span className="text-[0.86rem] text-cream/85">{it.label}</span>
          <span className="ml-auto text-[0.7rem] text-teal-300">sincronizado</span>
        </motion.div>
      ))}
    </div>
  )
}

export default function Features() {
  return (
    <section id="recursos" className="relative container-page scroll-mt-28 py-24 sm:py-28">
      <SectionGlow tone="teal" position="left-[10%] top-[22%]" size="h-[28rem] w-[28rem]" />
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <span className="eyebrow">Tudo em um só lugar</span>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="display mt-6 text-3xl text-cream sm:text-[2.7rem]">
            Uma central de agendamento que pensa com você.
          </h2>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-5 text-[1.02rem] leading-relaxed text-mute">
            Da primeira mensagem ao encaixe de última hora, a IA cuida do operacional para o seu time cuidar do
            paciente.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        <Reveal className="md:col-span-2" y={26}>
          <Card
            icon={CalendarCheck}
            title="Agendamento multicanal"
            desc="Google, iOS e WhatsApp falando a mesma língua. O paciente marca por onde preferir e tudo cai numa agenda única, em tempo real, sem conflito de horário."
            className="h-full"
          >
            <ChannelViz />
          </Card>
        </Reveal>

        <Reveal delay={0.08} y={26}>
          <Card
            icon={Bot}
            title="IA anti-falta"
            desc="Confirma, lembra e identifica quem provavelmente vai faltar — agindo antes do horário vago acontecer."
            className="h-full"
            accent="iris"
          />
        </Reveal>

        <Reveal delay={0.04} y={26}>
          <Card
            icon={MessageCircle}
            title="Confirmação no WhatsApp"
            desc="Conversa natural que confirma em segundos e libera a recepção do telefone."
            className="h-full"
          />
        </Reveal>

        <Reveal delay={0.08} y={26}>
          <Card
            icon={Wand2}
            title="Encaixe inteligente"
            desc="Cancelou? A IA oferece a vaga para a fila de espera e preenche o buraco automaticamente."
            className="h-full"
            accent="iris"
          />
        </Reveal>

        <Reveal delay={0.12} y={26}>
          <Card
            icon={Clock4}
            title="Lembretes que adaptam"
            desc="Cadência e tom ajustados por perfil de paciente, com a frequência certa — nem demais, nem de menos."
            className="h-full"
          />
        </Reveal>

        <Reveal className="md:col-span-3" delay={0.04} y={26}>
          <div className="group glass relative h-full overflow-hidden rounded-3xl p-6 shadow-card transition-colors duration-300 hover:border-teal-300/30 sm:p-7 md:flex md:items-center md:gap-10">
            <Spotlight tone="rgba(94,234,212,0.14)" />
            <div className="flex items-start gap-4 md:flex-1">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-teal-400/20 bg-teal-400/[0.08] text-teal-300 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <ShieldCheck size={20} strokeWidth={1.9} />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-cream">
                  Pronta para a saúde brasileira
                </h3>
                <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-mute">
                  Consentimento eletrônico, trilha de auditoria e dados em conformidade com a LGPD e a Resolução
                  CFM 2.314/2022. E quando precisar de laudo com validade jurídica, o ecossistema PlexCare já está
                  ao lado.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 md:mt-0 md:max-w-[36%] md:shrink-0 md:justify-end">
              {['LGPD', 'CFM 2.314/2022', 'ICP-Brasil', 'Trilha de auditoria'].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-teal-400/20 bg-teal-400/[0.07] px-3 py-1.5 text-[0.78rem] font-medium text-teal-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
