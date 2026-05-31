import { Reveal } from './primitives'

const STEPS = [
  {
    n: '01',
    title: 'Conecte sua agenda',
    desc: 'Sincronize Google Calendar, iOS e o número de WhatsApp da clínica em minutos. Sem migração dolorosa, sem trocar de sistema.',
  },
  {
    n: '02',
    title: 'A IA assume a conversa',
    desc: 'Cada paciente recebe confirmação e lembretes no canal certo. A IA responde dúvidas, reagenda e marca encaixes sozinha.',
    iris: true,
  },
  {
    n: '03',
    title: 'Veja as faltas caírem',
    desc: 'Agenda cheia, recepção livre e um painel que mostra exatamente quantas consultas — e quanto faturamento — foram salvos.',
  },
]

export default function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="relative scroll-mt-28 overflow-hidden py-24 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/3 top-1/2 -z-10 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-600/10 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-1/4 top-1/3 -z-10 h-[22rem] w-[22rem] rounded-full bg-gold-600/12 blur-[120px]"
      />
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">Como funciona</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display mt-6 text-3xl text-cream sm:text-[2.7rem]">
              No ar em uma tarde. Trabalhando para sempre.
            </h2>
          </Reveal>
        </div>

        <div className="relative mt-16 grid gap-5 md:grid-cols-3">
          {/* connecting line */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-[3.1rem] hidden h-px bg-gradient-to-r from-teal-400/10 via-gold-400/40 to-teal-400/10 md:block"
          />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1} y={26}>
              <div
                className={`glass relative h-full rounded-3xl p-7 ${
                  s.iris
                    ? 'border-gold-400/40 shadow-[0_0_0_1px_rgba(242,181,59,0.25),0_30px_70px_-30px_rgba(242,181,59,0.45)]'
                    : 'shadow-card'
                }`}
              >
                {s.iris && (
                  <span className="absolute right-5 top-5 rounded-full border border-gold-400/30 bg-gold-400/10 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-gold-300">
                    Inteligência
                  </span>
                )}
                <div className="flex items-center gap-4">
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br font-display text-lg font-bold text-ink-950 ${
                      s.iris
                        ? 'from-gold-200 via-gold-400 to-gold-600 shadow-[0_0_24px_-2px_rgba(242,181,59,0.8)] ring-2 ring-gold-300/40'
                        : 'from-teal-300 to-teal-600 shadow-glow'
                    }`}
                  >
                    {s.n}
                  </span>
                  <h3 className="font-display text-xl font-semibold tracking-tight text-cream">
                    {s.title}
                  </h3>
                </div>
                <p className="mt-4 text-[0.96rem] leading-relaxed text-mute">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
