import { createHash } from 'node:crypto';

/**
 * One-way tokenization for PII fields that travel through the outbox / Kafka.
 *
 * LGPD: emails and CPF/CNPJ are personal identifiers and must NOT leave the
 * idp-api in plain form. Consumers that legitimately need the email perform
 * an authenticated lookup against /v1/me.
 *
 * The pepper (`PII_HASH_PEPPER` env) makes pre-image attacks (rainbow tables
 * of the entire BR CPF space, ~10^11) infeasible.
 */
function pepper(): string {
  return process.env.PII_HASH_PEPPER ?? '';
}

function hash(input: string): string {
  return createHash('sha256').update(pepper()).update(':').update(input).digest('hex');
}

/** Stable, comparable token for an email — first 16 hex chars of peppered sha256. */
export function hashEmail(email: string): string {
  return hash(email.trim().toLowerCase()).slice(0, 16);
}

/** Stable, comparable token for a CPF/CNPJ (digits only). */
export function hashDocument(digitsOnly: string): string {
  return hash(digitsOnly).slice(0, 16);
}

/** Mask an email for display in idempotency replays: `f***@example.com`. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const first = email[0] ?? '*';
  return `${first}***${email.slice(at)}`;
}
