import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// 3D label flip + radial glow on hover, themed to the PlexCare teal brand.
// Adapted from a multi-color "glow menu" — theme toggle / next-themes removed
// (the site is dark-only) and the per-item rainbow glows unified to teal.

const sharedTransition = { type: 'spring', stiffness: 100, damping: 20, duration: 0.5 }

const itemVariants = {
  initial: { rotateX: 0, opacity: 1 },
  hover: { rotateX: -90, opacity: 0 },
}

const backVariants = {
  initial: { rotateX: 90, opacity: 0 },
  hover: { rotateX: 0, opacity: 1 },
}

const glowVariants = {
  initial: { opacity: 0, scale: 0.8 },
  hover: {
    opacity: 1,
    scale: 2,
    transition: {
      opacity: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      scale: { duration: 0.5, type: 'spring', stiffness: 300, damping: 25 },
    },
  },
}

const navGlowVariants = {
  initial: { opacity: 0 },
  hover: { opacity: 1, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
}

const TEAL_GLOW =
  'radial-gradient(circle, rgba(45,212,191,0.18) 0%, rgba(13,148,136,0.07) 50%, rgba(13,148,136,0) 100%)'

export function GlowMenu({ items, className = '', onItemClick }) {
  return (
    <motion.ul
      className={cn('relative flex items-center gap-1', className)}
      initial="initial"
      whileHover="hover"
    >
      {/* whole-menu glow when hovering anywhere in the menu */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 -z-10 rounded-2xl"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(45,212,191,0.12) 0%, rgba(45,212,191,0) 70%)',
        }}
        variants={navGlowVariants}
      />

      {items.map((item) => (
        <li key={item.label} className="relative">
          <motion.div
            className="relative block rounded-xl"
            style={{ perspective: '600px' }}
            initial="initial"
            whileHover="hover"
          >
            {/* per-item radial glow */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{ background: TEAL_GLOW, borderRadius: '16px' }}
              variants={glowVariants}
            />
            {/* front face */}
            <motion.a
              href={item.href}
              onClick={onItemClick}
              className="flex items-center rounded-xl px-3.5 py-2 text-sm text-mute transition-colors"
              variants={itemVariants}
              transition={sharedTransition}
              style={{ transformStyle: 'preserve-3d', transformOrigin: 'center bottom' }}
            >
              {item.label}
            </motion.a>
            {/* back face (revealed on flip) */}
            <motion.a
              href={item.href}
              onClick={onItemClick}
              className="absolute inset-0 flex items-center rounded-xl px-3.5 py-2 text-sm text-teal-200"
              variants={backVariants}
              transition={sharedTransition}
              style={{ transformStyle: 'preserve-3d', transformOrigin: 'center top', rotateX: 90 }}
            >
              {item.label}
            </motion.a>
          </motion.div>
        </li>
      ))}
    </motion.ul>
  )
}
