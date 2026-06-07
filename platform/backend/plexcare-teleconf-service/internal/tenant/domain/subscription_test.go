package domain_test

import (
	"errors"
	"testing"
	"time"

	"plexcare/platform/plexcare-teleconf-service/internal/tenant/domain"
)

const validUUID = "8b6c1e33-1c57-4f85-a8fa-1025451490a4"

func validSubscription() *domain.Subscription {
	now := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	return &domain.Subscription{
		TenantID:           validUUID,
		AccountID:          1,
		PlanCode:           "rooms_clinica_annual",
		ProductSKU:         domain.ProductRooms,
		PlanTier:           domain.TierClinica,
		Status:             domain.StatusActive,
		MaxConcurrentRooms: 30,
		Features:           map[string]bool{"recording": true},
		TrialEndsAt:        nil,
		CurrentPeriodEnd:   now.AddDate(0, 1, 0),
		UpdatedAt:          now,
	}
}

func TestSubscription_Validate(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*domain.Subscription)
		wantErr error
	}{
		{
			name:    "happy path passa validação",
			mutate:  func(_ *domain.Subscription) {},
			wantErr: nil,
		},
		{
			name:    "tenant_id vazio",
			mutate:  func(s *domain.Subscription) { s.TenantID = "" },
			wantErr: domain.ErrInvalidTenantID,
		},
		{
			name:    "tenant_id não-UUID",
			mutate:  func(s *domain.Subscription) { s.TenantID = "not-a-uuid" },
			wantErr: domain.ErrInvalidTenantID,
		},
		{
			name:    "tenant_id com caractere não-hex",
			mutate:  func(s *domain.Subscription) { s.TenantID = "8b6c1e33-1c57-4f85-a8fa-1025451490Zx" },
			wantErr: domain.ErrInvalidTenantID,
		},
		{
			name:    "product_sku fora do enum",
			mutate:  func(s *domain.Subscription) { s.ProductSKU = "mystery" },
			wantErr: domain.ErrInvalidProductSKU,
		},
		{
			name:    "plan_tier fora do enum",
			mutate:  func(s *domain.Subscription) { s.PlanTier = "gold" },
			wantErr: domain.ErrInvalidPlanTier,
		},
		{
			name:    "status fora do enum",
			mutate:  func(s *domain.Subscription) { s.Status = "expired" },
			wantErr: domain.ErrInvalidStatus,
		},
		{
			name:    "max_concurrent_rooms negativo",
			mutate:  func(s *domain.Subscription) { s.MaxConcurrentRooms = -1 },
			wantErr: domain.ErrNegativeMaxRooms,
		},
		{
			name:    "current_period_end zerado",
			mutate:  func(s *domain.Subscription) { s.CurrentPeriodEnd = time.Time{} },
			wantErr: domain.ErrMissingCurrentPeriodEnd,
		},
		{
			name:    "updated_at zerado",
			mutate:  func(s *domain.Subscription) { s.UpdatedAt = time.Time{} },
			wantErr: domain.ErrMissingUpdatedAt,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := validSubscription()
			tc.mutate(s)
			err := s.Validate()
			if !errors.Is(err, tc.wantErr) {
				t.Errorf("err = %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func TestSubscription_Validate_AcceptsAllEnumValues(t *testing.T) {
	t.Run("todos os product_sku válidos", func(t *testing.T) {
		for _, sku := range []domain.ProductSKU{domain.ProductRooms, domain.ProductSchedule, domain.ProductSuite} {
			s := validSubscription()
			s.ProductSKU = sku
			if err := s.Validate(); err != nil {
				t.Errorf("product_sku=%q rejeitado: %v", sku, err)
			}
		}
	})
	t.Run("todos os plan_tier válidos", func(t *testing.T) {
		for _, tier := range []domain.PlanTier{
			domain.TierTrial, domain.TierSolo, domain.TierClinica, domain.TierEnterprise,
		} {
			s := validSubscription()
			s.PlanTier = tier
			if err := s.Validate(); err != nil {
				t.Errorf("plan_tier=%q rejeitado: %v", tier, err)
			}
		}
	})
	t.Run("todos os status válidos", func(t *testing.T) {
		for _, st := range []domain.SubscriptionStatus{
			domain.StatusTrialing, domain.StatusActive, domain.StatusPastDue,
			domain.StatusCancelled, domain.StatusChurned,
		} {
			s := validSubscription()
			s.Status = st
			if err := s.Validate(); err != nil {
				t.Errorf("status=%q rejeitado: %v", st, err)
			}
		}
	})
}
