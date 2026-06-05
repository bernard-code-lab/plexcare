import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'
import { loadSession } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import ComplianceBanner from '@/components/ComplianceBanner'

// IMPORTANTE: NÃO use `onDisconnected` para navegar enquanto monta. Em
// React.StrictMode (dev) o componente faz mount → unmount → mount, e o
// unmount intermediário dispara onDisconnected, jogando o usuário para fora
// antes de conectar. Memoize props passadas ao <LiveKitRoom>. (lição
// herdada do RoomSandbox antigo.)
const serverUrl = import.meta.env.VITE_LIVEKIT_URL ?? 'ws://localhost:7880'

export default function Room() {
  const { roomName } = useParams()
  const [params] = useSearchParams()
  const role = params.get('role') === 'guest' ? 'guest' : 'host'
  const navigate = useNavigate()
  const session = loadSession()

  const token = session
    ? role === 'guest'
      ? session.guestToken
      : session.hostToken
    : null

  // Memoize URL e flags para evitar prop-changed → reconnect em re-render.
  const stableServerUrl = useMemo(() => serverUrl, [])

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="font-display text-xl font-semibold text-cream">
          Sessão indisponível
        </h1>
        <p className="mt-2 text-sm text-mute">
          A consulta expirou ou foi encerrada. Inicie uma nova consulta para continuar.
        </p>
        <Button className="mt-6" onClick={() => navigate('/rooms/new')}>
          Nova consulta
        </Button>
      </main>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <div data-lk-theme="default" className="flex-1 bg-ink-950">
        <LiveKitRoom
          token={token}
          serverUrl={stableServerUrl}
          connect
          video
          audio
          onError={(err) => console.error('[Room] LiveKit error', err)}
          onDisconnected={(reason) => {
            console.warn('[Room] disconnected', reason)
            navigate(`/rooms/${roomName}/feedback`)
          }}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
      <ComplianceBanner />
    </div>
  )
}
