import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, UserPlus } from 'lucide-react'

import AuthShell from '@/components/AuthShell'
import Divider from '@/components/Divider'
import FormField from '@/components/FormField'
import PasswordInput from '@/components/PasswordInput'
import PasswordStrength from '@/components/PasswordStrength'
import SocialButtons from '@/components/SocialButtons'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { scorePassword } from '@/lib/password'
import { auth, AuthError } from '@/lib/auth'

export default function Signup() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    organization: '',
    password: '',
    confirm: '',
    accept: false,
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [globalError, setGlobalError] = useState(null)

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Informe seu nome.'
    if (!form.email) next.email = 'Informe seu e-mail.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'E-mail inválido.'
    if (!form.password) next.password = 'Crie uma senha.'
    else if (scorePassword(form.password).score < 2)
      next.password = 'A senha precisa ser ao menos razoável.'
    if (form.confirm !== form.password) next.confirm = 'As senhas não conferem.'
    if (!form.accept) next.accept = 'Você precisa aceitar os Termos para continuar.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGlobalError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await auth.signup({
        name: form.name.trim(),
        email: form.email,
        organization: form.organization.trim() || undefined,
        password: form.password,
      })
      setDone(true)
    } catch (err) {
      if (err instanceof AuthError && err.code === 'email-in-use') {
        setErrors((s) => ({ ...s, email: 'Já existe uma conta com este e-mail.' }))
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
        eyebrow="Conta criada"
        title="Verifique seu e-mail"
        subtitle={`Enviamos um link de confirmação para ${form.email}. Abra a mensagem para ativar sua conta.`}
        footer={
          <>
            Já confirmou?{' '}
            <Link to="/login" className="font-medium text-teal-300 hover:text-teal-200">
              Entrar
            </Link>
          </>
        }
      >
        <Alert variant="success">
          Caso não encontre, verifique a caixa de spam ou peça um novo envio.
        </Alert>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Criar conta"
      title="Comece em minutos"
      subtitle="Sua jornada PlexCare em uma única conta — válida para todos os produtos."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-teal-300 hover:text-teal-200">
            Entrar
          </Link>
        </>
      }
    >
      {globalError ? (
        <Alert variant="destructive" className="mb-5">
          {globalError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField id="name" label="Nome completo" error={errors.name}>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Dra. Ana Souza"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            data-testid="signup-name"
            required
          />
        </FormField>

        <FormField id="email" label="E-mail profissional" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@clinica.com.br"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            data-testid="signup-email"
            required
          />
        </FormField>

        <FormField
          id="organization"
          label="Clínica ou empresa (opcional)"
          hint="Você pode convidar a equipe depois."
        >
          <Input
            id="organization"
            name="organization"
            type="text"
            autoComplete="organization"
            placeholder="Clínica Vida"
            value={form.organization}
            onChange={(e) => update('organization', e.target.value)}
            data-testid="signup-org"
          />
        </FormField>

        <FormField id="password" label="Senha" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Mín. 12 caracteres, com letra, número e símbolo"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            data-testid="signup-password"
            required
          />
          {form.password ? <PasswordStrength value={form.password} /> : null}
        </FormField>

        <FormField id="confirm" label="Confirme a senha" error={errors.confirm}>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            placeholder="Repita a senha"
            value={form.confirm}
            onChange={(e) => update('confirm', e.target.value)}
            data-testid="signup-confirm"
            required
          />
        </FormField>

        <div className="space-y-1.5">
          <Label className="flex cursor-pointer items-start gap-3 text-sm text-mute">
            <Checkbox
              checked={form.accept}
              onCheckedChange={(v) => update('accept', v)}
              data-testid="signup-accept"
              aria-invalid={!!errors.accept}
            />
            <span>
              Concordo com os{' '}
              <a
                href="https://plexcare.com.br/termos"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-teal-300 hover:text-teal-200"
              >
                Termos de Uso
              </a>{' '}
              e com a{' '}
              <a
                href="https://plexcare.com.br/privacidade"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-teal-300 hover:text-teal-200"
              >
                Política de Privacidade
              </a>{' '}
              (LGPD).
            </span>
          </Label>
          {errors.accept ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.accept}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={submitting}
          data-testid="signup-submit"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Criar conta
        </Button>
      </form>

      <Divider>ou</Divider>
      <SocialButtons />
    </AuthShell>
  )
}
