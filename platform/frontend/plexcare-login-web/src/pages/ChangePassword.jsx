import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'

import AuthShell from '@/components/AuthShell'
import FormField from '@/components/FormField'
import PasswordInput from '@/components/PasswordInput'
import PasswordStrength from '@/components/PasswordStrength'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { scorePassword } from '@/lib/password'
import { auth, AuthError } from '@/lib/auth'

// Fluxo "logged-in user altera a própria senha". Em prod, esta rota só deve
// aparecer atrás de um guard de sessão — em dev fica aberta para iteração.
export default function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState(null)
  const [done, setDone] = useState(false)

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const next = {}
    if (!form.current) next.current = 'Informe sua senha atual.'
    if (!form.next) next.next = 'Crie uma nova senha.'
    else if (scorePassword(form.next).score < 2)
      next.next = 'A senha precisa ser ao menos razoável.'
    else if (form.next === form.current)
      next.next = 'A nova senha precisa ser diferente da atual.'
    if (form.confirm !== form.next) next.confirm = 'As senhas não conferem.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGlobalError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await auth.changePassword(form.current, form.next)
      setDone(true)
    } catch (err) {
      if (err instanceof AuthError && err.code === 'invalid-credentials') {
        setErrors((s) => ({ ...s, current: 'Senha atual incorreta.' }))
      } else {
        setGlobalError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="Senha alterada"
        title="Tudo certo"
        subtitle="Sua senha foi atualizada com sucesso."
        footer={
          <Link to="/login" className="inline-flex items-center gap-1.5 text-teal-300 hover:text-teal-200">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        }
      >
        <Alert variant="success">
          Por segurança, outras sessões ativas foram encerradas. Reentre nos demais dispositivos.
        </Alert>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Conta"
      title="Alterar senha"
      subtitle="Recomendamos trocar sua senha a cada 90 dias."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-teal-300 hover:text-teal-200">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      }
    >
      {globalError ? (
        <Alert variant="destructive" className="mb-5">
          {globalError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField id="current" label="Senha atual" error={errors.current}>
          <PasswordInput
            id="current"
            name="current"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => update('current', e.target.value)}
            data-testid="change-current"
            required
          />
        </FormField>

        <FormField id="next" label="Nova senha" error={errors.next}>
          <PasswordInput
            id="next"
            name="next"
            autoComplete="new-password"
            placeholder="Mín. 12 caracteres"
            value={form.next}
            onChange={(e) => update('next', e.target.value)}
            data-testid="change-next"
            required
          />
          {form.next ? <PasswordStrength value={form.next} /> : null}
        </FormField>

        <FormField id="confirm" label="Confirme a nova senha" error={errors.confirm}>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => update('confirm', e.target.value)}
            data-testid="change-confirm"
            required
          />
        </FormField>

        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={submitting}
          data-testid="change-submit"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Salvar nova senha
        </Button>
      </form>
    </AuthShell>
  )
}
