import { cn } from '@/lib/utils'

// Wordmark PlexCare — usa font-display + acento teal.
export default function Logo({ className, compact = false }) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-display font-semibold tracking-tightest',
        compact ? 'text-xl' : 'text-2xl sm:text-3xl',
        className,
      )}
    >
      <span className="text-cream">Plex</span>
      <span className="text-gradient-gold">Care</span>
    </span>
  )
}
