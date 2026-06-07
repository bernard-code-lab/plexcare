//go:build integration

package postgres_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"plexcare/platform/plexcare-teleconf-service/internal/metering/domain"
	"plexcare/platform/plexcare-teleconf-service/internal/metering/infrastructure/postgres"
)

// Pre-req: docker compose -f docker-compose.dev.yml up -d postgres
// Run:     go test -tags=integration ./internal/metering/infrastructure/postgres/...

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

// seedRoom insere uma row em `rooms` para satisfazer a FK participant_sessions.room_id.
func seedRoom(t *testing.T, pool *pgxpool.Pool, tenantID string) string {
	t.Helper()
	id := uuid.New().String()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO rooms (id, tenant_id, appointment_id, livekit_name, status, max_duration_ms)
		VALUES ($1, $2, $3, $4, 'pending', 3600000)
	`, id, tenantID, "appt-"+id[:8], "room_"+id)
	if err != nil {
		t.Fatalf("seed room: %v", err)
	}
	return id
}

func TestSessionRepository_SaveAndFindActive(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewSessionRepository(pool)
	ctx := context.Background()

	tenantID := uuid.New().String()
	roomID := seedRoom(t, pool, tenantID)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", roomID)
	})

	sess := &domain.ParticipantSession{
		ID:              uuid.New().String(),
		RoomID:          roomID,
		TenantID:        tenantID,
		ParticipantID:   "doctor_1",
		ParticipantRole: "doctor",
		JoinedAt:        time.Now().UTC().Truncate(time.Microsecond),
	}
	if err := repo.Save(ctx, sess); err != nil {
		t.Fatalf("Save: %v", err)
	}

	got, err := repo.FindActive(ctx, roomID, "doctor_1")
	if err != nil {
		t.Fatalf("FindActive: %v", err)
	}
	if got.TenantID != tenantID {
		t.Errorf("TenantID = %q, want %q", got.TenantID, tenantID)
	}
	if got.LeftAt != nil {
		t.Errorf("LeftAt = %v, want nil (sessão aberta)", got.LeftAt)
	}
}

func TestSessionRepository_CloseSession_PreencheBillableMinutes(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewSessionRepository(pool)
	ctx := context.Background()

	tenantID := uuid.New().String()
	roomID := seedRoom(t, pool, tenantID)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", roomID)
	})

	joinedAt := time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)
	sess := &domain.ParticipantSession{
		ID:              uuid.New().String(),
		RoomID:          roomID,
		TenantID:        tenantID,
		ParticipantID:   "p1",
		ParticipantRole: "doctor",
		JoinedAt:        joinedAt,
	}
	if err := repo.Save(ctx, sess); err != nil {
		t.Fatalf("Save: %v", err)
	}

	leftAt := joinedAt.Add(7*time.Minute + 30*time.Second)
	closed, err := repo.CloseSession(ctx, roomID, "p1", leftAt)
	if err != nil {
		t.Fatalf("CloseSession: %v", err)
	}
	if closed.BillableMinutes() != 8 {
		t.Errorf("BillableMinutes = %d, want 8 (ceiling de 7m30s)", closed.BillableMinutes())
	}

	var dbBillable *int
	row := pool.QueryRow(ctx, "SELECT billable_minutes FROM participant_sessions WHERE id = $1", sess.ID)
	if err := row.Scan(&dbBillable); err != nil {
		t.Fatalf("scan billable: %v", err)
	}
	if dbBillable == nil || *dbBillable != 8 {
		t.Errorf("billable_minutes em DB = %v, want 8", dbBillable)
	}
}

func TestSessionRepository_SumMinutesAndCountRooms_ByPeriod(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewSessionRepository(pool)
	ctx := context.Background()

	const period = "2026-06"
	tenantA := uuid.New().String()
	tenantB := uuid.New().String()

	// Tenant A: 2 rooms distintos, 3 sessions fechadas em junho (5+10+15 = 30 min);
	// 1 sessão fechada em maio (não conta no período "2026-06").
	roomA1 := seedRoom(t, pool, tenantA)
	roomA2 := seedRoom(t, pool, tenantA)
	// Tenant B: 1 room, 1 sessão aberta em junho. Soma não conta (billable_minutes IS NULL)
	// mas o room conta no COUNT — decisão de produto: sala viva já é volume.
	roomB1 := seedRoom(t, pool, tenantB)

	t.Cleanup(func() {
		for _, id := range []string{roomA1, roomA2, roomB1} {
			_, _ = pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", id)
		}
	})

	seedSession := func(roomID, tenantID, pid, role string, joinedAt time.Time, billable *int) {
		var leftAt interface{}
		if billable != nil {
			leftAt = joinedAt.Add(time.Duration(*billable) * time.Minute)
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO participant_sessions (id, room_id, tenant_id, participant_id, participant_role, joined_at, left_at, billable_minutes)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.New().String(), roomID, tenantID, pid, role, joinedAt, leftAt, billable)
		if err != nil {
			t.Fatalf("seed session: %v", err)
		}
	}

	intp := func(i int) *int { return &i }
	jun := func(day, hour int) time.Time { return time.Date(2026, 6, day, hour, 0, 0, 0, time.UTC) }
	mai := func(day, hour int) time.Time { return time.Date(2026, 5, day, hour, 0, 0, 0, time.UTC) }

	seedSession(roomA1, tenantA, "doc1", "doctor", jun(1, 10), intp(5))
	seedSession(roomA1, tenantA, "pat1", "patient", jun(1, 10), intp(10))
	seedSession(roomA2, tenantA, "doc1", "doctor", jun(15, 14), intp(15))
	seedSession(roomA1, tenantA, "doc1", "doctor", mai(10, 9), intp(99)) // mês errado
	seedSession(roomB1, tenantB, "doc2", "doctor", jun(20, 8), nil)      // aberta

	t.Run("tenant A soma os 3 minutos de junho e ignora maio", func(t *testing.T) {
		got, err := repo.SumMinutesByTenantAndPeriod(ctx, tenantA, period)
		if err != nil {
			t.Fatalf("SumMinutes: %v", err)
		}
		if got != 30 {
			t.Errorf("SumMinutes = %d, want 30 (5+10+15)", got)
		}
	})

	t.Run("tenant A conta 2 rooms distintos no período", func(t *testing.T) {
		got, err := repo.CountRoomsByTenantAndPeriod(ctx, tenantA, period)
		if err != nil {
			t.Fatalf("CountRooms: %v", err)
		}
		if got != 2 {
			t.Errorf("CountRooms = %d, want 2 (DISTINCT roomA1, roomA2)", got)
		}
	})

	t.Run("tenant B soma 0 (sessão aberta ainda não tem billable)", func(t *testing.T) {
		got, err := repo.SumMinutesByTenantAndPeriod(ctx, tenantB, period)
		if err != nil {
			t.Fatalf("SumMinutes: %v", err)
		}
		if got != 0 {
			t.Errorf("SumMinutes = %d, want 0", got)
		}
	})

	t.Run("tenant B conta 1 room mesmo com sessão aberta", func(t *testing.T) {
		got, err := repo.CountRoomsByTenantAndPeriod(ctx, tenantB, period)
		if err != nil {
			t.Fatalf("CountRooms: %v", err)
		}
		if got != 1 {
			t.Errorf("CountRooms = %d, want 1 (sessão aberta CONTA — decisão de produto)", got)
		}
	})

	t.Run("isolamento entre tenants — tenant A não enxerga sessão de B", func(t *testing.T) {
		// Garantia explícita do contrato multi-tenant (ADR-0002).
		got, err := repo.CountRoomsByTenantAndPeriod(ctx, tenantA, period)
		if err != nil {
			t.Fatalf("CountRooms: %v", err)
		}
		if got != 2 {
			t.Errorf("CountRooms vazou entre tenants? Got %d, want 2", got)
		}
	})
}

func TestSessionRepository_SumAndCount_TenantSemDados(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewSessionRepository(pool)
	ctx := context.Background()

	tenantID := uuid.New().String()

	minutes, err := repo.SumMinutesByTenantAndPeriod(ctx, tenantID, "2026-06")
	if err != nil {
		t.Fatalf("SumMinutes: %v", err)
	}
	if minutes != 0 {
		t.Errorf("SumMinutes tenant sem dados = %d, want 0 (não erro)", minutes)
	}

	rooms, err := repo.CountRoomsByTenantAndPeriod(ctx, tenantID, "2026-06")
	if err != nil {
		t.Fatalf("CountRooms: %v", err)
	}
	if rooms != 0 {
		t.Errorf("CountRooms tenant sem dados = %d, want 0", rooms)
	}
}
