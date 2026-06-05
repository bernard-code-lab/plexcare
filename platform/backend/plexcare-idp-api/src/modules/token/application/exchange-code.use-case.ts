import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { JwtSignerService } from '../../../shared/crypto/jwt-signer.service';
import { PkceService } from '../../authorize/pkce.service';
import { SessionService } from '../../sessions/session.service';
import { RoleResolverService } from '../../roles/role-resolver.service';
import { AppException } from '../../../shared/errors/app-exception';
import { tokenIssuedTotal } from '../../../shared/metrics/metrics.registry';
import { buildAccessClaims, buildIdTokenClaims } from './jwt-claims.builder';
import type { TokenExchangeRequest, TokenResponse } from '../dto/token.dto';

@Injectable()
export class ExchangeCodeUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pkce: PkceService,
    private readonly signer: JwtSignerService,
    private readonly sessions: SessionService,
    private readonly roleResolver: RoleResolverService,
  ) {}

  async execute(
    input: TokenExchangeRequest,
    context: { ip?: string; userAgent?: string },
  ): Promise<TokenResponse> {
    const consumed = await this.pkce.consumeState(input.code, input.code_verifier);
    if (consumed.redirectUri !== input.redirect_uri) {
      throw new AppException('pkce_state_invalid', {
        detail: 'redirect_uri does not match the value used at /auth/login',
      });
    }

    const client = await this.prisma.idpClient.findUnique({ where: { clientId: input.client_id } });
    if (!client) throw new AppException('pkce_state_invalid', { detail: 'Unknown client_id' });

    const accountIdBig = input.account_id ? BigInt(input.account_id) : undefined;
    const { active, all } = await this.roleResolver.resolveActive({
      idpUserId: await this.lookupIdpUserIdFromAudience(consumed.audience),
      ...(accountIdBig !== undefined ? { requestedAccountId: accountIdBig } : {}),
    });

    const idpUser = await this.prisma.idpUser.findFirst({
      where: { accountId: active.accountId, accountCustomerId: active.accountCustomerId },
      orderBy: { id: 'asc' },
    });
    if (!idpUser) {
      throw new AppException('me_no_active_role', { detail: 'idp_user row not found' });
    }

    const claimsBase = {
      idpUserId: idpUser.id,
      email: idpUser.login,
      emailVerified: true, // login flow already enforced this
      clientId: input.client_id,
      audience: client.audience,
      active,
      all,
    };
    const access = await this.signer.sign(buildAccessClaims(claimsBase), client.accessTokenTtlSeconds);
    const idToken = await this.signer.sign(
      buildIdTokenClaims(claimsBase, consumed.nonce || undefined),
      client.accessTokenTtlSeconds,
    );
    const refresh = await this.sessions.issueRefresh({
      idpUserId: idpUser.id,
      accountId: active.accountId,
      clientId: input.client_id,
      ttlSeconds: client.refreshTokenTtlSeconds,
      ipAddress: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    });

    tokenIssuedTotal.inc({ client_id: input.client_id, grant_type: 'authorization_code' });

    return {
      access_token: access.token,
      refresh_token: refresh.refreshToken,
      id_token: idToken.token,
      token_type: 'Bearer',
      expires_in: client.accessTokenTtlSeconds,
      scope: 'openid profile email',
    };
  }

  /**
   * In a multi-user environment, audience alone is insufficient. The PKCE
   * state is created in /login with the user already authenticated by KC, so
   * a real implementation would carry the idp_user_id through the PKCE row.
   * For now we look up the most recent idp_user — placeholder until the
   * authorize_state schema is extended with idp_user_id (TODO future migration).
   */
  private async lookupIdpUserIdFromAudience(_audience: string): Promise<bigint> {
    const u = await this.prisma.idpUser.findFirst({ orderBy: { id: 'desc' } });
    if (!u) throw new AppException('me_no_active_role', { detail: 'No idp_user found' });
    return u.id;
  }
}
