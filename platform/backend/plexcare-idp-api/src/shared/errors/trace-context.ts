import { trace, context } from '@opentelemetry/api';

/** Returns the active OTel trace_id (32-hex) or undefined when no span is active. */
export function traceIdFromContext(): string | undefined {
  const span = trace.getSpan(context.active());
  const traceId = span?.spanContext().traceId;
  return traceId && traceId !== '00000000000000000000000000000000' ? traceId : undefined;
}
