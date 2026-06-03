//go:build integration

package postgres_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"plexcare/platform/plexcare-teleconf/internal/room/domain"
	"plexcare/platform/plexcare-teleconf/internal/room/infrastructure/postgres"
)

// Pre-req: docker compose -f docker-compose.dev.yml up -d postgres
// Run:     go test -tags=integration ./internal/room/infrastructure/postgres/...

func newPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = "postgres://plexcare:plexcare@localhost:5432/plexcare_dev?sslmode=disable"
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestRoomRepository_SaveAndFind(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewRoomRepository(pool)
	ctx := context.Background()

	room := newTestRoom()
	if err := repo.Save(ctx, room); err != nil {
		t.Fatalf("Save: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", room.ID)
	})

	got, err := repo.FindByID(ctx, room.ID)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if got.TenantID != room.TenantID || got.LiveKitName != room.LiveKitName {
		t.Errorf("got = %+v", got)
	}
	if got.Status != domain.RoomStatusPending {
		t.Errorf("Status = %v, want pending", got.Status)
	}
}

func TestRoomRepository_FindByID_NotFound(t *testing.T) {
	repo := postgres.NewRoomRepository(newPool(t))
	_, err := repo.FindByID(context.Background(), uuid.New().String())
	if err != domain.ErrRoomNotFound {
		t.Errorf("err = %v, want ErrRoomNotFound", err)
	}
}

func TestRoomRepository_CountActiveByTenant(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewRoomRepository(pool)
	ctx := context.Background()

	tenantID := uuid.New().String()

	for i := 0; i < 2; i++ {
		r := newTestRoom()
		r.TenantID = tenantID
		if err := repo.Save(ctx, r); err != nil {
			t.Fatalf("Save: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM rooms WHERE tenant_id = $1", tenantID)
	})

	n, err := repo.CountActiveByTenant(ctx, tenantID)
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if n != 2 {
		t.Errorf("count = %d, want 2", n)
	}
}

func TestRoomRepository_Update(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewRoomRepository(pool)
	ctx := context.Background()

	room := newTestRoom()
	if err := repo.Save(ctx, room); err != nil {
		t.Fatalf("Save: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", room.ID)
	})

	finishedAt := time.Now().UTC().Truncate(time.Microsecond)
	if err := room.Finish(finishedAt); err != nil {
		t.Fatalf("Finish: %v", err)
	}
	if err := repo.Update(ctx, room); err != nil {
		t.Fatalf("Update: %v", err)
	}

	got, _ := repo.FindByID(ctx, room.ID)
	if got.Status != domain.RoomStatusFinished {
		t.Errorf("Status = %v, want finished", got.Status)
	}
	if got.FinishedAt == nil {
		t.Error("FinishedAt nil after Finish+Update")
	}
}

func newTestRoom() *domain.Room {
	now := time.Now().UTC().Truncate(time.Microsecond)
	return &domain.Room{
		ID:            uuid.New().String(),
		TenantID:      uuid.New().String(),
		AppointmentID: "appt-" + uuid.NewString()[:8],
		LiveKitName:   "room_" + uuid.NewString(),
		Status:        domain.RoomStatusPending,
		MaxDuration:   60 * time.Minute,
		Features:      domain.RoomFeatures{Recording: true, MaxParticipants: 4},
		CreatedAt:     now,
	}
}
