import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'

import AuthShell from '@/components/AuthShell'
import FormField from '@/components/FormField'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { auth, AuthError } from '@/lib/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Informe um e-mail válido.')
      return
    }
    setSubmitting(true)
    try {
      // Resposta neutra: não revelamos se o e-mail existe (evita enumeração).
      await auth.forgotPassword(email).catch(() => null)
      setSent(true)
    } catch (err) {
      if (err instanceof AuthError && err.code === 'network') {
        setError('Não conseguimos contatar o servidor. Tente novamente.')
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="Recuperação de senha"
        title="Verifique seu e-mail"
        subtitle={`Se houver uma conta vinculada a ${email}, você receberá um link para criar uma nova senha em alguns instantes.`}
        footer={
          <Link to="/login" className="inline-flex items-center gap-1.5 text-teal-300 hover:text-teal-200">
            <ArrowLeft className="h-4 w-4" /> Voltar ao login
          </Link>
        }
      >
        <Alert variant="success">
          O link expira em 30 minutos. Não compartilhe esta mensagem com terceiros.
        </Alert>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Recuperação de senha"
      title="Esqueceu sua senha?"
      subtitle="Informe o e-mail cadastrado e enviaremos um link seguro para criar uma nova senha."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-teal-300 hover:text-teal-200">
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </Link>
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField id="email" label="E-mail cadastrado">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@clinica.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="forgot-email"
            required
          />
        </FormField>

        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={submitting}
          data-testid="forgot-submit"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Enviar link de recuperação
        </Button>
      </form>
    </AuthShell>
  )
}
