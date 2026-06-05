import { envSchema, zodValidate } from '../../../src/config/env.schema';

const baseEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'mysql://u:p@localhost:3306/db',
  KEYCLOAK_BASE_URL: 'http://localhost:8088',
  KEYCLOAK_REALM: 'plexcare',
  KEYCLOAK_ADMIN_CLIENT_ID: 'idp-admin',
  KEYCLOAK_ADMIN_CLIENT_SECRET: 'secret',
  ISSUER_URL: 'http://localhost:4000',
  JWKS_KEK_PROVIDER: 'env',
  JWKS_KEK_DEV: 'base64==',
};

describe('envSchema', () => {
  it('parses a valid env with defaults', () => {
    const env = envSchema.parse(baseEnv);
    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.PKCE_STATE_TTL_SECONDS).toBe(300);
    expect(env.LOCKOUT_THRESHOLD).toBe(5);
  });

  it('coerces PORT from string', () => {
    const env = envSchema.parse({ ...baseEnv, PORT: '8080' });
    expect(env.PORT).toBe(8080);
  });

  it('rejects non-numeric PORT', () => {
    expect(() => envSchema.parse({ ...baseEnv, PORT: 'not-a-number' })).toThrow();
  });

  it('requires DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...without } = baseEnv;
    expect(() => envSchema.parse(without)).toThrow(/DATABASE_URL/);
  });

  it('splits CORS_ALLOWED_ORIGINS by comma', () => {
    const env = envSchema.parse({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS: 'http://a.com, http://b.com ,http://c.com',
    });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      'http://a.com',
      'http://b.com',
      'http://c.com',
    ]);
  });

  it('rejects ISSUER_URL without scheme', () => {
    expect(() => envSchema.parse({ ...baseEnv, ISSUER_URL: 'idp.plexcare.com.br' })).toThrow(
      /ISSUER_URL/,
    );
  });

  describe('JWKS_KEK_PROVIDER gating', () => {
    it('rejects provider=env in production', () => {
      expect(() =>
        envSchema.parse({ ...baseEnv, NODE_ENV: 'production', JWKS_KEK_PROVIDER: 'env' }),
      ).toThrow(/forbidden in production/);
    });

    it('requires JWKS_KEK_DEV when provider=env', () => {
      const { JWKS_KEK_DEV: _omit, ...without } = baseEnv;
      expect(() => envSchema.parse(without)).toThrow(/JWKS_KEK_DEV/);
    });

    it('requires JWKS_KMS_KEY_ID when provider=kms', () => {
      expect(() =>
        envSchema.parse({ ...baseEnv, JWKS_KEK_PROVIDER: 'kms' }),
      ).toThrow(/JWKS_KMS_KEY_ID/);
    });

    it('accepts provider=kms with key id', () => {
      const env = envSchema.parse({
        ...baseEnv,
        JWKS_KEK_PROVIDER: 'kms',
        JWKS_KMS_KEY_ID: 'arn:aws:kms:us-east-1:111:key/abc',
      });
      expect(env.JWKS_KEK_PROVIDER).toBe('kms');
    });
  });
});

describe('zodValidate', () => {
  it('returns parsed env when valid', () => {
    const env = zodValidate(baseEnv);
    expect(env.NODE_ENV).toBe('development');
  });

  it('throws aggregated error message on invalid env', () => {
    expect(() => zodValidate({ ...baseEnv, PORT: 'bad', ISSUER_URL: 'no-scheme' })).toThrow(
      /Invalid environment configuration:[\s\S]+PORT[\s\S]+ISSUER_URL/,
    );
  });
});
