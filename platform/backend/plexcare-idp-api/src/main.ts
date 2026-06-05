// MUST be first: OpenTelemetry auto-instrumentation needs to patch http/
// fastify/pino/prisma BEFORE any module requires them.
import './shared/otel/instrument';

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { Logger } from 'nestjs-pino';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi/openapi.builder';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, logger: false }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  await app.register(helmet, { contentSecurityPolicy: false });

  const doc = buildOpenApiDocument();
  SwaggerModule.setup('docs', app, doc, { jsonDocumentUrl: 'openapi.json' });

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins.length > 0 ? allowedOrigins : false, credentials: true });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed', err);
  process.exit(1);
});
