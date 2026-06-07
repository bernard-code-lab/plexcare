//go:build integration

package postgres_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"plexcare/platform/plexcare-teleconf-service/internal/tenant/domain"
	"plexcare/platform/plexcare-teleconf-service/internal/tenant/infrastructure/postgres"
)

// Pre-req: docker compose -f docker-compose.dev.yml up -d postgres
// Run:     go test -tags=integration ./internal/tenant/infrastructure/postgres/...

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

func newSubscription(tenantID string, updatedAt time.Time) *domain.Subscription {
	return &domain.Subscription{
		TenantID:           tenantID,
		AccountID:          7,
		PlanCode:           "rooms_clinica_annual",
		ProductSKU:         domain.ProductRooms,
		PlanTier:           domain.TierClinica,
		Status:             domain.StatusActive,
		MaxConcurrentRooms: 30,
		Features:           map[string]bool{"recording": true},
		TrialEndsAt:        nil,
		CurrentPeriodEnd:   updatedAt.AddDate(0, 1, 0),
		UpdatedAt:          updatedAt,
	}
}

func TestViewRepository_UpsertInsereNovaRow(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewViewRepository(pool)
	ctx := context.Background()
	tenantID := uuid.New().String()
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM tenant_subscription_view WHERE tenant_id = $1", tenantID)
	})

	now := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	sub := newSubscription(tenantID, now)

	applied, err := repo.Upsert(ctx, sub)
	if err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	if !applied {
		t.Error("applied = false na primeira inserção; esperava true")
	}

	got, err := repo.FindByTenantID(ctx, tenantID)
	if err != nil {
		t.Fatalf("FindByTenantID: %v", err)
	}
	if got.PlanCode != "rooms_clinica_annual" {
		t.Errorf("PlanCode = %q, want rooms_clinica_annual", got.PlanCode)
	}
	if got.Features["recording"] != true {
		t.Errorf("Features[recording] = false, want true")
	}
	if !got.UpdatedAt.Equal(now) {
		t.Errorf("UpdatedAt = %v, want %v", got.UpdatedAt, now)
	}
}

func TestViewRepository_UpsertAtualizaQuandoUpdatedAtMaior(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewViewRepository(pool)
	ctx := context.Background()
	tenantID := uuid.New().String()
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM tenant_subscription_view WHERE tenant_id = $1", tenantID)
	})

	t1 := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	if _, err := repo.Upsert(ctx, newSubscription(tenantID, t1)); err != nil {
		t.Fatalf("Upsert t1: %v", err)
	}

	t2 := t1.Add(1 * time.Hour)
	sub2 := newSubscription(tenantID, t2)
	sub2.Status = domain.StatusCancelled

	applied, err := repo.Upsert(ctx, sub2)
	if err != nil {
		t.Fatalf("Upsert t2: %v", err)
	}
	if !applied {
		t.Error("applied = false em update legítimo; esperava true")
	}

	got, _ := repo.FindByTenantID(ctx, tenantID)
	if got.Status != domain.StatusCancelled {
		t.Errorf("Status = %q após update, want cancelled", got.Status)
	}
	if !got.UpdatedAt.Equal(t2) {
		t.Errorf("UpdatedAt = %v, want %v", got.UpdatedAt, t2)
	}
}

func TestViewRepository_UpsertDescartaOutOfOrder(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewViewRepository(pool)
	ctx := context.Background()
	tenantID := uuid.New().String()
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM tenant_subscription_view WHERE tenant_id = $1", tenantID)
	})

	t1 := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	if _, err := repo.Upsert(ctx, newSubscription(tenantID, t1)); err != nil {
		t.Fatalf("Upsert t1: %v", err)
	}

	// Evento com updated_at anterior → deve ser descartado
	t0 := t1.Add(-1 * time.Hour)
	stale := newSubscription(tenantID, t0)
	stale.Status = domain.StatusCancelled

	applied, err := repo.Upsert(ctx, stale)
	if err != nil {
		t.Fatalf("Upsert stale: %v", err)
	}
	if applied {
		t.Error("applied = true para evento out-of-order; esperava false (descarte)")
	}

	got, _ := repo.FindByTenantID(ctx, tenantID)
	if got.Status != domain.StatusActive {
		t.Errorf("Status = %q após evento stale, want active (não devia mudar)", got.Status)
	}
	if !got.UpdatedAt.Equal(t1) {
		t.Errorf("UpdatedAt mudou para %v; deveria permanecer %v", got.UpdatedAt, t1)
	}
}

func TestViewRepository_UpsertEventoIdempotenteMesmoUpdatedAt(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewViewRepository(pool)
	ctx := context.Background()
	tenantID := uuid.New().String()
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM tenant_subscription_view WHERE tenant_id = $1", tenantID)
	})

	t1 := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	sub := newSubscription(tenantID, t1)
	if _, err := repo.Upsert(ctx, sub); err != nil {
		t.Fatalf("Upsert primeira: %v", err)
	}

	// Mesmo updated_at → não aplica (equal, não greater)
	applied, err := repo.Upsert(ctx, sub)
	if err != nil {
		t.Fatalf("Upsert duplicada: %v", err)
	}
	if applied {
		t.Error("applied = true para evento duplicado (mesmo updated_at); esperava false")
	}
}

func TestViewRepository_FindByTenantID_NotFound(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewViewRepository(pool)
	ctx := context.Background()
	tenantID := uuid.New().String()

	_, err := repo.FindByTenantID(ctx, tenantID)
	if err != domain.ErrSubscriptionNotFound {
		t.Errorf("err = %v, want ErrSubscriptionNotFound", err)
	}
}

func TestViewRepository_IsolamentoMultiTenant(t *testing.T) {
	pool := newPool(t)
	repo := postgres.NewViewRepository(pool)
	ctx := context.Background()

	tenantA := uuid.New().String()
	tenantB := uuid.New().String()
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM tenant_subscription_view WHERE tenant_id IN ($1, $2)", tenantA, tenantB)
	})

	now := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	subA := newSubscription(tenantA, now)
	subA.PlanCode = "rooms_solo_annual"
	subB := newSubscription(tenantB, now)
	subB.PlanCode = "suite_clinica_annual"

	if _, err := repo.Upsert(ctx, subA); err != nil {
		t.Fatalf("Upsert A: %v", err)
	}
	if _, err := repo.Upsert(ctx, subB); err != nil {
		t.Fatalf("Upsert B: %v", err)
	}

	gotA, _ := repo.FindByTenantID(ctx, tenantA)
	gotB, _ := repo.FindByTenantID(ctx, tenantB)

	if gotA.PlanCode != "rooms_solo_annual" {
		t.Errorf("tenant A plano = %q, want rooms_solo_annual", gotA.PlanCode)
	}
	if gotB.PlanCode != "suite_clinica_annual" {
		t.Errorf("tenant B plano = %q, want suite_clinica_annual", gotB.PlanCode)
	}
}
