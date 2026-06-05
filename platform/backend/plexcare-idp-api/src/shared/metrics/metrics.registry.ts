import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: 'idp_' });

export const loginTotal = new Counter({
  name: 'idp_login_total',
  help: 'Total /v1/auth/login attempts, by result.',
  labelNames: ['result'] as const,
  registers: [metricsRegistry],
});

export const tokenIssuedTotal = new Counter({
  name: 'idp_token_issued_total',
  help: 'Total tokens issued at /v1/token (and /token/refresh).',
  labelNames: ['client_id', 'grant_type'] as const,
  registers: [metricsRegistry],
});

export const refreshRotationTotal = new Counter({
  name: 'idp_refresh_rotation_total',
  help: 'Successful refresh rotations.',
  labelNames: ['client_id'] as const,
  registers: [metricsRegistry],
});

export const refreshReuseDetectedTotal = new Counter({
  name: 'idp_refresh_reuse_detected_total',
  help: 'Refresh token reuse detections (OAuth 2.1 §6.1).',
  registers: [metricsRegistry],
});

export const sessionRevokedTotal = new Counter({
  name: 'idp_session_revoked_total',
  help: 'Sessions revoked, by reason.',
  labelNames: ['reason'] as const,
  registers: [metricsRegistry],
});

export const outboxLagSeconds = new Gauge({
  name: 'idp_outbox_lag_seconds',
  help: 'Age (s) of the oldest unpublished outbox row.',
  registers: [metricsRegistry],
});

export const outboxPending = new Gauge({
  name: 'idp_outbox_pending',
  help: 'Number of unpublished outbox rows.',
  registers: [metricsRegistry],
});

export const kcRequestDurationSeconds = new Histogram({
  name: 'idp_kc_request_duration_seconds',
  help: 'Duration of outgoing Keycloak HTTP calls.',
  labelNames: ['endpoint'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const signingKeyAgeDays = new Gauge({
  name: 'idp_signing_key_age_days',
  help: 'Age in days of the active/previous signing keys.',
  labelNames: ['status'] as const,
  registers: [metricsRegistry],
});

export const lockoutBlocksTotal = new Counter({
  name: 'idp_lockout_blocks_total',
  help: 'Total lockout block events, by key kind.',
  labelNames: ['key_kind'] as const,
  registers: [metricsRegistry],
});
