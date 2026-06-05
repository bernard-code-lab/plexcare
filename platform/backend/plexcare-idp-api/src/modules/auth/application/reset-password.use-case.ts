import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { KeycloakService } from '../../keycloak/keycloak.service';
import { SessionService } from '../../sessions/session.service';
import { OutboxService } from '../../outbox/outbox.service';
import { AppException } from '../../../shared/errors/app-exception';
import { validatePassword } from '../../../shared/auth/password-policy';
import { decodeJwt } from 'jose';

/**
 * The reset token is a Keycloak action-token issued by executeActionsEmail
 * (UPDATE_PASSWORD). It carries the kc user id in its `sub` claim. The IdP
 * does not validate signature here — KC validates when we hit its reset
 * endpoint. We use decodeJwt only to identify which idp_user to act on.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kc: KeycloakService,
    private readonly sessions: SessionService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(resetToken: string, newPassword: string): Promise<void> {
    validatePassword(newPassword, 'password_policy_violation');

    let kcUserId: string;
    try {
      const claims = decodeJwt(resetToken);
      if (typeof claims.sub !== 'string') throw new Error('no sub');
      kcUserId = claims.sub;
    } catch {
      throw new AppException('reset_token_invalid');
    }

    const idpUser = await this.prisma.idpUser.findUnique({ where: { keycloakUserId: kcUserId } });
    if (!idpUser) {
      throw new AppException('reset_token_invalid', { detail: 'No matching IdP user' });
    }

    try {
      await this.kc.resetPassword(kcUserId, newPassword);
    } catch (e) {
      if (e instanceof AppException && e.code === 'service_unavailable') throw e;
      throw new AppException('reset_token_invalid', { cause: e });
    }

    await this.sessions.revokeAllForUser(idpUser.id, 'reset');
    await this.outbox.publishStandalone({
      type: 'idp.user.password_changed',
      subject: `idp_user/${idpUser.id}`,
      data: {
        idp_user_id: idpUser.id.toString(),
        reason: 'reset',
        changed_at: new Date().toISOString(),
      },
    });
  }
}
