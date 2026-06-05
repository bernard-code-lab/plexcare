import type { IdpClaims } from '../../../shared/crypto/jwt-signer.service';
import type { UserRoleSummary } from '../../roles/role-resolver.service';

export interface ClaimsInput {
  idpUserId: bigint;
  email: string;
  emailVerified: boolean;
  clientId: string;
  audience: string;
  active: UserRoleSummary;
  all: UserRoleSummary[];
}

export function buildAccessClaims(input: ClaimsInput): IdpClaims {
  return {
    sub: input.idpUserId.toString(),
    client_id: input.clientId,
    audience: input.audience,
    account_id: input.active.accountId.toString(),
    account_customer_id: input.active.accountCustomerId.toString(),
    active_role: input.active.role,
    roles: Array.from(new Set(input.all.map((r) => r.role))),
    doctor_id: input.active.doctorId?.toString() ?? null,
    client_id_party: input.active.clientId?.toString() ?? null,
    employee_id: input.active.employeeId?.toString() ?? null,
    email: input.email,
    email_verified: input.emailVerified,
    locale: 'pt-BR',
  };
}

export function buildIdTokenClaims(input: ClaimsInput, nonce?: string): IdpClaims & { nonce?: string } {
  return {
    sub: input.idpUserId.toString(),
    client_id: input.clientId,
    audience: input.audience,
    email: input.email,
    email_verified: input.emailVerified,
    ...(nonce ? { nonce } : {}),
  };
}
