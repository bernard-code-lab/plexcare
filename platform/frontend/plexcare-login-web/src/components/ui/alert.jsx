import * as React from 'react'
import { cva } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-md border px-4 py-3 text-sm flex gap-3 items-start',
  {
    variants: {
      variant: {
        info: 'border-teal-400/30 bg-teal-400/[0.06] text-teal-100',
        success: 'border-success/30 bg-success/[0.08] text-success/90',
        destructive: 'border-destructive/40 bg-destructive/[0.08] text-destructive',
      },
    },
    defaultVariants: { variant: 'info' },
  },
)

const ICONS = { info: Info, success: CheckCircle2, destructive: AlertCircle }

const Alert = React.forwardRef(({ className, variant = 'info', children, ...props }, ref) => {
  const Icon = ICONS[variant] ?? Info
  return (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
    </div>
  )
})
Alert.displayName = 'Alert'

export { Alert }
