import * as React from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

// Checkbox custom acessível — sem Radix Checkbox para manter deps enxutas.
const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          'peer h-5 w-5 cursor-pointer appearance-none rounded border border-input bg-ink-900/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background checked:border-teal-400 checked:bg-teal-400',
          className,
        )}
        {...props}
      />
      <Check
        className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 text-ink-950 opacity-0 peer-checked:opacity-100"
        aria-hidden="true"
      />
    </span>
  )
})
Checkbox.displayName = 'Checkbox'

export { Checkbox }
