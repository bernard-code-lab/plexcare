import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AppException } from '../../shared/errors/app-exception';

export interface UserRoleSummary {
  accountId: bigint;
  accountCustomerId: bigint;
  role: string;
  doctorId: bigint | null;
  clientId: bigint | null;
  employeeId: bigint | null;
}

export interface ResolveInput {
  idpUserId: bigint;
  requestedAccountId?: bigint;
  requestedRole?: string;
}

export interface ResolveResult {
  active: UserRoleSummary;
  all: UserRoleSummary[];
}

@Injectable()
export class RoleResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveActive(input: ResolveInput): Promise<ResolveResult> {
    const rows = await this.prisma.idpUserRole.findMany({
      where: { idpUserId: input.idpUserId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const all: UserRoleSummary[] = rows.map((r) => ({
      accountId: r.accountId,
      accountCustomerId: r.accountCustomerId,
      role: r.role,
      doctorId: r.doctorId,
      clientId: r.clientId,
      employeeId: r.employeeId,
    }));
    if (all.length === 0) {
      throw new AppException('me_no_active_role');
    }

    let candidates = all;
    if (input.requestedAccountId !== undefined) {
      candidates = candidates.filter((r) => r.accountId === input.requestedAccountId);
      if (candidates.length === 0) {
        throw new AppException('account_not_allowed');
      }
    }
    if (input.requestedRole) {
      const narrowed = candidates.filter((r) => r.role === input.requestedRole);
      if (narrowed.length === 0) {
        throw new AppException('account_not_allowed', {
          detail: `Role ${input.requestedRole} not granted on requested account`,
        });
      }
      candidates = narrowed;
    }

    return { active: candidates[0]!, all };
  }
}
