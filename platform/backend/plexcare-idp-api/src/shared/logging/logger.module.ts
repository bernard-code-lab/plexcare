import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule, Params } from 'nestjs-pino';

export const REDACT_PATHS = [
  'password',
  'current_password',
  'new_password',
  '*.password',
  '*.current_password',
  '*.new_password',
  'req.headers.authorization',
  'req.headers.cookie',
  'code_verifier',
  '*.code_verifier',
  'private_jwk',
  'private_jwk_encrypted',
  'kek',
  'JWKS_KEK_DEV',
  // LGPD — never log raw PII even if accidentally passed.
  'customer_document',
  '*.customer_document',
  'PII_HASH_PEPPER',
];

function buildPinoParams(): Params {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      formatters: { level: (label) => ({ level: label }) },
      base: { service: 'plexcare-idp-api', env: process.env.NODE_ENV ?? 'development' },
      ...(isProd
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true, translateTime: 'SYS:standard' },
            },
          }),
    },
  };
}

@Module({
  imports: [PinoLoggerModule.forRoot(buildPinoParams())],
})
export class LoggerModule {}
