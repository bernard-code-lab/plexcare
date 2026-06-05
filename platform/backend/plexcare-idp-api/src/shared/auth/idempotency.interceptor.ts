import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EnvService } from '../../config/env.service';

/**
 * Stores and replays the JSON body of POST responses keyed by Idempotency-Key
 * + route. TTL controlled by IDEMPOTENCY_TTL_SECONDS. No-op when the header
 * is absent.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const key = req.headers['idempotency-key'];
    const route = `${req.method ?? 'GET'} ${req.routeOptions?.url ?? req.url}`;

    if (!key || typeof key !== 'string') return next.handle();

    return from(
      this.prisma.idpIdempotency.findUnique({ where: { key_route: { key, route } } }),
    ).pipe(
      switchMap((existing) => {
        if (existing && existing.expiresAt > new Date()) {
          return of(existing.responseBody);
        }
        return next.handle().pipe(
          tap((body: unknown) => {
            void this.persist(key, route, body);
          }),
        );
      }),
    );
  }

  private async persist(key: string, route: string, body: unknown): Promise<void> {
    const expiresAt = new Date(Date.now() + this.env.get('IDEMPOTENCY_TTL_SECONDS') * 1000);
    try {
      await this.prisma.idpIdempotency.upsert({
        where: { key_route: { key, route } },
        create: {
          key,
          route,
          responseStatus: 200,
          responseBody: body as Prisma.InputJsonValue,
          expiresAt,
        },
        update: { responseBody: body as Prisma.InputJsonValue, expiresAt },
      });
    } catch {
      // ignore — idempotency is best-effort cache
    }
  }
}
