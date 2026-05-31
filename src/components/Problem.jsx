import { Reveal, Counter } from './primitives'

export default function Problem() {
  return (
    <section className="container-page py-24 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
        <div>
          <Reveal>
            <span className="eyebrow">O custo silencioso</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display mt-6 text-3xl text-cream sm:text-[2.7rem]">
              Cada falta é uma cadeira vazia que você já pagou.
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-lg text-[1.02rem] leading-relaxed text-mute">
              Lembrete manual cansa a recepção, depende de ligação e ainda assim falha. O resultado é uma agenda
              furada, receita que evapora e horários que poderiam ser de outro paciente.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="mt-6 text-[1.02rem] leading-relaxed text-cream/90">
              A PlexCare assume essa conversa por você — no canal que o paciente realmente lê.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12} y={28}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { n: 30, suffix: '%', label: 'da agenda perdida com faltas em média' },
              { n: 4, suffix: 'h', label: 'por dia gastas confirmando manualmente' },
              { n: 62, suffix: '%', label: 'menos faltas com confirmação por IA', accent: true },
              { n: 18, suffix: 'h', label: 'devolvidas ao time todo mês' },
            ].map((s, i) => (
              <div
                key={i}
                className={`glass rounded-3xl p-6 ${s.accent ? 'shadow-glow' : 'shadow-card'}`}
              >
                <div
                  className={`font-display text-4xl font-semibold tracking-tight sm:text-5xl ${
                    s.accent ? 'text-gradient-gold' : 'text-cream'
                  }`}
                >
                  <Counter to={s.n} suffix={s.suffix} />
                </div>
                <p className="mt-3 text-[0.86rem] leading-snug text-mute">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
