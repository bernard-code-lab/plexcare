import { scorePassword } from '@/lib/password'
import { cn } from '@/lib/utils'

const TONE = [
  'bg-destructive/70',
  'bg-destructive/80',
  'bg-gold-500',
  'bg-teal-500',
  'bg-teal-400',
]

export default function PasswordStrength({ value }) {
  const { score, label, hints } = scorePassword(value ?? '')
  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex gap-1.5" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < score ? TONE[score] : 'bg-white/[0.06]',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-mute">
        Força: <span className="text-cream">{label}</span>
        {hints.length ? ` — ${hints[0]}.` : ''}
      </p>
    </div>
  )
}
