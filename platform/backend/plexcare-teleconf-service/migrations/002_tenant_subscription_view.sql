-- Migration 002 — Read-model projetado do plexcare-idp-api outbox
-- (evento tenant.subscription.changed).
--
-- Contexto: ADR-0011 §D-2 + Issue #3 PR-3.
-- Consumer Kafka idempotente upserta esta tabela quando o idp-api publica
-- uma mudança de subscription. Lida pelo middleware HTTP do room-service
-- via TenantViewRepository.FindByTenantID() → tenant.Context enriquecido.

CREATE TABLE IF NOT EXISTS tenant_subscription_view (
    tenant_id            UUID PRIMARY KEY,
    account_id           BIGINT NOT NULL,
    plan_code            TEXT NOT NULL,
    product_sku          TEXT NOT NULL
                              CHECK (product_sku IN ('rooms', 'schedule', 'suite')),
    plan_tier            TEXT NOT NULL
                              CHECK (plan_tier IN ('trial', 'solo', 'clinica', 'enterprise')),
    status               TEXT NOT NULL
                              CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'churned')),
    max_concurrent_rooms INT  NOT NULL CHECK (max_concurrent_rooms >= 0),
    features             JSONB NOT NULL DEFAULT '{}'::jsonb,
    trial_ends_at        TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ NOT NULL,
    -- occurred_at do evento CloudEvents que gerou esta projeção;
    -- usado para descartar eventos out-of-order (ver upsert WHERE clause).
    updated_at           TIMESTAMPTZ NOT NULL
);

-- Lookup secundário por status (consumido pelo billing reconciler e dashboards).
CREATE INDEX IF NOT EXISTS idx_tenant_subscription_view_status
    ON tenant_subscription_view (status);

-- Lookup por account_id (auditoria cross-reference com o idp-api).
CREATE INDEX IF NOT EXISTS idx_tenant_subscription_view_account
    ON tenant_subscription_view (account_id);
