import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/routes/router'
import { queryClient } from '@/lib/query-client'
import './index.css'

// StrictMode CONDICIONAL: na rota /rooms/:name/live a sala LiveKit não
// tolera mount→unmount→mount (cada unmount dispara room.disconnect e a
// negociação WebRTC entra em loop). Lição herdada do RoomSandbox antigo.
const isLive = /\/rooms\/[^/]+\/live$/.test(window.location.pathname)

const Tree = (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  isLive ? Tree : <React.StrictMode>{Tree}</React.StrictMode>,
)
