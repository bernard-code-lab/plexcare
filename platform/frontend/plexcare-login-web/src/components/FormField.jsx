import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Wrapper para label + input + erro + hint. Garante id ↔ htmlFor + aria-invalid.
export default function FormField({ id, label, hint, error, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
