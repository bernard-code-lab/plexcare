import { auth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const GoogleIcon = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.48-1.12 2.73-2.39 3.57v2.96h3.86c2.26-2.08 3.58-5.15 3.58-8.77z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.96c-1.07.72-2.44 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.24 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.33A7.21 7.21 0 0 1 4.88 12c0-.81.15-1.6.39-2.33V6.58H1.27A11.96 11.96 0 0 0 0 12c0 1.94.47 3.77 1.27 5.42l4-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.81l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.24 2.7 1.27 6.58l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"
    />
  </svg>
)

const AppleIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M16.37 13.06c-.03-2.93 2.4-4.34 2.51-4.41-1.37-2-3.5-2.28-4.26-2.31-1.81-.18-3.54 1.07-4.46 1.07-.93 0-2.36-1.04-3.88-1.01-2 .03-3.84 1.16-4.86 2.95-2.07 3.59-.53 8.9 1.49 11.81.98 1.42 2.16 3.02 3.7 2.96 1.49-.06 2.05-.96 3.85-.96s2.31.96 3.88.93c1.6-.03 2.62-1.45 3.6-2.88 1.13-1.66 1.6-3.27 1.63-3.35-.04-.02-3.13-1.2-3.2-4.8zM13.49 4.34c.82-1 1.37-2.38 1.22-3.76-1.18.05-2.62.79-3.47 1.78-.76.88-1.42 2.3-1.24 3.65 1.32.1 2.66-.67 3.49-1.67z" />
  </svg>
)

const MicrosoftIcon = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path fill="#F25022" d="M1 1h10v10H1z" />
    <path fill="#7FBA00" d="M13 1h10v10H13z" />
    <path fill="#00A4EF" d="M1 13h10v10H1z" />
    <path fill="#FFB900" d="M13 13h10v10H13z" />
  </svg>
)

function SocialButton({ provider, label, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => auth.socialRedirect(provider)}
      data-testid={`social-${provider}`}
      className={cn(
        'inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md',
        'border border-input bg-ink-900/60 px-4 text-sm font-medium text-cream',
        'transition-colors hover:border-teal-300/40 hover:bg-white/[0.04]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

export default function SocialButtons() {
  const showGoogle = import.meta.env.VITE_ENABLE_GOOGLE !== 'false'
  const showApple = import.meta.env.VITE_ENABLE_APPLE === 'true'
  const showMicrosoft = import.meta.env.VITE_ENABLE_MICROSOFT === 'true'

  if (!showGoogle && !showApple && !showMicrosoft) return null

  return (
    <div className="space-y-2">
      {showGoogle && <SocialButton provider="google" label="Continuar com Google" icon={GoogleIcon} />}
      {showApple && <SocialButton provider="apple" label="Continuar com Apple" icon={AppleIcon} />}
      {showMicrosoft && (
        <SocialButton provider="microsoft" label="Continuar com Microsoft" icon={MicrosoftIcon} />
      )}
    </div>
  )
}
