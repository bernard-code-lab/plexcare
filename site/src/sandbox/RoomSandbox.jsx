import { useMemo } from 'react'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'

// Sandbox interno de testes da sala virtual. Lê token e WS URL do hash:
//   #/sandbox/room?token=<jwt>&url=ws://localhost:7880
//
// NÃO é UI de produção. Sem auth real, sem consent, sem audit log. Toda
// participação aqui é tráfego de teste — qualquer dado de paciente em
// produção precisa de fluxo separado com LGPD + CFM + ADR (ver ADR-0002).
export default function RoomSandbox() {
  if (import.meta.env.PROD) {
    return (
      <div style={{ padding: 32, color: '#E9F4F1', background: '#04100E', minHeight: '100vh' }}>
        Sandbox indisponível em produção.
      </div>
    )
  }

  // Memoize parsing do hash. Sem isso, cada render gera NOVAS strings para
  // token/serverUrl e o LiveKitRoom interpreta como prop changed → reconnect.
  const { token, serverUrl } = useMemo(() => {
    const hash = window.location.hash
    const queryStr = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const params = new URLSearchParams(queryStr)
    return {
      token: params.get('token'),
      serverUrl: params.get('url') || 'ws://localhost:7880',
    }
  }, [])

  if (!token) {
    return (
      <div style={{ padding: 32, color: '#E9F4F1', background: '#04100E', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ marginTop: 0 }}>Sala — sandbox de teste</h1>
        <p>Falta <code>?token=...</code> no hash. URL esperada:</p>
        <pre style={{ background: '#0A201C', padding: 12, borderRadius: 8, overflow: 'auto' }}>
{`http://localhost:5173/#/sandbox/room?token=<jwt>&url=ws://localhost:7880`}
        </pre>
        <p>Para gerar tokens, rode <code>./scripts/create-test-room.sh</code> no <code>platform/plexcare-teleconf/</code>.</p>
      </div>
    )
  }

  // NÃO usar onDisconnected para redirecionar — em React.StrictMode (dev) o
  // componente monta → desmonta → remonta, e o unmount intermediário dispara
  // onDisconnected. Qualquer reload aqui te joga para `/` antes de você
  // conseguir entrar. Deixa o <VideoConference> mostrar o estado nativo.
  return (
    <div data-lk-theme="default" style={{ height: '100vh', background: '#04100E' }}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video
        audio
        onError={(err) => console.error('[RoomSandbox] LiveKit error', err)}
        onConnected={() => console.info('[RoomSandbox] connected to', serverUrl)}
        onDisconnected={(reason) => console.warn('[RoomSandbox] disconnected', reason)}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  )
}
