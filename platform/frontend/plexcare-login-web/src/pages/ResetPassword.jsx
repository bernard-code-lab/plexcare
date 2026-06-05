import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'

import AuthShell from '@/components/AuthShell'
import FormField from '@/components/FormField'
import PasswordInput from '@/components/PasswordInput'
import PasswordStrength from '@/components/PasswordStrength'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { scorePassword } from '@/lib/password'
import { auth, AuthError } from '@/lib/auth'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState(null)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <AuthShell
        eyebrow="Link inválido"
        title="Token ausente"
        subtitle="O link que você usou não contém um token de redefinição. Solicite um novo e tente de novo."
        footer={
          <Link to="/forgot-password" className="text-teal-300 hover:text-teal-200">
            Pedir um novo link
          </Link>
        }
      >
        <Alert variant="destructive">
          Para sua segurança, links de redefinição expiram em 30 minutos.
        </Alert>
      </AuthShell>
    )
  }

  function validate() {
    const next = {}
    if (!password) next.password = 'Crie uma nova senha.'
    else if (scorePassword(password).score < 2) next.password = 'A senha precisa ser ao menos razoável.'
    if (confirm !== password) next.confirm = 'As senhas não conferem.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGlobalError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await auth.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      if (err instanceof AuthError && err.code === 'token-expired') {
        setGlobalError('Este link expirou. Solicite uma nova recuperação.')
      } else if (err instanceof AuthError && err.code === 'token-invalid') {
        setGlobalError('Link inválido. Solicite uma nova recuperação.')
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
        eyebrow="Senha redefinida"
        title="Tudo certo"
        subtitle="Sua senha foi atualizada. Faça login com a nova credencial."
        footer={
          <Link to="/login" className="inline-flex items-center gap-1.5 text-teal-300 hover:text-teal-200">
            <ArrowLeft className="h-4 w-4" /> Ir para o login
          </Link>
        }
      >
        <Alert variant="success">
          Por segurança, todas as sessões ativas foram encerradas. Você precisará entrar novamente
          em cada dispositivo.
        </Alert>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Nova senha"
      title="Crie uma senha forte"
      subtitle="Use ao menos 12 caracteres, combinando letras, números e símbolos."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-teal-300 hover:text-teal-200">
          <ArrowLeft className="h-4 w-4" /> Cancelar e voltar
        </Link>
      }
    >
      {globalError ? (
        <Alert variant="destructive" className="mb-5">
          {globalError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField id="password" label="Nova senha" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Mín. 12 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="reset-password"
            required
          />
          {password ? <PasswordStrength value={password} /> : null}
        </FormField>

        <FormField id="confirm" label="Confirme a nova senha" error={errors.confirm}>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            placeholder="Repita a senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            data-testid="reset-confirm"
            required
          />
        </FormField>

        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={submitting}
          data-testid="reset-submit"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Redefinir senha
        </Button>
      </form>
    </AuthShell>
  )
}
