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

// SumMinutesByTenantAndPeriod e CountRoomsByTenantAndPeriod: não implementados ainda.
// O AggregateUseCase fará SQL próprio ou usaremos a tabela monthly_usage no upsert pelo aggregator.
func (r *SessionRepository) SumMinutesByTenantAndPeriod(ctx context.Context, _, _ string) (int, error) {
	return 0, fmt.Errorf("SumMinutesByTenantAndPeriod: not implemented")
}
func (r *SessionRepository) CountRoomsByTenantAndPeriod(ctx context.Context, _, _ string) (int, error) {
	return 0, fmt.Errorf("CountRoomsByTenantAndPeriod: not implemented")
}
