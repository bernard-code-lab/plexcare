/**
 * Canonical IdP error codes mirroring AuthError.code in plexcare-login-web.
 * Each code maps to an HTTP status, a default title and a problem+json type URI.
 */

export type ErrorCode =
  | 'signup_email_taken'
  | 'signup_password_weak'
  | 'login_invalid_credentials'
  | 'login_locked'
  | 'login_email_not_verified'
  | 'pkce_state_invalid'
  | 'pkce_verifier_mismatch'
  | 'token_invalid'
  | 'refresh_invalid'
  | 'refresh_reuse_detected'
  | 'me_no_active_role'
  | 'account_not_allowed'
  | 'email_verify_invalid'
  | 'reset_token_invalid'
  | 'password_policy_violation'
  | 'rate_limited'
  | 'service_unavailable'
  | 'internal_error';

export interface ErrorDescriptor {
  status: number;
  title: string;
  detail: string;
}

export const ERROR_CATALOG: Record<ErrorCode, ErrorDescriptor> = {
  signup_email_taken: {
    status: 409,
    title: 'Email já registrado',
    detail: 'Já existe uma conta com este endereço de email.',
  },
  signup_password_weak: {
    status: 422,
    title: 'Senha não atende à política',
    detail: 'A senha não satisfaz a política mínima (12 caracteres + variedade).',
  },
  login_invalid_credentials: {
    status: 401,
    title: 'Credenciais inválidas',
    detail: 'Email ou senha incorretos.',
  },
  login_locked: {
    status: 423,
    title: 'Conta temporariamente bloqueada',
    detail: 'Muitas tentativas com falha. Tente novamente em alguns minutos.',
  },
  login_email_not_verified: {
    status: 403,
    title: 'Email não verificado',
    detail: 'Verifique seu email antes de fazer login.',
  },
  pkce_state_invalid: {
    status: 400,
    title: 'Estado de autorização inválido',
    detail: 'O state está ausente, expirado ou já foi consumido.',
  },
  pkce_verifier_mismatch: {
    status: 400,
    title: 'PKCE verifier não corresponde',
    detail: 'O code_verifier não corresponde ao code_challenge enviado no login.',
  },
  token_invalid: {
    status: 401,
    title: 'Token inválido',
    detail: 'O access token está ausente, inválido, expirado ou usa uma chave desconhecida.',
  },
  refresh_invalid: {
    status: 401,
    title: 'Refresh token inválido',
    detail: 'O refresh token está ausente, expirado, revogado ou pertence a outro cliente.',
  },
  refresh_reuse_detected: {
    status: 401,
    title: 'Reuso de refresh detectado',
    detail: 'Refresh já rotacionado. Todas as sessões deste usuário foram revogadas.',
  },
  me_no_active_role: {
    status: 403,
    title: 'Usuário sem papel ativo',
    detail: 'Nenhum papel válido encontrado para este usuário.',
  },
  account_not_allowed: {
    status: 403,
    title: 'Account não permitido',
    detail: 'O usuário não tem papel ativo no account solicitado.',
  },
  email_verify_invalid: {
    status: 400,
    title: 'Token de verificação inválido',
    detail: 'O token de verificação de email está inválido ou expirado.',
  },
  reset_token_invalid: {
    status: 400,
    title: 'Token de reset inválido',
    detail: 'O token de reset de senha está inválido ou expirado.',
  },
  password_policy_violation: {
    status: 422,
    title: 'Senha não atende à política',
    detail: 'A nova senha não satisfaz a política mínima.',
  },
  rate_limited: {
    status: 429,
    title: 'Rate limit excedido',
    detail: 'Muitas requisições. Aguarde e tente novamente.',
  },
  service_unavailable: {
    status: 503,
    title: 'Serviço indisponível',
    detail: 'Uma dependência crítica (DB, Keycloak ou Kafka) está indisponível.',
  },
  internal_error: {
    status: 500,
    title: 'Erro interno',
    detail: 'Erro inesperado. Tente novamente em instantes.',
  },
};

export const TYPE_URI_BASE = 'https://docs.plexcare.com.br/errors';

export function typeUriFor(code: ErrorCode): string {
  return `${TYPE_URI_BASE}/${code}`;
}
