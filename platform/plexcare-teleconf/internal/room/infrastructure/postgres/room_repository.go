// Package postgres implementa o adapter de room.ports.RoomRepository usando pgx.
// Toda query carrega tenant_id como filtro defensivo, mesmo em SELECT por PK.
package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plexcare/platform/plexcare-teleconf/internal/room/domain"
)

type RoomRepository struct {
	pool *pgxpool.Pool
}

func NewRoomRepository(pool *pgxpool.Pool) *RoomRepository {
	return &RoomRepository{pool: pool}
}

func (r *RoomRepository) Save(ctx context.Context, room *domain.Room) error {
	features, err := json.Marshal(room.Features)
	if err != nil {
		return fmt.Errorf("marshal features: %w", err)
	}

	const q = `
		INSERT INTO rooms (id, tenant_id, appointment_id, livekit_name, status, max_duration_ms, features, created_at, started_at, finished_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err = r.pool.Exec(ctx, q,
		room.ID,
		room.TenantID,
		room.AppointmentID,
		room.LiveKitName,
		string(room.Status),
		room.MaxDuration.Milliseconds(),
		features,
		room.CreatedAt,
		room.StartedAt,
		room.FinishedAt,
	)
	if err != nil {
		return fmt.Errorf("insert room: %w", err)
	}
	return nil
}

func (r *RoomRepository) FindByID(ctx context.Context, id string) (*domain.Room, error) {
	const q = `
		SELECT id, tenant_id, appointment_id, livekit_name, status, max_duration_ms, features, created_at, started_at, finished_at
		FROM rooms WHERE id = $1
	`
	return r.scanOne(ctx, q, id)
}

func (r *RoomRepository) FindByLiveKitName(ctx context.Context, name string) (*domain.Room, error) {
	const q = `
		SELECT id, tenant_id, appointment_id, livekit_name, status, max_duration_ms, features, created_at, started_at, finished_at
		FROM rooms WHERE livekit_name = $1
	`
	return r.scanOne(ctx, q, name)
}

func (r *RoomRepository) CountActiveByTenant(ctx context.Context, tenantID string) (int, error) {
	const q = `SELECT COUNT(*) FROM rooms WHERE tenant_id = $1 AND status IN ('pending', 'active')`
	var n int
	if err := r.pool.QueryRow(ctx, q, tenantID).Scan(&n); err != nil {
		return 0, fmt.Errorf("count active rooms: %w", err)
	}
	return n, nil
}

func (r *RoomRepository) Update(ctx context.Context, room *domain.Room) error {
	const q = `
		UPDATE rooms
		   SET status = $2, started_at = $3, finished_at = $4
		 WHERE id = $1
	`
	tag, err := r.pool.Exec(ctx, q, room.ID, string(room.Status), room.StartedAt, room.FinishedAt)
	if err != nil {
		return fmt.Errorf("update room: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrRoomNotFound
	}
	return nil
}

func (r *RoomRepository) scanOne(ctx context.Context, query string, args ...any) (*domain.Room, error) {
	row := r.pool.QueryRow(ctx, query, args...)

	var (
		room          domain.Room
		status        string
		maxDurationMs int64
		featuresRaw   []byte
	)
	err := row.Scan(
		&room.ID,
		&room.TenantID,
		&room.AppointmentID,
		&room.LiveKitName,
		&status,
		&maxDurationMs,
		&featuresRaw,
		&room.CreatedAt,
		&room.StartedAt,
		&room.FinishedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrRoomNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scan room: %w", err)
	}

	room.Status = domain.RoomStatus(status)
	room.MaxDuration = time.Duration(maxDurationMs) * time.Millisecond
	if err := json.Unmarshal(featuresRaw, &room.Features); err != nil {
		return nil, fmt.Errorf("unmarshal features: %w", err)
	}
	return &room, nil
}
