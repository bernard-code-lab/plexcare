import { Shield, Stethoscope, Sparkles } from 'lucide-react'
import Logo from '@/components/Logo'

// Painel esquerdo do shell de auth: marca + storytelling + selos de compliance.
// Hidden em telas <lg para evitar competição visual com o formulário.
export default function BrandPanel() {
  return (
    <aside
      aria-hidden="true"
      className="relative hidden overflow-hidden border-r border-border bg-ink-900/40 lg:flex lg:flex-col lg:justify-between lg:p-12"
    >
      {/* Aurora glow ambiente */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60% 50% at 30% 20%, rgba(45,212,191,0.18) 0%, transparent 60%), radial-gradient(50% 40% at 80% 80%, rgba(242,181,59,0.10) 0%, transparent 60%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 grain opacity-[0.035]" />

      <div className="relative">
        <Logo />
      </div>

      <div className="relative max-w-md">
        <span className="eyebrow">Plataforma de telemedicina</span>
        <h1 className="display mt-5 text-4xl text-cream">
          Cuidado conectado, <span className="text-gradient">seguro</span> e contínuo.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-mute">
          Salas virtuais, agendamento e prontuário em uma única jornada — feita para médicos,
          clínicas e hospitais brasileiros.
        </p>

        <ul className="mt-8 space-y-4 text-sm text-cream/90">
          <li className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-teal-300" />
            <span>
              LGPD + CFM 2.314 — criptografia ponta a ponta, audit log e consentimento gravado.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Stethoscope className="mt-0.5 h-5 w-5 text-teal-300" />
            <span>Multi-tenant — cada clínica isolada com seus próprios planos e limites.</span>
          </li>
          <li className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-gold-400" />
            <span>Agenda inteligente com IA anti-no-show e integração WhatsApp / Google.</span>
          </li>
        </ul>
      </div>

      <p className="relative text-xs text-mute">
        © {new Date().getFullYear()} PlexCare — Tecnologia em saúde.
      </p>
    </aside>
  )
}
