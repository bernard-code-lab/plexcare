import { Check, ArrowUpRight } from 'lucide-react'
import { Reveal } from './primitives'

const PLANS = [
  {
    name: 'Essencial',
    price: 'R$ 149',
    cadence: '/mês por profissional',
    desc: 'Para consultórios que querem parar de perder horário.',
    features: [
      'Agenda multicanal (Google + iOS)',
      'Confirmação e lembrete por WhatsApp',
      'Painel de comparecimento',
      'Até 1.000 mensagens/mês',
    ],
    cta: 'Começar agora',
    featured: false,
  },
  {
    name: 'Clínica',
    price: 'R$ 389',
    cadence: '/mês até 5 profissionais',
    desc: 'A IA anti-falta completa para equipes que crescem.',
    features: [
      'Tudo do Essencial',
      'IA anti-falta + encaixe inteligente',
      'Fila de espera automática',
      'Consentimento eletrônico (LGPD)',
      'Mensagens ilimitadas',
    ],
    cta: 'Agendar demo',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Sob medida',
    cadence: 'multi-unidade e white-label',
    desc: 'Para redes, hospitais e operações com requisitos próprios.',
    features: [
      'Tudo do Clínica',
      'Laudo digital com ICP-Brasil',
      'API Embed e SSO',
      'Trilha de auditoria avançada',
      'Suporte dedicado',
    ],
    cta: 'Falar com vendas',
    featured: false,
  },
]

export default function Pricing() {
  return (
    <section id="precos" className="container-page scroll-mt-28 py-24 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <span className="eyebrow">Planos</span>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="display mt-6 text-3xl text-cream sm:text-[2.7rem]">
            Custa menos que uma agenda meio vazia.
          </h2>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-5 text-[1.02rem] leading-relaxed text-mute">
            Sem fidelidade. Comece em minutos e cancele quando quiser — embora você não vá querer.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid items-start gap-5 lg:grid-cols-3">
        {PLANS.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.08} y={28}>
            <div
              className={`relative h-full overflow-hidden rounded-[1.6rem] p-7 sm:p-8 ${
                p.featured
                  ? 'border border-teal-300/35 bg-gradient-to-b from-teal-400/[0.1] to-transparent shadow-glow'
                  : 'glass shadow-card'
              }`}
            >
              {p.featured && (
                <span className="absolute right-6 top-6 rounded-full bg-teal-400/15 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-wider text-teal-200">
                  Mais escolhido
                </span>
              )}
              <h3 className="font-display text-xl font-semibold tracking-tight text-cream">{p.name}</h3>
              <p className="mt-2 min-h-[2.6rem] text-[0.9rem] leading-snug text-mute">{p.desc}</p>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-semibold tracking-tight text-cream">{p.price}</span>
                <span className="text-[0.82rem] text-mute">{p.cadence}</span>
              </div>

              <a
                href="#"
                className={`mt-6 w-full ${p.featured ? 'btn-primary' : 'btn-ghost'}`}
              >
                {p.cta}
                <ArrowUpRight size={16} strokeWidth={2.4} />
              </a>

              <ul className="mt-7 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[0.92rem] text-cream/85">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-400/15 text-teal-300">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
