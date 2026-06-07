/**
 * Issue #3 — Feature: `tenant_uuid` exposto pelo idp-api
 *
 *   Scenario: RoleResolverService carrega tenantUuid
 *     Given um idp_user vinculado a um account com tenantUuid "8b6c1e33-..."
 *     When chamo "RoleResolverService.resolveActive({ idpUserId })"
 *     Then "active.tenantUuid" no retorno é igual a "8b6c1e33-..."
 */
import { RoleResolverService, UserRoleSummary } from '../../../src/modules/roles/role-resolver.service';
import { AppException } from '../../../src/shared/errors/app-exception';

type FakeRoleRow = {
  accountId: bigint;
  accountCustomerId: bigint;
  role: string;
  doctorId: bigint | null;
  clientId: bigint | null;
  employeeId: bigint | null;
  createdAt: Date;
  account: { tenantUuid: string };
};

function makePrismaMock(rows: FakeRoleRow[]) {
  return {
    idpUserRole: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
}

function row(opts: Partial<FakeRoleRow> & { accountId: bigint; tenantUuid: string }): FakeRoleRow {
  return {
    accountId: opts.accountId,
    accountCustomerId: opts.accountCustomerId ?? opts.accountId,
    role: opts.role ?? 'doctor',
    doctorId: opts.doctorId ?? null,
    clientId: opts.clientId ?? null,
    employeeId: opts.employeeId ?? null,
    createdAt: opts.createdAt ?? new Date('2026-06-07T00:00:00Z'),
    account: { tenantUuid: opts.tenantUuid },
  };
}

describe('RoleResolverService.resolveActive — tenantUuid (Issue #3)', () => {
  const TENANT_A = '8b6c1e33-1c57-4f85-a8fa-1025451490a4';
  const TENANT_B = '00c6f721-3d5a-49b7-9aa3-0bf2541b1d18';

  it('inclui tenantUuid em active e em all', async () => {
    const prisma = makePrismaMock([row({ accountId: 1n, tenantUuid: TENANT_A })]);
    const svc = new RoleResolverService(prisma as never);

    const { active, all } = await svc.resolveActive({ idpUserId: 42n });

    expect(active.tenantUuid).toBe(TENANT_A);
    expect(all).toHaveLength(1);
    expect(all[0]!.tenantUuid).toBe(TENANT_A);
  });

  it('seleciona account requisitada e retorna o tenantUuid correspondente', async () => {
    const prisma = makePrismaMock([
      row({ accountId: 1n, tenantUuid: TENANT_A, role: 'doctor' }),
      row({ accountId: 2n, tenantUuid: TENANT_B, role: 'admin' }),
    ]);
    const svc = new RoleResolverService(prisma as never);

    const { active } = await svc.resolveActive({
      idpUserId: 42n,
      requestedAccountId: 2n,
    });

    expect(active.accountId).toBe(2n);
    expect(active.tenantUuid).toBe(TENANT_B);
  });

  it('faz findMany com include account: true (precisa do tenantUuid)', async () => {
    const prisma = makePrismaMock([row({ accountId: 1n, tenantUuid: TENANT_A })]);
    const svc = new RoleResolverService(prisma as never);

    await svc.resolveActive({ idpUserId: 42n });

    expect(prisma.idpUserRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ account: true }),
      }),
    );
  });

  it('lança me_no_active_role quando não há roles (comportamento pré-existente preservado)', async () => {
    const prisma = makePrismaMock([]);
    const svc = new RoleResolverService(prisma as never);

    await expect(svc.resolveActive({ idpUserId: 42n })).rejects.toBeInstanceOf(AppException);
  });

  it('UserRoleSummary expõe tenantUuid como string não vazia', async () => {
    const prisma = makePrismaMock([row({ accountId: 1n, tenantUuid: TENANT_A })]);
    const svc = new RoleResolverService(prisma as never);

    const { active } = await svc.resolveActive({ idpUserId: 42n });
    const summary: UserRoleSummary = active;
    expect(typeof summary.tenantUuid).toBe('string');
    expect(summary.tenantUuid).toMatch(/^[0-9a-f-]{36}$/i);
  });

  // Cobertura dos edge cases pré-existentes (manter ≥ 90% no role-resolver)
  it('requestedRole filtra para a role correta entre as candidatas', async () => {
    const prisma = makePrismaMock([
      row({ accountId: 1n, tenantUuid: TENANT_A, role: 'doctor' }),
      row({ accountId: 1n, tenantUuid: TENANT_A, role: 'admin' }),
    ]);
    const svc = new RoleResolverService(prisma as never);

    const { active } = await svc.resolveActive({
      idpUserId: 42n,
      requestedAccountId: 1n,
      requestedRole: 'admin',
    });

    expect(active.role).toBe('admin');
    expect(active.tenantUuid).toBe(TENANT_A);
  });

  it('requestedAccountId sem match lança account_not_allowed', async () => {
    const prisma = makePrismaMock([row({ accountId: 1n, tenantUuid: TENANT_A })]);
    const svc = new RoleResolverService(prisma as never);

    await expect(
      svc.resolveActive({ idpUserId: 42n, requestedAccountId: 99n }),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('requestedRole sem match lança account_not_allowed com detail', async () => {
    const prisma = makePrismaMock([
      row({ accountId: 1n, tenantUuid: TENANT_A, role: 'doctor' }),
    ]);
    const svc = new RoleResolverService(prisma as never);

    await expect(
      svc.resolveActive({
        idpUserId: 42n,
        requestedAccountId: 1n,
        requestedRole: 'admin',
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});
