// Package postgres implementa metering/ports.SessionRepository.
// Apenas Save/FindActive/CloseSession são implementados; agregações ficam para iteração futura.
package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plexcare/platform/plexcare-teleconf-service/internal/metering/domain"
)

type SessionRepository struct {
	pool *pgxpool.Pool
}

func NewSessionRepository(pool *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{pool: pool}
}

func (r *SessionRepository) Save(ctx context.Context, s *domain.ParticipantSession) error {
	const q = `
		INSERT INTO participant_sessions (id, room_id, tenant_id, participant_id, participant_role, joined_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO NOTHING
	`
	_, err := r.pool.Exec(ctx, q, s.ID, s.RoomID, s.TenantID, s.ParticipantID, s.ParticipantRole, s.JoinedAt)
	if err != nil {
		return fmt.Errorf("insert session: %w", err)
	}
	return nil
}

func (r *SessionRepository) FindActive(ctx context.Context, roomID, participantID string) (*domain.ParticipantSession, error) {
	const q = `
		SELECT id, room_id, tenant_id, participant_id, participant_role, joined_at, left_at
		FROM participant_sessions
		WHERE room_id = $1 AND participant_id = $2 AND left_at IS NULL
		ORDER BY joined_at DESC LIMIT 1
	`
	row := r.pool.QueryRow(ctx, q, roomID, participantID)
	s := &domain.ParticipantSession{}
	if err := row.Scan(&s.ID, &s.RoomID, &s.TenantID, &s.ParticipantID, &s.ParticipantRole, &s.JoinedAt, &s.LeftAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrSessionNotFound
		}
		return nil, fmt.Errorf("scan session: %w", err)
	}
	return s, nil
}

// CloseSession marca left_at e devolve a sessão atualizada com BillableMinutes calculado.
func (r *SessionRepository) CloseSession(ctx context.Context, roomID, participantID string, leftAt time.Time) (*domain.ParticipantSession, error) {
	session, err := r.FindActive(ctx, roomID, participantID)
	if err != nil {
		return nil, err
	}
	if err := session.Close(leftAt); err != nil {
		return nil, fmt.Errorf("close session in domain: %w", err)
	}
	minutes := session.BillableMinutes()

	const q = `
		UPDATE participant_sessions
		   SET left_at = $2, billable_minutes = $3
		 WHERE id = $1
	`
	if _, err := r.pool.Exec(ctx, q, session.ID, leftAt, minutes); err != nil {
		return nil, fmt.Errorf("update session: %w", err)
	}
	return session, nil
}

// SumMinutesByTenantAndPeriod soma billable_minutes das sessões fechadas (left_at preenchido)
// de um tenant cujo joined_at cai no mês UTC indicado por `period` ("YYYY-MM").
// Bate no índice idx_sessions_tenant_period — a expressão à esquerda é idêntica.
func (r *SessionRepository) SumMinutesByTenantAndPeriod(ctx context.Context, tenantID, period string) (int, error) {
	monthStart, err := parsePeriod(period)
	if err != nil {
		return 0, err
	}
	const q = `
		SELECT COALESCE(SUM(billable_minutes), 0)
		  FROM participant_sessions
		 WHERE tenant_id = $1
		   AND date_trunc('month', joined_at AT TIME ZONE 'UTC') = $2::timestamp
		   AND billable_minutes IS NOT NULL
	`
	var total int
	if err := r.pool.QueryRow(ctx, q, tenantID, monthStart).Scan(&total); err != nil {
		return 0, fmt.Errorf("sum billable minutes: %w", err)
	}
	return total, nil
}

// CountRoomsByTenantAndPeriod conta rooms distintos com pelo menos uma sessão no mês.
// Sessões abertas (left_at IS NULL) contam — sala viva já é volume para billing.
func (r *SessionRepository) CountRoomsByTenantAndPeriod(ctx context.Context, tenantID, period string) (int, error) {
	monthStart, err := parsePeriod(period)
	if err != nil {
		return 0, err
	}
	const q = `
		SELECT COUNT(DISTINCT room_id)
		  FROM participant_sessions
		 WHERE tenant_id = $1
		   AND date_trunc('month', joined_at AT TIME ZONE 'UTC') = $2::timestamp
	`
	var total int
	if err := r.pool.QueryRow(ctx, q, tenantID, monthStart).Scan(&total); err != nil {
		return 0, fmt.Errorf("count distinct rooms: %w", err)
	}
	return total, nil
}

// parsePeriod converte "YYYY-MM" para timestamp UTC no início do mês.
// Compatível com a expressão indexada idx_sessions_tenant_period.
func parsePeriod(period string) (time.Time, error) {
	t, err := time.Parse("2006-01", period)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse period %q (esperado YYYY-MM): %w", period, err)
	}
	return t, nil
}
