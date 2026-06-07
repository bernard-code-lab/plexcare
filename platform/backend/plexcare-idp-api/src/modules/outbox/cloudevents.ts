import { v4 as uuidv4 } from 'uuid';

/**
 * Registry de tipos de eventos publicados pelo plexcare-idp-api no outbox.
 *
 * Naming: mantemos `IdpEventType` por compat histórica, mas o union já comporta
 * eventos de outros agregados (ex.: `tenant.subscription.changed` introduzido
 * na Issue #3 PR-2 / ADR-0011 §D-2). Refactor de nome para `OutboxEventType`
 * fica para PR dedicado.
 */
export type IdpEventType =
  | 'idp.user.signed_up'
  | 'idp.user.email_verified'
  | 'idp.user.password_changed'
  | 'idp.session.created'
  | 'idp.session.revoked'
  | 'idp.session.login_failed'
  | 'idp.role.assigned'
  | 'idp.role.revoked'
  | 'tenant.subscription.changed';

export const TOPIC_BY_TYPE: Record<IdpEventType, string> = {
  'idp.user.signed_up': 'idp.user.v1',
  'idp.user.email_verified': 'idp.user.v1',
  'idp.user.password_changed': 'idp.user.v1',
  'idp.session.created': 'idp.session.v1',
  'idp.session.revoked': 'idp.session.v1',
  'idp.session.login_failed': 'idp.session.v1',
  'idp.role.assigned': 'idp.role.v1',
  'idp.role.revoked': 'idp.role.v1',
  'tenant.subscription.changed': 'tenant.subscription.v1',
};

export interface CloudEventInput<T> {
  type: IdpEventType;
  subject: string;
  data: T;
  tenantId?: string | null;
  id?: string;
  time?: Date;
}

export interface CloudEventEnvelope<T> {
  specversion: '1.0';
  id: string;
  source: 'plexcare-idp-api';
  type: IdpEventType;
  subject: string;
  time: string;
  datacontenttype: 'application/json';
  data: T;
  tenantid: string | null;
}

export function buildCloudEvent<T>(input: CloudEventInput<T>): CloudEventEnvelope<T> {
  return {
    specversion: '1.0',
    id: input.id ?? uuidv4(),
    source: 'plexcare-idp-api',
    type: input.type,
    subject: input.subject,
    time: (input.time ?? new Date()).toISOString(),
    datacontenttype: 'application/json',
    data: input.data,
    tenantid: input.tenantId ?? null,
  };
}
