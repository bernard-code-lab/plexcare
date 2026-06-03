import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const linkClass = ({ isActive }) =>
  cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-teal-400/10 text-teal-400' : 'text-mute hover:text-cream',
  )

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-lg font-semibold tracking-tight text-cream">
          PlexCare <span className="text-teal-400">Sala</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass} data-testid="nav-home">
            Início
          </NavLink>
          <NavLink to="/rooms/new" className={linkClass} data-testid="nav-new-room">
            Nova consulta
          </NavLink>
          <NavLink to="/dashboard" className={linkClass} data-testid="nav-dashboard">
            Histórico
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
