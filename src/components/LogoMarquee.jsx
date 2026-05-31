const NAMES = [
  'Clínica Vively',
  'Instituto Aurora',
  'NeoSaúde',
  'Consultório Bem-Estar',
  'CardioCenter',
  'Derma+',
  'OrtoVida',
  'Sorria Odonto',
]

export default function LogoMarquee() {
  return (
    <section aria-label="Clínicas que confiam na PlexCare" className="border-y border-white/[0.05] py-10">
      <p className="container-page mb-7 text-center text-[0.74rem] uppercase tracking-[0.2em] text-mute">
        A operação de quem leva a agenda a sério
      </p>
      <div className="relative overflow-hidden mask-fade-x">
        <div className="flex w-max animate-marquee gap-12 px-6">
          {[...NAMES, ...NAMES].map((n, i) => (
            <span
              key={i}
              className="whitespace-nowrap font-display text-lg font-medium text-cream/35 transition-colors hover:text-cream/70"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
