import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtSignerService } from '../crypto/jwt-signer.service';
import { AppException } from '../errors/app-exception';
import type { CurrentUserCtx } from './current-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly signer: JwtSignerService) {}

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

    const claims = await this.signer.verify(token);
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
}
