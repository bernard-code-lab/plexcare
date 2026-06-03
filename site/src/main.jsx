import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { IlluminatedHero } from './components/ui/illuminated-hero.jsx'
import './index.css'

// Hash routing — site institucional + showcase de design.
// A sala virtual (LiveKit) vive em platform/plexcare-teleconf-web/.
function Root() {
  const hashPath = window.location.hash.split('?')[0]
  if (hashPath === '#/showcase') return <IlluminatedHero />
  return <App />
}

window.addEventListener('hashchange', () => window.location.reload())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
