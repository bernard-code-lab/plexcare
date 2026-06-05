import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { JwtSignerService } from '../../../shared/crypto/jwt-signer.service';
import { SessionService } from '../../sessions/session.service';
import { RoleResolverService } from '../../roles/role-resolver.service';
import { AppException } from '../../../shared/errors/app-exception';
import { tokenIssuedTotal } from '../../../shared/metrics/metrics.registry';
import { buildAccessClaims } from './jwt-claims.builder';
import type { RefreshRequest, TokenResponse } from '../dto/token.dto';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly signer: JwtSignerService,
    private readonly roleResolver: RoleResolverService,
  ) {}

  async execute(input: RefreshRequest): Promise<TokenResponse> {
    const client = await this.prisma.idpClient.findUnique({ where: { clientId: input.client_id } });
    if (!client) throw new AppException('refresh_invalid', { detail: 'Unknown client_id' });

    const rotated = await this.sessions.rotate(input.refresh_token, client.refreshTokenTtlSeconds);
    if (rotated.clientId !== input.client_id) {
      // client_id mismatch — treat as invalid (and we already rotated; the new
      // refresh is bound to the original client).
      throw new AppException('refresh_invalid', { detail: 'client_id mismatch' });
    }

    const { active, all } = await this.roleResolver.resolveActive({
      idpUserId: rotated.idpUserId,
      requestedAccountId: rotated.accountId,
    });
    const idpUser = await this.prisma.idpUser.findUniqueOrThrow({ where: { id: rotated.idpUserId } });

    const access = await this.signer.sign(
      buildAccessClaims({
        idpUserId: rotated.idpUserId,
        email: idpUser.login,
        emailVerified: true,
        clientId: input.client_id,
        audience: client.audience,
        active,
        all,
      }),
      client.accessTokenTtlSeconds,
    );

    tokenIssuedTotal.inc({ client_id: input.client_id, grant_type: 'refresh_token' });

    return {
      access_token: access.token,
      refresh_token: rotated.refreshToken,
      id_token: access.token, // refresh does not re-issue id_token; reuse access shape.
      token_type: 'Bearer',
      expires_in: client.accessTokenTtlSeconds,
      scope: 'openid profile email',
    };
  }
}
