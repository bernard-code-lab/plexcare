import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useInView,
  useReducedMotion,
  useMotionValue,
  useSpring,
  animate,
} from 'framer-motion'

/* Scroll-triggered reveal with optional stagger via `delay`. */
export function Reveal({ children, delay = 0, y = 22, className = '', as = 'div' }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-12% 0px -10% 0px' })
  const M = motion[as] || motion.div

  return (
    <M
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  )
}

/* Count-up number that animates when scrolled into view. */
export function Counter({ to, suffix = '', prefix = '', decimals = 0, className = '' }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20% 0px' })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduce) {
      setVal(to)
      return
    }
    const controls = animate(0, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(v),
    })
    return () => controls.stop()
  }, [inView, to, reduce])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

/* Subtle pointer-follow tilt for hero/feature cards. Disabled when reduced motion. */
export function Tilt({ children, className = '', max = 6 }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 })
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 })

  function onMove(e) {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    ry.set(px * max)
    rx.set(-py * max)
  }
  function reset() {
    rx.set(0)
    ry.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Logo({ className = '' }) {
  return (
    <a href="#top" className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="PlexCare — início">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-300 to-teal-600 text-ink-950 shadow-glow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3 9h18" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M12 12.2v4.6M9.7 14.5h4.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-[1.18rem] font-semibold tracking-tight text-cream">
        Plex<span className="text-teal-300">Care</span>
      </span>
    </a>
  )
}
