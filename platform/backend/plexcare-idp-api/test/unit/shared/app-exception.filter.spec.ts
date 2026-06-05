import { AppException } from '../../../src/shared/errors/app-exception';
import { AppExceptionFilter } from '../../../src/shared/errors/app-exception.filter';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';

type CapturedResponse = {
  status: number | undefined;
  contentType: string | undefined;
  body: Record<string, unknown> | undefined;
};

interface FakeRes {
  header(name: string, value: string): FakeRes;
  status(code: number): FakeRes;
  send(body: Record<string, unknown>): FakeRes;
}

function buildHost(url = '/v1/auth/login'): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = { status: undefined, contentType: undefined, body: undefined };
  const res: FakeRes = {
    header(name: string, value: string): FakeRes {
      if (name.toLowerCase() === 'content-type') captured.contentType = value;
      return res;
    },
    status(code: number): FakeRes {
      captured.status = code;
      return res;
    },
    send(body: Record<string, unknown>): FakeRes {
      captured.body = body;
      return res;
    },
  };
  const req = { url };
  const host = {
    switchToHttp() {
      return {
        getResponse: () => res,
        getRequest: () => req,
      };
    },
  } as unknown as ArgumentsHost;
  return { host, captured };
}

describe('AppExceptionFilter', () => {
  let filter: AppExceptionFilter;

  beforeEach(() => {
    filter = new AppExceptionFilter();
  });

  it('maps AppException → problem+json with code/status/title', () => {
    const { host, captured } = buildHost();
    filter.catch(new AppException('login_invalid_credentials'), host);

    expect(captured.status).toBe(401);
    expect(captured.contentType).toBe('application/problem+json; charset=utf-8');
    expect(captured.body).toMatchObject({
      code: 'login_invalid_credentials',
      status: 401,
      title: 'Credenciais inválidas',
      type: 'https://docs.plexcare.com.br/errors/login_invalid_credentials',
      instance: '/v1/auth/login',
    });
  });

  it('includes extra fields when provided', () => {
    const { host, captured } = buildHost('/v1/auth/login');
    filter.catch(
      new AppException('login_locked', { extra: { retry_after_seconds: 900 } }),
      host,
    );
    expect(captured.body).toMatchObject({ retry_after_seconds: 900 });
  });

  it('maps generic HttpException → 7807 with internal_error code by default', () => {
    const { host, captured } = buildHost();
    filter.catch(new HttpException('boom', HttpStatus.BAD_GATEWAY), host);
    expect(captured.status).toBe(502);
    expect(captured.body).toMatchObject({ code: 'internal_error', detail: 'boom' });
  });

  it('maps unknown errors → 500 internal_error', () => {
    const { host, captured } = buildHost();
    filter.catch(new Error('kaboom'), host);
    expect(captured.status).toBe(500);
    expect(captured.body).toMatchObject({ code: 'internal_error', status: 500 });
  });

  it('maps HttpException 429 → rate_limited', () => {
    const { host, captured } = buildHost();
    filter.catch(new HttpException('too many', HttpStatus.TOO_MANY_REQUESTS), host);
    expect(captured.body).toMatchObject({ code: 'rate_limited', status: 429 });
  });
});
