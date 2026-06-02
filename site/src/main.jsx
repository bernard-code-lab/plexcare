import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { IlluminatedHero } from './components/ui/illuminated-hero.jsx'
import './index.css'

// Minimal hash routing: #/showcase renders the IlluminatedHero showcase page,
// everything else renders the main PlexCare site.
function Root() {
  const isShowcase = window.location.hash === '#/showcase'
  return isShowcase ? <IlluminatedHero /> : <App />
}

// Re-render on hash change so navigating to/from the showcase works.
window.addEventListener('hashchange', () => window.location.reload())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
