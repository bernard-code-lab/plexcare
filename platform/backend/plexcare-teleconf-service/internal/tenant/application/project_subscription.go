// Package application orquestra o domínio via ports — não conhece o adapter.
package application

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/tenant/domain"
	"plexcare/platform/plexcare-teleconf-service/internal/tenant/ports"
)

var tracer = otel.Tracer("tenant/project-subscription")

// ProjectSubscriptionUseCase aplica um snapshot de Subscription no read-model.
// Chamado pelo consumer Kafka após desserializar o envelope CloudEvents.
type ProjectSubscriptionUseCase struct {
	repo ports.TenantViewRepository
	log  *zap.Logger
}

func NewProjectSubscriptionUseCase(repo ports.TenantViewRepository, log *zap.Logger) *ProjectSubscriptionUseCase {
	return &ProjectSubscriptionUseCase{repo: repo, log: log}
}

func (uc *ProjectSubscriptionUseCase) Execute(ctx context.Context, sub *domain.Subscription) error {
	ctx, span := tracer.Start(ctx, "ProjectSubscription")
	defer span.End()

	if err := sub.Validate(); err != nil {
		return fmt.Errorf("validating subscription: %w", err)
	}

	span.SetAttributes(
		attribute.String("tenant.id", sub.TenantID),
		attribute.Int64("account.id", sub.AccountID),
		attribute.String("product.sku", string(sub.ProductSKU)),
		attribute.String("plan.tier", string(sub.PlanTier)),
		attribute.String("subscription.status", string(sub.Status)),
	)

	applied, err := uc.repo.Upsert(ctx, sub)
	if err != nil {
		return fmt.Errorf("upserting subscription: %w", err)
	}

	if applied {
		uc.log.Info("tenant subscription projected",
			zap.String("tenant_id", sub.TenantID),
			zap.Int64("account_id", sub.AccountID),
			zap.String("status", string(sub.Status)),
		)
	} else {
		uc.log.Debug("tenant subscription event discarded (out-of-order)",
			zap.String("tenant_id", sub.TenantID),
			zap.Time("updated_at", sub.UpdatedAt),
		)
	}
	return nil
}
