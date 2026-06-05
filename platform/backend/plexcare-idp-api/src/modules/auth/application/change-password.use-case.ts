import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { KeycloakService } from '../../keycloak/keycloak.service';
import { SessionService } from '../../sessions/session.service';
import { OutboxService } from '../../outbox/outbox.service';
import { AppException } from '../../../shared/errors/app-exception';
import { validatePassword } from '../../../shared/auth/password-policy';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kc: KeycloakService,
    private readonly sessions: SessionService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * The current session's refresh token is preserved; all other sessions of
   * the same user are revoked.
   */
  async execute(input: {
    idpUserId: bigint;
    currentPassword: string;
    newPassword: string;
    currentSessionId?: string;
    email: string;
  }): Promise<void> {
    validatePassword(input.newPassword, 'password_policy_violation');

    // Verify current password via direct grant.
    await this.kc.directGrant(input.email, input.currentPassword);

    const idpUser = await this.prisma.idpUser.findUniqueOrThrow({ where: { id: input.idpUserId } });
    await this.kc.resetPassword(idpUser.keycloakUserId, input.newPassword);

    // Revoke all sessions EXCEPT current.
    const others = await this.prisma.idpSession.findMany({
      where: {
        idpUserId: input.idpUserId,
        revokedAt: null,
        ...(input.currentSessionId ? { id: { not: input.currentSessionId } } : {}),
      },
      select: { id: true },
    });
    for (const s of others) {
      await this.sessions.revoke(s.id, 'password_changed');
    }
    await this.outbox.publishStandalone({
      type: 'idp.user.password_changed',
      subject: `idp_user/${input.idpUserId}`,
      data: {
        idp_user_id: input.idpUserId.toString(),
        reason: 'self_change',
        changed_at: new Date().toISOString(),
      },
    });
  }
}
