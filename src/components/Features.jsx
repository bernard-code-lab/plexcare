import { motion, useReducedMotion } from 'framer-motion'
import {
  Bot,
  CalendarCheck,
  MessageCircle,
  Clock4,
  ShieldCheck,
  Wand2,
} from 'lucide-react'
import { Reveal } from './primitives'

function Card({ icon: Icon, title, desc, className = '', accent = 'teal', children }) {
  const isIris = accent === 'iris'
  return (
    <div
      className={`group glass relative overflow-hidden rounded-3xl p-6 shadow-card transition-colors duration-300 sm:p-7 ${
        isIris ? 'hover:border-gold-300/30' : 'hover:border-teal-300/30'
      } ${className}`}
    >
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${
          isIris ? 'bg-gold-500/14' : 'bg-teal-500/10'
        }`}
      />
      <span
        className={`grid h-11 w-11 place-items-center rounded-xl border ${
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
    </div>
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
    <section id="recursos" className="container-page scroll-mt-28 py-24 sm:py-28">
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
          <Card
            icon={ShieldCheck}
            title="Pronta para a saúde brasileira"
            desc="Consentimento eletrônico, trilha de auditoria e dados em conformidade com a LGPD e a Resolução CFM 2.314/2022. E quando precisar de laudo com validade jurídica, o ecossistema PlexCare já está ao lado."
            className="h-full md:flex md:items-center md:justify-between md:gap-8"
          >
            <div className="mt-5 flex flex-wrap gap-2 md:mt-0 md:shrink-0">
              {['LGPD', 'CFM 2.314/2022', 'ICP-Brasil', 'Trilha de auditoria'].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-teal-400/20 bg-teal-400/[0.07] px-3 py-1.5 text-[0.78rem] font-medium text-teal-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  )
}
