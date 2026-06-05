// Cliente HTTP do IdP. Substitui a chamada direta a Keycloak quando o
// `plexcare-idp-api` (BFF) estiver em pé. Em dev, aponta para um stub local —
// as telas tratam tanto sucesso quanto erro tipado.

const BASE_URL = import.meta.env.VITE_AUTH_API_URL ?? 'http://localhost:8090'

/** Erro tipado vindo da API de auth. */
export class AuthError extends Error {
  constructor(message, { code, status, fields } = {}) {
    super(message)
    this.name = 'AuthError'
    this.code = code ?? 'unknown'
    this.status = status ?? 0
    this.fields = fields ?? {}
  }
}

async function request(path, body) {
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new AuthError('Não foi possível conectar ao servidor de autenticação.', {
      code: 'network',
    })
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* respostas vazias são esperadas em alguns endpoints */
  }

  if (!res.ok) {
    throw new AuthError(payload?.message ?? 'Falha na requisição.', {
      code: payload?.code,
      status: res.status,
      fields: payload?.fields,
    })
  }
  return payload
}

export const auth = {
  /** POST /auth/login — { email, password } → { accessToken, refreshToken } */
  login: (email, password) => request('/auth/login', { email, password }),

  /** POST /auth/signup — { name, email, password, tenantSlug? } */
  signup: (data) => request('/auth/signup', data),

  /** POST /auth/forgot-password — { email } */
  forgotPassword: (email) => request('/auth/forgot-password', { email }),

  /** POST /auth/reset-password — { token, password } */
  resetPassword: (token, password) => request('/auth/reset-password', { token, password }),

  /** POST /auth/change-password — { currentPassword, newPassword } (autenticado) */
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { currentPassword, newPassword }),

  /** Redireciona para fluxo OIDC do provider social. */
  socialRedirect(provider) {
    const issuer = import.meta.env.VITE_OIDC_ISSUER
    const clientId = import.meta.env.VITE_OIDC_CLIENT_ID
    const redirectUri = import.meta.env.VITE_DEFAULT_REDIRECT_URI ?? window.location.origin
    if (!issuer || !clientId) {
      throw new AuthError('OIDC não configurado.', { code: 'oidc-missing-config' })
    }
    const url = new URL(`${issuer}/protocol/openid-connect/auth`)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid profile email')
    url.searchParams.set('kc_idp_hint', provider)
    window.location.assign(url.toString())
  },
}
