import { Outlet, useLocation } from 'react-router-dom'
import Nav from '@/components/Nav'

// Layout shell: nav some nas rotas de sala "live" (imersão total).
export default function App() {
  const { pathname } = useLocation()
  const isLive = /\/rooms\/[^/]+\/live$/.test(pathname)

  return (
    <div className="min-h-screen bg-ink-950 text-cream">
      {isLive ? null : <Nav />}
      <Outlet />
    </div>
  )
}
