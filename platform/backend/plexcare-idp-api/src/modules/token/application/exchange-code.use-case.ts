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

    // The authenticated user identity was bound to the PKCE state at /v1/auth/login.
    // We trust that value as authoritative — never re-derive from heuristics.
    const idpUser = await this.prisma.idpUser.findUnique({ where: { id: consumed.idpUserId } });
    if (!idpUser) {
      throw new AppException('me_no_active_role', { detail: 'idp_user row not found' });
    }

    const accountIdBig = input.account_id ? BigInt(input.account_id) : undefined;
    const { active, all } = await this.roleResolver.resolveActive({
      idpUserId: idpUser.id,
      ...(accountIdBig !== undefined ? { requestedAccountId: accountIdBig } : {}),
    });

    const claimsBase = {
      idpUserId: idpUser.id,
      email: idpUser.login,
      emailVerified: consumed.emailVerified,
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
}
