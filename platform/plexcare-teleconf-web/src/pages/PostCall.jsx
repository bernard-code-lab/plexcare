import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clearSession, loadSession } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import ComplianceBanner from '@/components/ComplianceBanner'

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function PostCall() {
  const { roomName } = useParams()
  const navigate = useNavigate()
  const session = loadSession()
  const [score, setScore] = useState(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function submit() {
    // TODO: POST /rooms/{roomName}/feedback quando endpoint existir.
    console.info('[PostCall] feedback (placeholder)', { roomName, score, comment })
    setSubmitted(true)
  }

  function finish() {
    clearSession()
    navigate('/')
  }

  return (
    <>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Card className="border-border bg-ink-900/60 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-teal-400" />
            <div>
              <h1 className="font-display text-xl font-semibold text-cream">
                Consulta encerrada
              </h1>
              <p className="mt-1 text-sm text-mute">
                Consentimento registrado em auditoria.
              </p>
              {session ? (
                <p className="mt-1 text-xs text-mute">
                  Médico: {session.hostIdentity} · Paciente: {session.guestIdentity}
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        {!submitted ? (
          <Card className="mt-6 border-border bg-ink-900/60 p-6" data-testid="feedback-form">
            <h2 className="font-display text-base font-semibold text-cream">
              Como foi a qualidade da chamada?
            </h2>
            <p className="mt-1 text-xs text-mute">0 = ruim · 10 = excelente</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SCORES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  data-testid={`score-${n}`}
                  className={
                    'h-9 w-9 rounded-md border text-sm transition-colors ' +
                    (score === n
                      ? 'border-teal-400 bg-teal-400/10 text-teal-400'
                      : 'border-border bg-ink-800 text-cream hover:border-teal-400/40')
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comentário (opcional)"
              rows={3}
              data-testid="feedback-comment"
              className="mt-4 w-full rounded-md border border-border bg-ink-800 p-3 text-sm text-cream placeholder:text-mute focus:border-teal-400 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={finish} data-testid="skip-feedback">
                Pular
              </Button>
              <Button
                disabled={score === null}
                onClick={submit}
                data-testid="submit-feedback"
              >
                Enviar
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="mt-6 border-border bg-ink-900/60 p-6 text-center">
            <p className="text-sm text-cream">Obrigado pelo feedback.</p>
            <Button className="mt-4" onClick={finish} data-testid="finish">
              Voltar ao início
            </Button>
          </Card>
        )}
      </main>
      <ComplianceBanner />
    </>
  )
}
