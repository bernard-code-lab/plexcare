import { Reveal, Counter, SectionGlow } from './primitives'

export default function Testimonial() {
  return (
    <section className="relative container-page py-20 sm:py-24">
      <SectionGlow tone="teal" position="left-[18%] top-1/4" size="h-[24rem] w-[30rem]" />
      <Reveal y={26}>
        <figure className="glass relative overflow-hidden rounded-[2rem] p-8 shadow-card sm:p-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-teal-500/12 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 right-0 h-52 w-52 rounded-full bg-gold-600/12 blur-3xl"
          />
          <span className="font-display text-7xl leading-none text-teal-400/40" aria-hidden="true">
            &ldquo;
          </span>
          <blockquote className="-mt-6 max-w-3xl font-display text-[1.6rem] font-medium leading-snug tracking-tight text-cream sm:text-[2.1rem]">
            Em três meses, nossas faltas caíram de quase um terço para menos de 5%. A recepção parou de viver no
            telefone e a agenda simplesmente lota sozinha.
          </blockquote>
          <figcaption className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-6">
            <div className="flex items-center gap-3.5">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-teal-300 to-teal-600 font-display font-semibold text-ink-950">
                DR
              </span>
              <div>
                <p className="font-medium text-cream">Dra. Renata Couto</p>
                <p className="text-[0.86rem] text-mute">Diretora clínica · Instituto Aurora</p>
              </div>
            </div>
            <div className="flex items-center gap-8 border-l border-white/10 pl-8">
              <div>
                <p className="font-display text-2xl font-semibold text-gradient">
                  <Counter to={5} prefix="< " suffix="%" />
                </p>
                <p className="text-[0.78rem] text-mute">de faltas hoje</p>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold text-cream">
                  <Counter to={3} suffix=" meses" />
                </p>
                <p className="text-[0.78rem] text-mute">para o resultado</p>
              </div>
            </div>
          </figcaption>
        </figure>
      </Reveal>
    </section>
  )
}
