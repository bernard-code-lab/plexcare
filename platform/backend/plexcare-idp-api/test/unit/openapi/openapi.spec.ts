import { buildOpenApiDocument } from '../../../src/openapi/openapi.builder';

describe('buildOpenApiDocument', () => {
  const doc = buildOpenApiDocument();

  it('is OpenAPI 3.1', () => {
    expect(doc.openapi).toBe('3.1.0');
  });

  it.each([
    '/v1/auth/signup',
    '/v1/auth/login',
    '/v1/auth/forgot-password',
    '/v1/auth/reset-password',
    '/v1/auth/email/verify',
    '/v1/auth/change-password',
    '/v1/token',
    '/v1/token/refresh',
    '/v1/token/revoke',
    '/v1/me',
    '/v1/me/roles',
    '/v1/me/switch-account',
    '/v1/me/sessions',
    '/v1/me/sessions/{id}',
    '/.well-known/jwks.json',
    '/.well-known/openid-configuration',
    '/health',
    '/ready',
    '/metrics',
  ])('declares path %s', (path) => {
    expect(doc.paths?.[path]).toBeDefined();
  });

  it('declares bearerAuth security scheme', () => {
    expect(doc.components?.securitySchemes?.['bearerAuth']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('declares Problem response component referencing application/problem+json', () => {
    const problem = doc.components?.responses?.['Problem'] as { content?: Record<string, unknown> };
    expect(problem?.content?.['application/problem+json']).toBeDefined();
  });
});
