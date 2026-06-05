import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { loadSession } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ConsentModal from '@/components/ConsentModal'
import ComplianceBanner from '@/components/ComplianceBanner'

// Pre-call checks: consent → permissões mic/cam → preview vídeo → entrada.
// Network/jitter test fica como TODO (precisa endpoint TURN/STUN).
export default function WaitingRoom() {
  const { roomName } = useParams()
  const [params] = useSearchParams()
  const role = params.get('role') === 'guest' ? 'guest' : 'host'
  const navigate = useNavigate()
  const videoRef = useRef(null)

  const session = loadSession()
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState('idle')
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!consentAccepted) return
    let cancelled = false
    setPermissionStatus('requesting')
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        setStream(s)
        setPermissionStatus('granted')
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch((err) => {
        if (!cancelled) {
          setPermissionStatus('denied')
          setError(err.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [consentAccepted])

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [stream])

  if (!session) {
    return (
      <Fallback
        title="Sessão não encontrada"
        message="A consulta expirou ou foi encerrada. Inicie uma nova consulta para continuar."
        actionLabel="Voltar"
        onAction={() => navigate('/rooms/new')}
      />
    )
  }

  function enter() {
    stream?.getTracks().forEach((t) => t.stop())
    navigate(`/rooms/${roomName}/live?role=${role}`)
  }

  return (
    <>
      <ConsentModal
        open={!consentAccepted}
        onAccept={() => setConsentAccepted(true)}
        onReject={() => navigate('/')}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-cream">Sala de espera</h1>
        <p className="mt-1 text-sm text-mute">
          Verificando câmera e microfone antes de iniciar a consulta.
        </p>

        <Card className="mt-6 overflow-hidden border-border bg-ink-900/60">
          <div className="aspect-video bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              data-testid="waiting-preview"
            />
          </div>
          <div className="border-t border-border p-4">
            <CheckRow
              label="Câmera & microfone"
              status={permissionStatus}
              testId="check-permissions"
            />
            {error ? (
              <p className="mt-2 text-xs text-red-400" data-testid="permissions-error">
                {error}
              </p>
            ) : null}
          </div>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button
            disabled={permissionStatus !== 'granted'}
            onClick={enter}
            data-testid="enter-room"
          >
            Entrar na sala
          </Button>
        </div>
      </main>
      <ComplianceBanner />
    </>
  )
}

function CheckRow({ label, status, testId }) {
  const color =
    status === 'granted'
      ? 'text-teal-400'
      : status === 'denied'
        ? 'text-red-400'
        : 'text-mute'
  const text =
    status === 'granted'
      ? 'OK'
      : status === 'denied'
        ? 'Negado'
        : status === 'requesting'
          ? 'Solicitando…'
          : 'Aguardando consentimento'
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-cream">{label}</span>
      <span className={color} data-testid={testId}>
        {text}
      </span>
    </div>
  )
}

function Fallback({ title, message, actionLabel, onAction }) {
  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="font-display text-xl font-semibold text-cream">{title}</h1>
      <p className="mt-2 text-sm text-mute">{message}</p>
      <Button className="mt-6" onClick={onAction}>
        {actionLabel}
      </Button>
    </main>
  )
}
