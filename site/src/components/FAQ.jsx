import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Reveal } from './primitives'

const ITEMS = [
  {
    q: 'Preciso trocar o sistema que já uso?',
    a: 'Não. A PlexCare se conecta por cima do Google Calendar, do iOS e do seu WhatsApp. Em geral você está no ar na mesma tarde, sem migração de dados dolorosa.',
  },
  {
    q: 'Como a IA reduz as faltas de verdade?',
    a: 'Ela confirma e lembra cada paciente no canal que ele realmente abre, conversa de forma natural para tirar dúvidas e reagendar, e identifica quem tem alto risco de faltar para agir antes — oferecendo o horário à fila de espera quando há cancelamento.',
  },
  {
    q: 'É seguro e está em conformidade com a LGPD?',
    a: 'Sim. Coletamos consentimento eletrônico, mantemos trilha de auditoria e seguimos a LGPD e a Resolução CFM 2.314/2022. Tudo é criptografado em trânsito e em repouso.',
  },
  {
    q: 'E quando eu precisar emitir laudo com validade jurídica?',
    a: 'A Agenda é a porta de entrada do ecossistema PlexCare. Quando precisar, você ativa o Laudo Digital com assinatura ICP-Brasil e a Teleconsulta — tudo no mesmo lugar, com o contexto clínico já registrado.',
  },
  {
    q: 'Funciona para uma clínica com vários profissionais?',
    a: 'Sim. O plano Clínica cobre equipes e o Enterprise atende redes multi-unidade, com white-label, SSO e API Embed para quem quer levar a agenda para dentro do próprio produto.',
  },
]

function Row({ item, index }) {
  const [open, setOpen] = useState(false)
  return (
    <Reveal delay={index * 0.05}>
      <div className="glass overflow-hidden rounded-2xl shadow-card">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
          aria-expanded={open}
        >
          <span className="font-display text-[1.05rem] font-medium tracking-tight text-cream">{item.q}</span>
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.25 }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-teal-300"
          >
            <Plus size={16} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="px-6 pb-6 text-[0.96rem] leading-relaxed text-mute">{item.a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  )
}

export default function FAQ() {
  return (
    <section className="container-page py-24 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <Reveal>
            <span className="eyebrow">Dúvidas frequentes</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display mt-6 text-3xl text-cream sm:text-[2.5rem]">
              Tudo que você quer saber antes de começar.
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 text-[1rem] leading-relaxed text-mute">
              Ainda com perguntas?{' '}
              <a href="#precos" className="text-teal-300 underline-offset-4 hover:underline cursor-pointer">
                Fale com a gente
              </a>{' '}
              e veja a PlexCare rodando na sua agenda.
            </p>
          </Reveal>
        </div>

        <div className="space-y-3">
          {ITEMS.map((it, i) => (
            <Row key={it.q} item={it} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
