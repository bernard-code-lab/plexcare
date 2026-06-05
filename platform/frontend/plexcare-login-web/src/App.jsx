import { Outlet } from 'react-router-dom'

// Layout shell mínimo — o AuthShell de cada página renderiza Brand + form.
// Mantemos o componente para abrir espaço a Providers (toast, theme, etc.).
export default function App() {
  return (
    <div className="min-h-screen bg-ink-950 text-cream">
      <Outlet />
    </div>
  )
}
