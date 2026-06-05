import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export interface CurrentUserCtx {
  idpUserId: bigint;
  accountId: bigint | null;
  clientId: string;
  activeRole: string | null;
  roles: string[];
  email: string;
  emailVerified: boolean;
  sessionId?: string;
  /** Original kid from the JWT header — useful for audit logging. */
  kid: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserCtx => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: CurrentUserCtx }>();
    if (!req.user) throw new Error('CurrentUser used without JwtAuthGuard');
    return req.user;
  },
);
