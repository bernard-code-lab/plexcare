import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock, Check, Clock, ShieldCheck, Video } from 'lucide-react'
import { Reveal, SectionGlow } from './primitives'
import { CalendarScheduler } from '@/components/ui/calendar-scheduler'

const PERKS = [
  { icon: Clock, label: '15 minutos, sem compromisso' },
  { icon: Video, label: 'Demonstração ao vivo da Agenda + IA' },
  { icon: ShieldCheck, label: 'Tire dúvidas de LGPD e implantação' },
]

export default function DemoScheduler() {
  const [booking, setBooking] = useState(null)

  return (
    <section id="demo" className="relative container-page scroll-mt-28 py-24 sm:py-28">
      <SectionGlow tone="teal" position="left-[18%] top-1/4" size="h-[26rem] w-[30rem]" />

      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        {/* Copy */}
        <div>
          <Reveal>
            <span className="eyebrow">Agendar demo</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display mt-6 text-3xl text-cream sm:text-[2.7rem]">
              Veja a PlexCare rodando na sua agenda.
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-md text-[1.02rem] leading-relaxed text-mute">
              Escolha o melhor dia e horário. Um especialista mostra, na prática, como a IA confirma, lembra e
              reduz as faltas da sua clínica.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <ul className="mt-8 space-y-3.5">
              {PERKS.map((p) => (
                <li key={p.label} className="flex items-center gap-3 text-[0.96rem] text-cream/85">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-teal-400/20 bg-teal-400/[0.08] text-teal-300">
                    <p.icon size={16} strokeWidth={2} />
                  </span>
                  {p.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Scheduler / confirmation */}
        <Reveal delay={0.12} y={28}>
          <div className="glass rounded-[1.8rem] p-6 shadow-card sm:p-8">
            {booking ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-teal-400/15 text-teal-300 shadow-glow">
                  <Check size={28} strokeWidth={2.6} />
                </span>
                <h3 className="display mt-6 text-2xl text-cream">
                  {booking.name ? `Tudo certo, ${booking.name.split(' ')[0]}!` : 'Demonstração agendada!'}
                </h3>
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/[0.07] px-4 py-2 text-sm text-teal-200">
                  <CalendarClock size={16} />
                  {format(booking.date, "EEEE, d 'de' MMMM", { locale: ptBR })} · {booking.time}
                </p>
                <p className="mt-5 max-w-sm text-[0.92rem] leading-relaxed text-mute">
                  Enviamos a confirmação e o link da sala para <b className="text-cream/90">{booking.email}</b> e o
                  WhatsApp <b className="text-cream/90">{booking.phone}</b>. Até lá!
                </p>
                <button
                  onClick={() => setBooking(null)}
                  className="mt-7 text-sm text-teal-300 underline-offset-4 transition-colors hover:underline cursor-pointer"
                >
                  Escolher outro horário
                </button>
              </div>
            ) : (
              <CalendarScheduler onConfirm={(val) => val.date && val.time && setBooking(val)} />
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
