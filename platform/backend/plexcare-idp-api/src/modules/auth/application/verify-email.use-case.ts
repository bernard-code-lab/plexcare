import { Injectable } from '@nestjs/common';
import { decodeJwt } from 'jose';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { OutboxService } from '../../outbox/outbox.service';
import { AppException } from '../../../shared/errors/app-exception';
import { hashEmail } from '../../../shared/auth/pii';

/**
 * The verification token is a Keycloak action-token. We decode it locally
 * (no signature validation — KC already validated when redirecting back).
 * We then emit idp.user.email_verified. The KC realm itself toggles
 * email_verified=true when the user clicks the link; this endpoint only
 * acknowledges and propagates.
 */
@Injectable()
export class VerifyEmailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(verificationToken: string): Promise<{
    idp_user_id: string;
    email: string;
    email_verified: boolean;
  }> {
    let kcUserId: string;
    try {
      const claims = decodeJwt(verificationToken);
      if (typeof claims.sub !== 'string') throw new Error('no sub');
      kcUserId = claims.sub;
    } catch {
      throw new AppException('email_verify_invalid');
    }
    const user = await this.prisma.idpUser.findUnique({ where: { keycloakUserId: kcUserId } });
    if (!user) {
      throw new AppException('email_verify_invalid', { detail: 'No matching IdP user' });
    }
    await this.outbox.publishStandalone({
      type: 'idp.user.email_verified',
      subject: `idp_user/${user.id}`,
      data: {
        idp_user_id: user.id.toString(),
        // LGPD: hash on the bus; the API response below keeps the email
        // because the caller is the verified user themselves.
        email_hash: hashEmail(user.login),
        verified_at: new Date().toISOString(),
      },
    });
    return { idp_user_id: user.id.toString(), email: user.login, email_verified: true };
  }
}
