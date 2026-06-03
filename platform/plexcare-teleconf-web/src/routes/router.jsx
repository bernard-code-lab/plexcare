import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '@/App'
import Home from '@/pages/Home'
import NewRoom from '@/pages/NewRoom'
import WaitingRoom from '@/pages/WaitingRoom'
import Room from '@/pages/Room'
import PostCall from '@/pages/PostCall'
import Dashboard from '@/pages/Dashboard'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/rooms/new', element: <NewRoom /> },
      { path: '/rooms/:roomName/waiting', element: <WaitingRoom /> },
      { path: '/rooms/:roomName/live', element: <Room /> },
      { path: '/rooms/:roomName/feedback', element: <PostCall /> },
      { path: '/dashboard', element: <Dashboard /> },
    ],
  },
])
