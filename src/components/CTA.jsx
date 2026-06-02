import { Reveal } from './primitives'
import { CtaCard } from '@/components/ui/call-to-action-cta'

export default function CTA() {
  const handleSignUp = (email) => {
    // Hook this up to your signup flow / CRM.
    console.log('Lead capturado:', email)
  }

  return (
    <section id="comecar" className="container-page scroll-mt-28 pb-8 pt-4 sm:pb-12">
      <Reveal y={28}>
        <CtaCard
          titleClassName="font-display tracking-tightest"
          className="rounded-[2.2rem] border-teal-300/25 shadow-glow"
          imageSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='600' preserveAspectRatio='none'%3E%3Cdefs%3E%3CradialGradient id='g' cx='82%25' cy='10%25' r='95%25'%3E%3Cstop offset='0%25' stop-color='%230d9488' stop-opacity='0.45'/%3E%3Cstop offset='42%25' stop-color='%23061613'/%3E%3Cstop offset='100%25' stop-color='%2304100e'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='1200' height='600' fill='url(%23g)'/%3E%3C/svg%3E"
          overlayClassName="bg-[linear-gradient(105deg,rgba(4,16,14,0.78)_0%,rgba(4,16,14,0.4)_50%,transparent_85%)]"
          title="Pare de pagar por cadeiras vazias."
          description="Coloque a IA da PlexCare para cuidar da sua agenda. Deixe seu email e veja as faltas caírem já na primeira semana."
          inputPlaceholder="Seu melhor email"
          buttonText="Começar agora"
          onButtonClick={handleSignUp}
          inputClassName="border-white/10 bg-white/[0.05] text-cream placeholder:text-mute focus:border-teal-300/40"
          buttonClassName="border-0 bg-gradient-to-b from-teal-300 via-teal-400 to-teal-600 text-ink-950 font-medium shadow-[0_18px_40px_-18px_rgba(45,212,191,0.7)] hover:opacity-95"
        />
      </Reveal>
    </section>
  )
}
