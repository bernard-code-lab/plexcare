import { z } from 'zod';
import type { CloudEventInput } from '../cloudevents';

/**
 * Issue #3 PR-2 / ADR-0011 §D-2.
 *
 * Evento `tenant.subscription.changed` — publicado pelo plexcare-idp-api
 * sempre que uma `tenant_subscription` é criada, alterada ou cancelada.
 *
 * Consumido por:
 *  - plexcare-teleconf-service: projeta `tenant_subscription_view` (read-model)
 *    + invalidação ativa do cache LRU de `tenant.Context` (PR-3 / PR-4).
 *  - billing reconciler / dashboards futuros.
 *
 * Cada evento é um **snapshot** do estado da subscription após a mudança
 * (não um diff). Idempotência consumer-side: chave por (tenant_id, current_period_end).
 */

export const PRODUCT_SKUS = ['rooms', 'schedule', 'suite'] as const;
export const PLAN_TIERS = ['trial', 'solo', 'clinica', 'enterprise'] as const;
export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'churned',
] as const;

export const TenantSubscriptionChangedSchema = z.object({
  /** UUID externo do tenant (account.tenant_uuid). */
  tenant_id: z.string().uuid(),
  /** ID interno do account (BigInt como string), para auditoria. */
  account_id: z.string(),
  /** Código canônico do plano (ex.: "rooms_clinica_annual"). */
  plan_code: z.string().min(1),
  /** SKU do produto vendido (ADR-0008). */
  product_sku: z.enum(PRODUCT_SKUS),
  /** Tier dentro do produto. */
  plan_tier: z.enum(PLAN_TIERS),
  /** Status lifecycle da subscription. */
  status: z.enum(SUBSCRIPTION_STATUSES),
  /** Limite de salas simultâneas concedido pelo plano. */
  max_concurrent_rooms: z.number().int().nonnegative(),
  /** Features habilitadas no plano (ex.: { recording: true, transcription: false }). */
  features: z.record(z.string(), z.boolean()),
  /** Fim do período de trial — null quando não está em trial. */
  trial_ends_at: z.string().datetime().nullable(),
  /** Fim do ciclo de cobrança atual. */
  current_period_end: z.string().datetime(),
});

export type TenantSubscriptionChangedData = z.infer<typeof TenantSubscriptionChangedSchema>;

export interface BuildOpts {
  id?: string;
  time?: Date;
}

/**
 * Helper que valida o payload (fail-fast com Zod) e devolve um `CloudEventInput`
 * pronto para `OutboxService.publish(tx, input)`.
 */
export function buildTenantSubscriptionChangedEvent(
  data: TenantSubscriptionChangedData,
  opts: BuildOpts = {},
): CloudEventInput<TenantSubscriptionChangedData> {
  const parsed = TenantSubscriptionChangedSchema.parse(data);
  return {
    type: 'tenant.subscription.changed',
    subject: `tenant/${parsed.tenant_id}`,
    data: parsed,
    tenantId: parsed.tenant_id,
    ...(opts.id ? { id: opts.id } : {}),
    ...(opts.time ? { time: opts.time } : {}),
  };
}
