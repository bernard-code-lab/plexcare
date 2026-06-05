/* eslint-disable no-console */
/**
 * OpenTelemetry bootstrap. MUST be imported BEFORE any other module so that
 * auto-instrumentation can patch http/fastify/pino/prisma/etc. before they
 * are required by AppModule.
 *
 *   import './shared/otel/instrument';   // <-- first line of main.ts
 *
 * Exporter wiring is delegated to the standard OTEL_* env vars
 * (OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf, …).
 * The SDK auto-detects them — see https://opentelemetry.io/docs/zero-code/js/.
 *
 * When OTEL_DISABLED=true or NODE_ENV=test, telemetry is a no-op; the
 * `trace_id` injected by AppExceptionFilter and pino is simply empty.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const disabled = process.env.OTEL_DISABLED === 'true' || process.env.NODE_ENV === 'test';

let sdk: NodeSDK | null = null;

if (!disabled) {
  try {
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'plexcare-idp-api',
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // fs auto-instrumentation is noisy; everything else (http, fastify,
          // pino, mysql2, kafkajs, undici) stays enabled.
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });
    sdk.start();

    process.on('SIGTERM', () => {
      sdk?.shutdown().finally(() => process.exit(0));
    });
  } catch (err) {
    // Never crash the app on telemetry init failure.
    console.error('OpenTelemetry init failed (continuing without traces):', (err as Error).message);
  }
}
