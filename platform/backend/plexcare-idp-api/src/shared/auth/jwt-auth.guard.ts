import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtSignerService } from '../crypto/jwt-signer.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../errors/app-exception';
import type { CurrentUserCtx } from './current-user';

const AUDIENCE_CACHE_TTL_MS = 60_000;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private audienceCache: { loadedAt: number; values: string[] } | null = null;

  constructor(
    private readonly signer: JwtSignerService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: CurrentUserCtx }>();
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      throw new AppException('token_invalid', { detail: 'Missing Authorization header' });
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new AppException('token_invalid', { detail: 'Expected "Bearer <jwt>"' });
    }

    const audiences = await this.loadAudiences();
    if (audiences.length === 0) {
      // Fail closed: no registered clients means no token can be trusted here.
      throw new AppException('token_invalid', { detail: 'No registered audiences' });
    }
    const claims = await this.signer.verify(token, audiences);
    const sub = typeof claims.sub === 'string' ? BigInt(claims.sub) : 0n;
    if (sub === 0n) throw new AppException('token_invalid', { detail: 'sub missing' });

    const roles = Array.isArray(claims['roles']) ? (claims['roles'] as string[]) : [];
    req.user = {
      idpUserId: sub,
      accountId:
        typeof claims['account_id'] === 'string' ? BigInt(claims['account_id'] as string) : null,
      clientId: typeof claims['client_id'] === 'string' ? (claims['client_id'] as string) : '',
      activeRole: typeof claims['active_role'] === 'string' ? (claims['active_role'] as string) : null,
      roles,
      email: typeof claims['email'] === 'string' ? (claims['email'] as string) : '',
      emailVerified: Boolean(claims['email_verified']),
      kid: claims.kid,
    };
    return true;
  }

  private async loadAudiences(): Promise<string[]> {
    if (this.audienceCache && Date.now() - this.audienceCache.loadedAt < AUDIENCE_CACHE_TTL_MS) {
      return this.audienceCache.values;
    }
    const rows = await this.prisma.idpClient.findMany({ select: { clientId: true, audience: true } });
    // Accept either the literal client_id or the configured audience — both
    // appear as `aud` in tokens issued by this IdP (audience is set from the
    // client's `audience` column, see TokenController.exchange).
    const values = Array.from(new Set(rows.flatMap((r) => [r.clientId, r.audience])));
    this.audienceCache = { loadedAt: Date.now(), values };
    return values;
  }
}
