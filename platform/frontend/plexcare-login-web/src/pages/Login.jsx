import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'

import AuthShell from '@/components/AuthShell'
import Divider from '@/components/Divider'
import FormField from '@/components/FormField'
import PasswordInput from '@/components/PasswordInput'
import SocialButtons from '@/components/SocialButtons'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { auth, AuthError } from '@/lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState(null)

  function validate() {
    const next = {}
    if (!email) next.email = 'Informe seu e-mail.'
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'E-mail inválido.'
    if (!password) next.password = 'Informe sua senha.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGlobalError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await auth.login(email, password)
      const redirect =
        new URLSearchParams(window.location.search).get('redirect') ||
        import.meta.env.VITE_DEFAULT_REDIRECT_URI ||
        '/'
      window.location.assign(redirect)
    } catch (err) {
      if (err instanceof AuthError && err.code === 'invalid-credentials') {
        setGlobalError('E-mail ou senha incorretos.')
      } else if (err instanceof AuthError && err.code === 'network') {
        setGlobalError('Não conseguimos contatar o servidor. Verifique sua conexão.')
      } else {
        setGlobalError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Entrar"
      title="Bem-vindo de volta"
      subtitle="Acesse o painel para gerenciar consultas, salas e pacientes."
      footer={
        <>
          Novo por aqui?{' '}
          <Link
            to="/signup"
            className="font-medium text-teal-300 hover:text-teal-200"
            data-testid="link-signup"
          >
            Crie sua conta
          </Link>
        </>
      }
    >
      {globalError ? (
        <Alert variant="destructive" className="mb-5" data-testid="login-error">
          {globalError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField id="email" label="E-mail profissional" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@clinica.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            data-testid="login-email"
            required
          />
        </FormField>

        <FormField id="password" label="Senha" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            data-testid="login-password"
            required
          />
        </FormField>

        <div className="flex items-center justify-between text-sm">
          <Label className="flex cursor-pointer items-center gap-2 text-mute">
            <Checkbox
              checked={remember}
              onCheckedChange={setRemember}
              data-testid="login-remember"
            />
            Manter conectado
          </Label>
          <Link
            to="/forgot-password"
            className="font-medium text-teal-300 hover:text-teal-200"
            data-testid="link-forgot"
          >
            Esqueci minha senha
          </Link>
        </div>

        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={submitting}
          data-testid="login-submit"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          Entrar
        </Button>
      </form>

      <Divider>ou</Divider>
      <SocialButtons />
    </AuthShell>
  )
}
