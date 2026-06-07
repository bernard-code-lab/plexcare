// Package postgres implementa tenant/ports.TenantViewRepository.
package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"plexcare/platform/plexcare-teleconf-service/internal/tenant/domain"
)

type ViewRepository struct {
	pool *pgxpool.Pool
}

func NewViewRepository(pool *pgxpool.Pool) *ViewRepository {
	return &ViewRepository{pool: pool}
}

// Upsert grava o snapshot da subscription. O UPDATE só dispara quando
// EXCLUDED.updated_at > stored updated_at — eventos out-of-order são
// descartados silenciosamente (devolve applied=false).
func (r *ViewRepository) Upsert(ctx context.Context, s *domain.Subscription) (bool, error) {
	featuresJSON, err := json.Marshal(s.Features)
	if err != nil {
		return false, fmt.Errorf("marshal features: %w", err)
	}

	const q = `
		INSERT INTO tenant_subscription_view (
			tenant_id, account_id, plan_code, product_sku, plan_tier,
			status, max_concurrent_rooms, features, trial_ends_at,
			current_period_end, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
		ON CONFLICT (tenant_id) DO UPDATE SET
			account_id           = EXCLUDED.account_id,
			plan_code            = EXCLUDED.plan_code,
			product_sku          = EXCLUDED.product_sku,
			plan_tier            = EXCLUDED.plan_tier,
			status               = EXCLUDED.status,
			max_concurrent_rooms = EXCLUDED.max_concurrent_rooms,
			features             = EXCLUDED.features,
			trial_ends_at        = EXCLUDED.trial_ends_at,
			current_period_end   = EXCLUDED.current_period_end,
			updated_at           = EXCLUDED.updated_at
		WHERE EXCLUDED.updated_at > tenant_subscription_view.updated_at
	`
	tag, err := r.pool.Exec(ctx, q,
		s.TenantID, s.AccountID, s.PlanCode, string(s.ProductSKU), string(s.PlanTier),
		string(s.Status), s.MaxConcurrentRooms, string(featuresJSON), s.TrialEndsAt,
		s.CurrentPeriodEnd, s.UpdatedAt,
	)
	if err != nil {
		return false, fmt.Errorf("upsert tenant_subscription_view: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

func (r *ViewRepository) FindByTenantID(ctx context.Context, tenantID string) (*domain.Subscription, error) {
	const q = `
		SELECT tenant_id, account_id, plan_code, product_sku, plan_tier,
		       status, max_concurrent_rooms, features, trial_ends_at,
		       current_period_end, updated_at
		  FROM tenant_subscription_view
		 WHERE tenant_id = $1
	`
	row := r.pool.QueryRow(ctx, q, tenantID)

	var (
		s             domain.Subscription
		sku, tier, st string
		featuresRaw   []byte
	)
	err := row.Scan(
		&s.TenantID, &s.AccountID, &s.PlanCode, &sku, &tier,
		&st, &s.MaxConcurrentRooms, &featuresRaw, &s.TrialEndsAt,
		&s.CurrentPeriodEnd, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrSubscriptionNotFound
		}
		return nil, fmt.Errorf("scan tenant_subscription_view: %w", err)
	}
	s.ProductSKU = domain.ProductSKU(sku)
	s.PlanTier = domain.PlanTier(tier)
	s.Status = domain.SubscriptionStatus(st)

	if len(featuresRaw) > 0 {
		if err := json.Unmarshal(featuresRaw, &s.Features); err != nil {
			return nil, fmt.Errorf("unmarshal features: %w", err)
		}
	}
	return &s, nil
}
