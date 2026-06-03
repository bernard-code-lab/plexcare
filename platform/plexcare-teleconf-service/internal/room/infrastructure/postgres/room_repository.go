// Package postgres implementa o adapter de room.ports.RoomRepository usando pgx.
// Toda query carrega tenant_id como filtro defensivo, mesmo em SELECT por PK.
package postgres

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
	"plexcare/platform/plexcare-teleconf-service/internal/room/ports"
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

// ListByTenant pagina por (created_at DESC, id DESC). Cursor é opaco —
// base64-url de JSON {c:created_at,i:id} do último item da página anterior.
// SEMPRE filtra por tenant_id (defesa em profundidade contra leak entre tenants).
func (r *RoomRepository) ListByTenant(
	ctx context.Context,
	tenantID string,
	opts ports.ListRoomsOptions,
) ([]*domain.Room, string, error) {
	const baseQuery = `
		SELECT id, tenant_id, appointment_id, livekit_name, status, max_duration_ms, features, created_at, started_at, finished_at
		FROM rooms
		WHERE tenant_id = $1`

	args := []any{tenantID}
	query := baseQuery

	if opts.Cursor != "" {
		c, err := decodeListCursor(opts.Cursor)
		if err != nil {
			return nil, "", fmt.Errorf("decode cursor: %w", err)
		}
		query += ` AND (created_at, id) < ($2, $3)`
		args = append(args, c.CreatedAt, c.ID)
	}

	// limit+1 para saber se existe próxima página sem segundo query.
	query += fmt.Sprintf(` ORDER BY created_at DESC, id DESC LIMIT %d`, opts.Limit+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", fmt.Errorf("query rooms: %w", err)
	}
	defer rows.Close()

	rooms := make([]*domain.Room, 0, opts.Limit)
	for rows.Next() {
		var (
			room          domain.Room
			status        string
			maxDurationMs int64
			featuresRaw   []byte
		)
		if err := rows.Scan(
			&room.ID, &room.TenantID, &room.AppointmentID, &room.LiveKitName,
			&status, &maxDurationMs, &featuresRaw,
			&room.CreatedAt, &room.StartedAt, &room.FinishedAt,
		); err != nil {
			return nil, "", fmt.Errorf("scan row: %w", err)
		}
		room.Status = domain.RoomStatus(status)
		room.MaxDuration = time.Duration(maxDurationMs) * time.Millisecond
		if err := json.Unmarshal(featuresRaw, &room.Features); err != nil {
			return nil, "", fmt.Errorf("unmarshal features: %w", err)
		}
		rooms = append(rooms, &room)
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("rows iter: %w", err)
	}

	var nextCursor string
	if len(rooms) > opts.Limit {
		last := rooms[opts.Limit-1]
		nextCursor = encodeListCursor(listCursor{CreatedAt: last.CreatedAt, ID: last.ID})
		rooms = rooms[:opts.Limit]
	}
	return rooms, nextCursor, nil
}

type listCursor struct {
	CreatedAt time.Time `json:"c"`
	ID        string    `json:"i"`
}

func encodeListCursor(c listCursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeListCursor(s string) (listCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return listCursor{}, err
	}
	var c listCursor
	if err := json.Unmarshal(raw, &c); err != nil {
		return listCursor{}, err
	}
	return c, nil
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
