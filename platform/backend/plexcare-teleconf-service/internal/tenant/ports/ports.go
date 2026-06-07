// Package ports declara contratos consumidos pela camada application.
// Os adapters concretos (postgres, kafka) implementam essas interfaces.
package ports

import (
	"context"

	"plexcare/platform/plexcare-teleconf-service/internal/tenant/domain"
)

// TenantViewRepository persiste/lê o read-model tenant_subscription_view.
type TenantViewRepository interface {
	// Upsert grava o estado da subscription. Implementação garante
	// idempotência por tenant_id e descarte de eventos out-of-order
	// (UPDATE só ocorre se EXCLUDED.updated_at > stored updated_at).
	// Devolve true quando a row foi inserida ou atualizada;
	// false quando o evento foi descartado por staleness.
	Upsert(ctx context.Context, sub *domain.Subscription) (applied bool, err error)

	// FindByTenantID retorna a subscription corrente do tenant ou
	// domain.ErrSubscriptionNotFound se não existir.
	FindByTenantID(ctx context.Context, tenantID string) (*domain.Subscription, error)
}
