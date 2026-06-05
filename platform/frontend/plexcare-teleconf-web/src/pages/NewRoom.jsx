import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import { saveSession } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

const DEFAULTS = {
  appointment_id: '',
  host_identity: '',
  guest_identity: '',
  max_duration_min: 60,
  max_participants: 2,
  recording: false,
}

export default function NewRoom() {
  const navigate = useNavigate()
  const [form, setForm] = useState(DEFAULTS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.createRoom({
        ...form,
        appointment_id:
          form.appointment_id || `apt-${Date.now().toString(36)}`,
      })
      // Guarda contexto da sala — Waiting/Room/PostCall recuperam daqui.
      saveSession({
        roomId: result.room_id,
        livekitName: result.livekit_name,
        hostToken: result.host_token,
        guestToken: result.guest_token,
        expiresAt: result.expires_at,
        hostIdentity: form.host_identity,
        guestIdentity: form.guest_identity,
      })
      navigate(`/rooms/${result.livekit_name}/waiting?role=host`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao criar sala')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-cream">
        Nova consulta
      </h1>
      <p className="mt-1 text-sm text-mute">
        A sala expira automaticamente ao fim da duração configurada (padrão: 60 minutos).
      </p>

      <Card className="mt-8 border-border bg-ink-900/60 p-6">
        <form onSubmit={onSubmit} className="space-y-5" data-testid="new-room-form">
          <Field
            label="Médico responsável"
            value={form.host_identity}
            onChange={(v) => update('host_identity', v)}
            placeholder="Dra. Maria Silva"
            required
            testId="field-host"
          />
          <Field
            label="Paciente"
            value={form.guest_identity}
            onChange={(v) => update('guest_identity', v)}
            placeholder="João da Silva"
            required
            testId="field-guest"
          />
          <Field
            label="Duração máxima (minutos)"
            type="number"
            value={form.max_duration_min}
            onChange={(v) => update('max_duration_min', Number(v))}
            testId="field-duration"
          />
          <Field
            label="Limite de participantes"
            type="number"
            value={form.max_participants}
            onChange={(v) => update('max_participants', Number(v))}
            testId="field-max-participants"
          />
          <label className="flex items-center gap-2 text-sm text-cream">
            <input
              type="checkbox"
              checked={form.recording}
              onChange={(e) => update('recording', e.target.checked)}
              className="h-4 w-4 rounded border-border bg-ink-800 text-teal-400"
              data-testid="field-recording"
            />
            Gravar consulta (notificação automática ao paciente)
          </label>

          {error ? (
            <p className="text-sm text-red-400" data-testid="form-error">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} data-testid="submit-new-room">
            {submitting ? 'Criando…' : 'Criar consulta'}
          </Button>
        </form>
      </Card>
    </main>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required, testId }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-cream">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        data-testid={testId}
      />
    </label>
  )
}
