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

function Group({ hidden = false }) {
  // Trailing padding (pr-12) bakes the inter-item gap into each group's width,
  // so two groups tile perfectly and the -50% loop point is seamless.
  return (
    <ul className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={hidden || undefined}>
      {NAMES.map((n) => (
        <li
          key={n}
          className="whitespace-nowrap font-display text-lg font-medium text-cream/35 transition-colors hover:text-cream/70"
        >
          {n}
        </li>
      ))}
    </ul>
  )
}

export default function LogoMarquee() {
  return (
    <section aria-label="Clínicas que confiam na PlexCare" className="border-y border-white/[0.05] py-10">
      <p className="container-page mb-7 text-center text-[0.74rem] uppercase tracking-[0.2em] text-mute">
        A operação de quem leva a agenda a sério
      </p>
      <div className="relative overflow-hidden mask-fade-x">
        <div className="flex w-max animate-marquee" style={{ animationDuration: '64s' }}>
          <Group />
          <Group hidden />
        </div>
      </div>
    </section>
  )
}
