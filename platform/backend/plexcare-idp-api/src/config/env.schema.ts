import { z } from 'zod';

const nonEmpty = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: nonEmpty('DATABASE_URL'),

    KEYCLOAK_BASE_URL: nonEmpty('KEYCLOAK_BASE_URL'),
    KEYCLOAK_REALM: nonEmpty('KEYCLOAK_REALM'),
    KEYCLOAK_ADMIN_CLIENT_ID: nonEmpty('KEYCLOAK_ADMIN_CLIENT_ID'),
    KEYCLOAK_ADMIN_CLIENT_SECRET: nonEmpty('KEYCLOAK_ADMIN_CLIENT_SECRET'),

    KAFKA_BROKERS: csv,
    KAFKA_CLIENT_ID: z.string().default('plexcare-idp-api'),

    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_FROM: z.string().email().default('noreply@plexcare.com.br'),

    JWKS_KEK_PROVIDER: z.enum(['env', 'kms']).default('env'),
    JWKS_KEK_DEV: z.string().optional(),
    JWKS_KMS_KEY_ID: z.string().optional(),

    ISSUER_URL: nonEmpty('ISSUER_URL').refine((s) => /^https?:\/\//.test(s), {
      message: 'ISSUER_URL must start with http:// or https://',
    }),
    CORS_ALLOWED_ORIGINS: csv,

    PKCE_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    RESET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
    EMAIL_VERIFY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
    IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(900),

    LOCKOUT_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
    LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(5),
    LOCKOUT_BLOCK_SECONDS: z.coerce.number().int().positive().default(900),

    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    // KEK gating: in production, env-based KEK is rejected.
    if (env.NODE_ENV === 'production' && env.JWKS_KEK_PROVIDER === 'env') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWKS_KEK_PROVIDER'],
        message: 'JWKS_KEK_PROVIDER=env is forbidden in production; use kms',
      });
    }
    if (env.JWKS_KEK_PROVIDER === 'env' && !env.JWKS_KEK_DEV) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWKS_KEK_DEV'],
        message: 'JWKS_KEK_DEV is required when JWKS_KEK_PROVIDER=env',
      });
    }
    if (env.JWKS_KEK_PROVIDER === 'kms' && !env.JWKS_KMS_KEY_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWKS_KMS_KEY_ID'],
        message: 'JWKS_KMS_KEY_ID is required when JWKS_KEK_PROVIDER=kms',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function zodValidate(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
