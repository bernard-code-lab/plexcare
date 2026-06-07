/**
 * Issue #3 — Feature: outbox publica tenant.subscription.changed
 *
 *   Scenario: Outbox publica tenant.subscription.changed quando subscription muda
 *     Given uma tenant_subscription ativa do tenant "8b6c1e33-..."
 *     When o status da subscription muda para "cancelled"
 *     Then o outbox tem novo registro CloudEvents tipo "tenant.subscription.changed"
 *     And o payload contém { tenant_id, account_id, plan_code, product_sku, plan_tier,
 *         status, max_concurrent_rooms, features, trial_ends_at, current_period_end }
 *     And o worker poll publica esse evento em Kafka topic "tenant.subscription.v1"
 *
 * Este PR (PR-2 da Issue #3) entrega APENAS o schema e o builder do evento.
 * O ponto de chamada (subscription lifecycle) vem em Issue #36 (BillingGateway).
 */
import {
  TenantSubscriptionChangedSchema,
  buildTenantSubscriptionChangedEvent,
  type TenantSubscriptionChangedData,
} from '../../../../src/modules/outbox/events/tenant-subscription-changed.event';
import { TOPIC_BY_TYPE, buildCloudEvent } from '../../../../src/modules/outbox/cloudevents';

const TENANT_UUID = '8b6c1e33-1c57-4f85-a8fa-1025451490a4';

function validData(overrides: Partial<TenantSubscriptionChangedData> = {}): TenantSubscriptionChangedData {
  return {
    tenant_id: TENANT_UUID,
    account_id: '1',
    plan_code: 'rooms_clinica_annual',
    product_sku: 'rooms',
    plan_tier: 'clinica',
    status: 'active',
    max_concurrent_rooms: 30,
    features: { recording: true, transcription: false },
    trial_ends_at: null,
    current_period_end: '2026-07-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('tenant.subscription.changed — registry (Issue #3 PR-2)', () => {
  it('tipo está registrado no TOPIC_BY_TYPE com topic tenant.subscription.v1', () => {
    // Cast porque o tipo deve estar no union após este PR
    const topic = (TOPIC_BY_TYPE as Record<string, string>)['tenant.subscription.changed'];
    expect(topic).toBe('tenant.subscription.v1');
  });

  it('aceita evento buildCloudEvent com o type novo', () => {
    const env = buildCloudEvent({
      type: 'tenant.subscription.changed',
      subject: `tenant/${TENANT_UUID}`,
      data: validData(),
      tenantId: TENANT_UUID,
    });
    expect(env.type).toBe('tenant.subscription.changed');
    expect(env.tenantid).toBe(TENANT_UUID);
  });
});

describe('TenantSubscriptionChangedSchema — Zod validation', () => {
  it('aceita payload completo válido', () => {
    expect(() => TenantSubscriptionChangedSchema.parse(validData())).not.toThrow();
  });

  it.each([
    {
      name: 'tenant_id não-UUID',
      data: validData({ tenant_id: 'not-a-uuid' }),
    },
    {
      name: 'product_sku fora do enum',
      data: validData({ product_sku: 'mystery' as unknown as TenantSubscriptionChangedData['product_sku'] }),
    },
    {
      name: 'plan_tier fora do enum',
      data: validData({ plan_tier: 'gold' as unknown as TenantSubscriptionChangedData['plan_tier'] }),
    },
    {
      name: 'status fora do enum',
      data: validData({ status: 'expired' as unknown as TenantSubscriptionChangedData['status'] }),
    },
    {
      name: 'max_concurrent_rooms negativo',
      data: validData({ max_concurrent_rooms: -1 }),
    },
    {
      name: 'current_period_end formato inválido',
      data: validData({ current_period_end: 'tomorrow' }),
    },
  ])('rejeita payload inválido: $name', ({ data }) => {
    expect(() => TenantSubscriptionChangedSchema.parse(data)).toThrow();
  });

  it('aceita trial_ends_at nulo (subscription não-trialing)', () => {
    expect(() =>
      TenantSubscriptionChangedSchema.parse(validData({ trial_ends_at: null, status: 'active' })),
    ).not.toThrow();
  });

  it('aceita trial_ends_at como ISO string (subscription em trial)', () => {
    expect(() =>
      TenantSubscriptionChangedSchema.parse(
        validData({ trial_ends_at: '2026-06-21T00:00:00.000Z', status: 'trialing' }),
      ),
    ).not.toThrow();
  });

  it.each(['trialing', 'active', 'past_due', 'cancelled', 'churned'])(
    'aceita status "%s" (enum completo)',
    (status) => {
      expect(() =>
        TenantSubscriptionChangedSchema.parse(
          validData({ status: status as TenantSubscriptionChangedData['status'] }),
        ),
      ).not.toThrow();
    },
  );

  it.each(['rooms', 'schedule', 'suite'])(
    'aceita product_sku "%s" (enum completo)',
    (sku) => {
      expect(() =>
        TenantSubscriptionChangedSchema.parse(
          validData({ product_sku: sku as TenantSubscriptionChangedData['product_sku'] }),
        ),
      ).not.toThrow();
    },
  );
});

describe('buildTenantSubscriptionChangedEvent — CloudEventInput builder', () => {
  it('produz CloudEventInput com type, subject e tenantId corretos', () => {
    const input = buildTenantSubscriptionChangedEvent(validData());

    expect(input.type).toBe('tenant.subscription.changed');
    expect(input.subject).toBe(`tenant/${TENANT_UUID}`);
    expect(input.tenantId).toBe(TENANT_UUID);
    expect(input.data.plan_code).toBe('rooms_clinica_annual');
  });

  it('rejeita payload inválido antes do envelope (fail-fast)', () => {
    expect(() =>
      buildTenantSubscriptionChangedEvent(
        validData({ tenant_id: 'bad' }),
      ),
    ).toThrow();
  });

  it('preserva id e time opcionais (idempotência-friendly)', () => {
    const fixedTime = new Date('2026-06-07T10:00:00Z');
    const fixedId = '11111111-1111-1111-1111-111111111111';

    const input = buildTenantSubscriptionChangedEvent(validData(), {
      id: fixedId,
      time: fixedTime,
    });

    expect(input.id).toBe(fixedId);
    expect(input.time).toBe(fixedTime);
  });

  it('o input passado a buildCloudEvent produz envelope CloudEvents 1.0 completo', () => {
    const input = buildTenantSubscriptionChangedEvent(validData());
    const env = buildCloudEvent(input);

    expect(env).toMatchObject({
      specversion: '1.0',
      source: 'plexcare-idp-api',
      type: 'tenant.subscription.changed',
      subject: `tenant/${TENANT_UUID}`,
      datacontenttype: 'application/json',
      tenantid: TENANT_UUID,
    });
    expect(env.data.tenant_id).toBe(TENANT_UUID);
  });
});
