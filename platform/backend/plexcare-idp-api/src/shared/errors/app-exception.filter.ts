import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppException } from './app-exception';
import { ERROR_CATALOG, ErrorCode, typeUriFor } from './error-codes';
import { traceIdFromContext } from './trace-context';

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail: string;
  instance: string;
  trace_id?: string;
  [k: string]: unknown;
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();

    const { body, log } = this.toProblem(exception, req.url ?? '');

    if (log.level === 'error') {
      this.logger.error(log.message, log.stack);
    } else {
      this.logger.warn(log.message);
    }

    res
      .header('content-type', 'application/problem+json; charset=utf-8')
      .status(body.status)
      .send(body);
  }

  private toProblem(
    exception: unknown,
    instance: string,
  ): { body: ProblemBody; log: { level: 'warn' | 'error'; message: string; stack?: string } } {
    const traceId = traceIdFromContext();

    if (exception instanceof AppException) {
      const body: ProblemBody = {
        type: typeUriFor(exception.code),
        title: exception.title,
        status: exception.status,
        code: exception.code,
        detail: exception.detail,
        instance,
        ...(traceId ? { trace_id: traceId } : {}),
        ...(exception.extra ?? {}),
      };
      return {
        body,
        log: {
          level: body.status >= 500 ? 'error' : 'warn',
          message: `${exception.code}: ${exception.detail}`,
          ...(exception.cause instanceof Error && exception.cause.stack
            ? { stack: exception.cause.stack }
            : {}),
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] })?.message
            ? Array.isArray((response as { message: string[] }).message)
              ? (response as { message: string[] }).message.join('; ')
              : ((response as { message: string }).message)
            : exception.message;
      const code: ErrorCode = status === 429 ? 'rate_limited' : 'internal_error';
      return {
        body: {
          type: typeUriFor(code),
          title: ERROR_CATALOG[code].title,
          status,
          code,
          detail,
          instance,
          ...(traceId ? { trace_id: traceId } : {}),
        },
        log: { level: status >= 500 ? 'error' : 'warn', message: `${code}: ${detail}` },
      };
    }

    const code: ErrorCode = 'internal_error';
    const err = exception as Error;
    return {
      body: {
        type: typeUriFor(code),
        title: ERROR_CATALOG[code].title,
        status: ERROR_CATALOG[code].status,
        code,
        detail: ERROR_CATALOG[code].detail,
        instance,
        ...(traceId ? { trace_id: traceId } : {}),
      },
      log: {
        level: 'error',
        message: `internal_error: ${err?.message ?? 'unknown'}`,
        ...(err?.stack ? { stack: err.stack } : {}),
      },
    };
  }
}
