/**
 * Issue #3 — Feature: `tenant_uuid` exposto pelo idp-api
 *
 *   Scenario: buildAccessClaims emite tenant_id no JWT
 *     Given um login válido que devolve access_token
 *     When decodifico o payload do JWT
 *     Then o claim "tenant_id" está presente
 *     And o valor de "tenant_id" é um UUID v4
 *     And o claim "account_id" continua presente por compatibilidade (string do BigInt)
 */
import {
  buildAccessClaims,
  buildIdTokenClaims,
  ClaimsInput,
} from '../../../src/modules/token/application/jwt-claims.builder';
import type { UserRoleSummary } from '../../../src/modules/roles/role-resolver.service';

const TENANT_A = '8b6c1e33-1c57-4f85-a8fa-1025451490a4';
const TENANT_B = '00c6f721-3d5a-49b7-9aa3-0bf2541b1d18';

function summary(opts: Partial<UserRoleSummary> & { accountId: bigint; tenantUuid: string }): UserRoleSummary {
  return {
    accountId: opts.accountId,
    accountCustomerId: opts.accountCustomerId ?? opts.accountId,
    tenantUuid: opts.tenantUuid,
    role: opts.role ?? 'doctor',
    doctorId: opts.doctorId ?? null,
    clientId: opts.clientId ?? null,
    employeeId: opts.employeeId ?? null,
  };
}

function input(active: UserRoleSummary, all: UserRoleSummary[] = [active]): ClaimsInput {
  return {
    idpUserId: 42n,
    email: 'dra.mariana@example.com',
    emailVerified: true,
    clientId: 'plexcare-login-web',
    audience: 'plexcare-room-service',
    active,
    all,
  };
}

describe('buildAccessClaims — tenant_id (Issue #3)', () => {
  it('emite claim tenant_id com o UUID do account ativo', () => {
    const claims = buildAccessClaims(input(summary({ accountId: 1n, tenantUuid: TENANT_A })));

    expect(claims.tenant_id).toBe(TENANT_A);
  });

  it('preserva account_id como string por compatibilidade', () => {
    const claims = buildAccessClaims(input(summary({ accountId: 7n, tenantUuid: TENANT_A })));

    expect(claims.account_id).toBe('7');
  });

  it('tenant_id é um UUID v4 (formato 8-4-4-4-12 hex)', () => {
    const claims = buildAccessClaims(input(summary({ accountId: 1n, tenantUuid: TENANT_A })));

    expect(claims.tenant_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('role-switch atualiza tenant_id para o tenant da nova account', () => {
    const accountA = summary({ accountId: 1n, tenantUuid: TENANT_A });
    const accountB = summary({ accountId: 2n, tenantUuid: TENANT_B, role: 'admin' });

    const beforeSwitch = buildAccessClaims(input(accountA, [accountA, accountB]));
    const afterSwitch = buildAccessClaims(input(accountB, [accountA, accountB]));

    expect(beforeSwitch.tenant_id).toBe(TENANT_A);
    expect(afterSwitch.tenant_id).toBe(TENANT_B);
  });

  it.each([
    { name: 'happy minimal', accountId: 1n, role: 'doctor' },
    { name: 'admin role', accountId: 2n, role: 'admin' },
    { name: 'employee role', accountId: 3n, role: 'employee' },
  ])('preserva claims pré-existentes em cenário "$name"', ({ accountId, role }) => {
    const claims = buildAccessClaims(
      input(summary({ accountId, tenantUuid: TENANT_A, role })),
    );

    expect(claims.sub).toBe('42');
    expect(claims.account_id).toBe(accountId.toString());
    expect(claims.active_role).toBe(role);
    expect(claims.client_id).toBe('plexcare-login-web');
    expect(claims.audience).toBe('plexcare-room-service');
    expect(claims.tenant_id).toBe(TENANT_A);
  });
});

describe('buildIdTokenClaims — NÃO inclui tenant_id (escopo OIDC identity)', () => {
  it('id_token não carrega tenant_id (claim é exclusivo do access_token)', () => {
    const claims = buildIdTokenClaims(input(summary({ accountId: 1n, tenantUuid: TENANT_A })));

    // id_token segue OIDC core — não vaza identidade de tenant
    const probe = claims as { tenant_id?: string };
    expect(probe.tenant_id).toBeUndefined();
  });
});
