import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useInView,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useScroll,
  useTransform,
  animate,
} from 'framer-motion'
import { cn } from '@/lib/utils'

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
      initial={reduce ? false : { opacity: 0, y, scale: 0.985, filter: 'blur(6px)' }}
      animate={inView ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : undefined}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
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
    // Reduced motion (or before in view with reduced motion): show the final
    // value right away — never sit at 0 waiting for a scroll.
    if (reduce) {
      setVal(to)
      return
    }
    if (!inView) return
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

/* PlexCare "plexus" mark — a symmetric node network converging on a central
   point. The name (Plex = plexus/network) made literal; the bright center is
   the human element. Pure stroke, no container. tone: 'teal' (on dark) | 'navy'. */
export function PlexusMark({ size = 30, tone = 'teal', className = '' }) {
  const line = tone === 'navy' ? '#0F1B35' : '#2DD4BF'
  const core = tone === 'navy' ? '#2D4A8A' : '#5EEAD4'
  const ringOpacity = tone === 'navy' ? 0.4 : 0.3
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* network ring connecting the channel nodes (the "Plex") */}
      <path
        d="M16 6 L26 16 L16 26 L6 16 Z"
        stroke={line}
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity={ringOpacity}
      />
      {/* the care cross (+) — health at the centre, the hero of the mark */}
      <g stroke={line} strokeWidth="2.8" strokeLinecap="round">
        <line x1="16" y1="6.5" x2="16" y2="25.5" />
        <line x1="6.5" y1="16" x2="25.5" y2="16" />
      </g>
      {/* channel nodes at the tips */}
      <g fill={line}>
        <circle cx="16" cy="6" r="1.4" />
        <circle cx="26" cy="16" r="1.4" />
        <circle cx="16" cy="26" r="1.4" />
        <circle cx="6" cy="16" r="1.4" />
      </g>
      {/* central node — the human element */}
      <circle cx="16" cy="16" r="2.7" fill={core} />
    </svg>
  )
}

export function Logo({ className = '', tone = 'teal', size = 38 }) {
  const isNavy = tone === 'navy'
  return (
    <a
      href="#top"
      className={cn('group inline-flex items-center gap-3', className)}
      aria-label="PlexCare — início"
    >
      <PlexusMark
        size={size}
        tone={tone}
        className="drop-shadow-[0_0_14px_rgba(45,212,191,0.35)] transition-transform duration-500 ease-out group-hover:scale-105"
      />
      <span
        className={cn(
          'font-display text-[1.42rem] tracking-tight',
          isNavy ? 'text-[#0F1B35]' : 'text-cream',
        )}
      >
        <span className="font-semibold">Plex</span>
        <span className="font-light">Care</span>
      </span>
    </a>
  )
}

/* One intentional, slow glow per section that drifts with scroll for depth.
   Not a busy blob — a single light source that responds to the viewport. */
export function SectionGlow({ tone = 'teal', position = 'left-1/2 top-1/3', size = 'h-[26rem] w-[26rem]', className = '' }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ['0px', '0px'] : ['48px', '-48px'])

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        style={{ y }}
        className={cn(
          'absolute -translate-x-1/2 rounded-full blur-[130px]',
          size,
          position,
          tone === 'gold' ? 'bg-gold-600/12' : 'bg-teal-600/12',
          className,
        )}
      />
    </div>
  )
}

/* Magnetic wrapper: the child eases toward the cursor on hover, then springs back. */
export function Magnetic({ children, strength = 0.4, className = '' }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 })

  function onMove(e) {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  function reset() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x, y }}
      className={cn('inline-block', className)}
    >
      {children}
    </motion.div>
  )
}

/* Bespoke declining-trend sparkline (no-show rate falling). Custom SVG, draws
   on scroll-into-view, ends on a gold marker. */
export function Sparkline({ className = '' }) {
  const reduce = useReducedMotion()
  const line =
    'M0,12 C20,14 30,22 44,20 C60,18 74,14 88,16 C104,18 120,30 132,30 C150,30 166,40 176,38 C196,36 206,44 220,46'
  return (
    <svg
      viewBox="0 0 220 56"
      className={cn('h-12 w-full overflow-visible', className)}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#F2B53B" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${line} L220,56 L0,56 Z`}
        fill="url(#spark-fill)"
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.35 }}
      />
      <motion.path
        d={line}
        stroke="url(#spark-stroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* a pulse of light travelling along the trend line (ambient loop) */}
      <motion.path
        d={line}
        stroke="#EAFBF7"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        style={{ strokeDasharray: '14 460' }}
        initial={{ strokeDashoffset: 14, opacity: 0 }}
        whileInView={{ strokeDashoffset: -460, opacity: [0, 0.9, 0.9, 0] }}
        viewport={{ once: true }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'linear', delay: 1.2 }}
      />
      {/* ripple emanating from the end marker (ambient loop) */}
      <motion.circle
        cx="220"
        cy="46"
        fill="none"
        stroke="#F2B53B"
        strokeWidth="1.5"
        initial={{ r: 3.5, opacity: 0 }}
        whileInView={{ r: [3.5, 10], opacity: [0.5, 0] }}
        viewport={{ once: true }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 1.3 }}
      />
      <motion.circle
        cx="220"
        cy="46"
        r="3.5"
        fill="#F2B53B"
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.05, duration: 0.3 }}
      />
    </svg>
  )
}

/* Pointer-tracked spotlight overlay. Drop inside a `relative` card; it paints a
   soft radial that follows the cursor and fades in on hover. */
export function Spotlight({ tone = 'rgba(94,234,212,0.14)', className = '' }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)

  function onMove(e) {
    const host = ref.current?.parentElement
    if (!host) return
    const r = host.getBoundingClientRect()
    host.style.setProperty('--mx', `${e.clientX - r.left}px`)
    host.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  useEffect(() => {
    const host = ref.current?.parentElement
    if (!host || reduce) return
    host.addEventListener('mousemove', onMove)
    return () => host.removeEventListener('mousemove', onMove)
  }, [reduce])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300',
        reduce ? '' : 'group-hover:opacity-100',
        className,
      )}
      style={{
        background: `radial-gradient(220px circle at var(--mx, 50%) var(--my, 0%), ${tone}, transparent 70%)`,
      }}
    />
  )
}
