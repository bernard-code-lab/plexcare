import BrandPanel from '@/components/BrandPanel'
import Logo from '@/components/Logo'
import { cn } from '@/lib/utils'

// Shell de duas colunas: marca à esquerda (lg+), formulário centralizado à direita.
// Em mobile/tablet o BrandPanel é ocultado e o logo aparece compacto acima do form.
export default function AuthShell({ children, eyebrow, title, subtitle, footer }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex items-center justify-center px-6 py-12 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-60 lg:hidden"
          style={{
            background:
              'radial-gradient(70% 50% at 50% 0%, rgba(45,212,191,0.12) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Logo />
          </div>

          <div className="mb-7 text-center sm:text-left">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h2
              className={cn(
                'mt-4 font-display text-3xl font-semibold tracking-tightest text-cream',
                'sm:text-[2rem]',
              )}
            >
              {title}
            </h2>
            {subtitle ? <p className="mt-2 text-sm text-mute">{subtitle}</p> : null}
          </div>

          {children}

          {footer ? <div className="mt-8 text-center text-sm text-mute">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}
