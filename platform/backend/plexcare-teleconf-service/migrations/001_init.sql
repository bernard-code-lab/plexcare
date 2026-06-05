-- Migrations iniciais para room-service e usage-metering
-- Rodam automaticamente no primeiro start do postgres no docker-compose

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- para gen_random_uuid()

-- =============================================================================
-- Room Service
-- =============================================================================

CREATE TABLE IF NOT EXISTS rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    appointment_id  TEXT NOT NULL,
    livekit_name    TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'finished', 'expired')),
    max_duration_ms BIGINT NOT NULL,          -- milliseconds
    features        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
);

CREATE INDEX idx_rooms_tenant_status    ON rooms (tenant_id, status);
CREATE INDEX idx_rooms_livekit_name     ON rooms (livekit_name);
CREATE INDEX idx_rooms_appointment      ON rooms (appointment_id);

-- Contagem de salas ativas por tenant — usada pelo limite de plano
CREATE INDEX idx_rooms_tenant_active    ON rooms (tenant_id) WHERE status IN ('pending', 'active');

-- =============================================================================
-- Usage Metering
-- =============================================================================

-- Uma linha por janela de presença de um participante
CREATE TABLE IF NOT EXISTS participant_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id          UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    tenant_id        UUID NOT NULL,
    participant_id   TEXT NOT NULL,
    participant_role  TEXT NOT NULL,
    joined_at        TIMESTAMPTZ NOT NULL,
    left_at          TIMESTAMPTZ,                -- NULL = sessão ainda aberta
    billable_minutes INT                          -- preenchido ao fechar
);

CREATE INDEX idx_sessions_room           ON participant_sessions (room_id);
CREATE INDEX idx_sessions_tenant_period  ON participant_sessions (tenant_id, (date_trunc('month', joined_at AT TIME ZONE 'UTC')));
CREATE INDEX idx_sessions_active         ON participant_sessions (room_id, participant_id) WHERE left_at IS NULL;

-- Agregado mensal — lido pelo Billing Service para gerar faturas
CREATE TABLE IF NOT EXISTS monthly_usage (
    tenant_id     UUID NOT NULL,
    period        TEXT NOT NULL,  -- "2026-06"
    total_minutes INT NOT NULL DEFAULT 0,
    total_rooms   INT NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, period)
);

-- =============================================================================
-- Audit Log (append-only)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    actor_id    TEXT,
    action      TEXT NOT NULL,
    subject_id  TEXT,
    metadata    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nenhum UPDATE ou DELETE é permitido nesta tabela — apenas INSERT
-- via policy RLS (aplicada no nível da aplicação com service account restrito)
CREATE INDEX idx_audit_tenant_time ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_action      ON audit_logs (action);
