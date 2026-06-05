import { buildCloudEvent, TOPIC_BY_TYPE } from '../../../src/modules/outbox/cloudevents';

describe('buildCloudEvent', () => {
  it('produces a CloudEvents 1.0 envelope with required fields', () => {
    const evt = buildCloudEvent({
      type: 'idp.session.created',
      subject: 'idp_user/42',
      data: { foo: 'bar' },
      tenantId: '7',
    });
    expect(evt).toMatchObject({
      specversion: '1.0',
      source: 'plexcare-idp-api',
      type: 'idp.session.created',
      subject: 'idp_user/42',
      datacontenttype: 'application/json',
      tenantid: '7',
      data: { foo: 'bar' },
    });
    expect(evt.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(evt.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('omits tenantid → null when not provided', () => {
    const evt = buildCloudEvent({
      type: 'idp.user.signed_up',
      subject: 'idp_user/1',
      data: {},
    });
    expect(evt.tenantid).toBeNull();
  });

  it('uses provided id and time when given (idempotency-friendly)', () => {
    const fixedTime = new Date('2026-01-01T00:00:00Z');
    const evt = buildCloudEvent({
      id: '00000000-0000-0000-0000-000000000001',
      type: 'idp.role.assigned',
      subject: 'idp_user/1',
      data: {},
      time: fixedTime,
    });
    expect(evt.id).toBe('00000000-0000-0000-0000-000000000001');
    expect(evt.time).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('TOPIC_BY_TYPE', () => {
  it.each([
    ['idp.user.signed_up', 'idp.user.v1'],
    ['idp.user.email_verified', 'idp.user.v1'],
    ['idp.session.created', 'idp.session.v1'],
    ['idp.session.revoked', 'idp.session.v1'],
    ['idp.role.assigned', 'idp.role.v1'],
    ['idp.role.revoked', 'idp.role.v1'],
  ] as const)('routes %s → %s', (type, topic) => {
    expect(TOPIC_BY_TYPE[type]).toBe(topic);
  });
});
