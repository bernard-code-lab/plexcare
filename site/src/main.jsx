import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { IlluminatedHero } from './components/ui/illuminated-hero.jsx'
import './index.css'

// RoomSandbox é code-split E só carregado em dev — livekit-client pesa ~300KB
// e não deve ir para o bundle de produção.
const RoomSandbox = import.meta.env.DEV
  ? React.lazy(() => import('./sandbox/RoomSandbox.jsx'))
  : null

// Minimal hash routing:
//   #/showcase           → IlluminatedHero showcase
//   #/sandbox/room?...   → RoomSandbox (dev-only LiveKit room)
//   anything else        → main PlexCare site
function Root() {
  const hashPath = window.location.hash.split('?')[0]
  if (hashPath === '#/showcase') return <IlluminatedHero />
  if (hashPath === '#/sandbox/room' && RoomSandbox) {
    return (
      <Suspense fallback={<div style={{ color: '#E9F4F1', background: '#04100E', minHeight: '100vh', padding: 32 }}>Carregando sala…</div>}>
        <RoomSandbox />
      </Suspense>
    )
  }
  return <App />
}

// Re-render on hash change so navigating to/from the showcase works.
window.addEventListener('hashchange', () => window.location.reload())

// StrictMode causa mount → unmount → mount em dev — desastroso para LiveKit
// (cada unmount faz room.disconnect, gerando flap). Desligamos só no sandbox.
const isSandbox = window.location.hash.split('?')[0] === '#/sandbox/room'

ReactDOM.createRoot(document.getElementById('root')).render(
  isSandbox ? <Root /> : <React.StrictMode><Root /></React.StrictMode>,
)
