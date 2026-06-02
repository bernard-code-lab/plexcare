import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, ArrowUpRight } from 'lucide-react'
import { Logo } from './primitives'
import { GlowMenu } from '@/components/ui/glow-menu'

const LINKS = [
  { label: 'Recursos', href: '#recursos' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Integrações', href: '#integracoes' },
  { label: 'Preços', href: '#precos' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={`container-page flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 ${
          scrolled ? 'glass shadow-card' : 'border border-transparent'
        }`}
      >
        <Logo />

        <GlowMenu items={LINKS} className="hidden md:flex" />

        <div className="hidden items-center gap-3 md:flex">
          <a href="#" className="text-sm text-mute transition-colors hover:text-cream cursor-pointer">
            Entrar
          </a>
          <a href="#demo" className="btn-primary !px-5 !py-2.5 text-sm">
            Agendar demo
            <ArrowUpRight size={16} strokeWidth={2.4} />
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-cream md:hidden cursor-pointer"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="container-page absolute top-[4.7rem] glass mx-4 rounded-2xl p-3 shadow-card md:hidden"
          >
            <ul className="flex flex-col">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-3 text-[0.98rem] text-cream/90 transition-colors hover:bg-white/[0.05] cursor-pointer"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <a href="#demo" onClick={() => setOpen(false)} className="btn-primary mt-2 w-full">
              Agendar demo
              <ArrowUpRight size={16} strokeWidth={2.4} />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
