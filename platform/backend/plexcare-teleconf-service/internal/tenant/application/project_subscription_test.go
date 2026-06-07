package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/tenant/application"
	"plexcare/platform/plexcare-teleconf-service/internal/tenant/domain"
)

const tenantUUID = "8b6c1e33-1c57-4f85-a8fa-1025451490a4"

type fakeRepo struct {
	upsertCalls int
	applied     bool
	upsertErr   error
	stored      *domain.Subscription
}

func (f *fakeRepo) Upsert(_ context.Context, s *domain.Subscription) (bool, error) {
	f.upsertCalls++
	if f.upsertErr != nil {
		return false, f.upsertErr
	}
	f.stored = s
	return f.applied, nil
}

func (f *fakeRepo) FindByTenantID(context.Context, string) (*domain.Subscription, error) {
	return f.stored, nil
}

func validSubscription() *domain.Subscription {
	now := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	return &domain.Subscription{
		TenantID:           tenantUUID,
		AccountID:          1,
		PlanCode:           "rooms_clinica_annual",
		ProductSKU:         domain.ProductRooms,
		PlanTier:           domain.TierClinica,
		Status:             domain.StatusActive,
		MaxConcurrentRooms: 30,
		Features:           map[string]bool{"recording": true},
		CurrentPeriodEnd:   now.AddDate(0, 1, 0),
		UpdatedAt:          now,
	}
}

func TestProjectSubscription_Execute(t *testing.T) {
	tests := []struct {
		name          string
		sub           *domain.Subscription
		applied       bool
		upsertErr     error
		wantUpsert    int
		wantErrSubstr string
	}{
		{
			name:       "happy path projeta com applied=true",
			sub:        validSubscription(),
			applied:    true,
			wantUpsert: 1,
		},
		{
			name:       "evento out-of-order (applied=false) não é erro",
			sub:        validSubscription(),
			applied:    false,
			wantUpsert: 1,
		},
		{
			name: "validação falha não chama Upsert",
			sub: func() *domain.Subscription {
				s := validSubscription()
				s.TenantID = "not-uuid"
				return s
			}(),
			wantUpsert:    0,
			wantErrSubstr: "validating subscription",
		},
		{
			name: "max_concurrent_rooms negativo é validação que falha",
			sub: func() *domain.Subscription {
				s := validSubscription()
				s.MaxConcurrentRooms = -5
				return s
			}(),
			wantUpsert:    0,
			wantErrSubstr: "validating subscription",
		},
		{
			name:          "erro do repo é propagado",
			sub:           validSubscription(),
			upsertErr:     errors.New("db down"),
			wantUpsert:    1,
			wantErrSubstr: "upserting subscription",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeRepo{applied: tc.applied, upsertErr: tc.upsertErr}
			uc := application.NewProjectSubscriptionUseCase(repo, zap.NewNop())

			err := uc.Execute(context.Background(), tc.sub)

			if tc.wantErrSubstr != "" {
				if err == nil {
					t.Fatalf("esperava erro contendo %q, veio nil", tc.wantErrSubstr)
				}
				if !contains(err.Error(), tc.wantErrSubstr) {
					t.Errorf("err = %q, esperava conter %q", err.Error(), tc.wantErrSubstr)
				}
			} else if err != nil {
				t.Fatalf("err inesperado: %v", err)
			}

			if repo.upsertCalls != tc.wantUpsert {
				t.Errorf("Upsert chamado %d vezes, esperava %d", repo.upsertCalls, tc.wantUpsert)
			}
		})
	}
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (haystack == needle ||
		(len(needle) > 0 && indexOf(haystack, needle) >= 0))
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
