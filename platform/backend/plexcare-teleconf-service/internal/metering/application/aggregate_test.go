package application_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/metering/application"
	"plexcare/platform/plexcare-teleconf-service/internal/metering/domain"
)

type fakeSessions struct {
	sumByKey   map[string]int
	countByKey map[string]int
	sumErr     error
	countErr   error

	gotSumTenant    string
	gotSumPeriod    string
	gotCountTenant  string
	gotCountPeriod  string
	sumCalls        int
	countCalls      int
}

func (f *fakeSessions) Save(context.Context, *domain.ParticipantSession) error { return nil }
func (f *fakeSessions) FindActive(context.Context, string, string) (*domain.ParticipantSession, error) {
	return nil, nil
}
func (f *fakeSessions) CloseSession(context.Context, string, string, time.Time) (*domain.ParticipantSession, error) {
	return nil, nil
}
func (f *fakeSessions) SumMinutesByTenantAndPeriod(_ context.Context, tenant, period string) (int, error) {
	f.sumCalls++
	f.gotSumTenant, f.gotSumPeriod = tenant, period
	if f.sumErr != nil {
		return 0, f.sumErr
	}
	return f.sumByKey[tenant+"|"+period], nil
}
func (f *fakeSessions) CountRoomsByTenantAndPeriod(_ context.Context, tenant, period string) (int, error) {
	f.countCalls++
	f.gotCountTenant, f.gotCountPeriod = tenant, period
	if f.countErr != nil {
		return 0, f.countErr
	}
	return f.countByKey[tenant+"|"+period], nil
}

type fakeUsage struct {
	upserted []*domain.MonthlyUsage
	err      error
}

func (f *fakeUsage) Upsert(_ context.Context, u *domain.MonthlyUsage) error {
	if f.err != nil {
		return f.err
	}
	f.upserted = append(f.upserted, u)
	return nil
}
func (f *fakeUsage) FindByTenantAndPeriod(context.Context, string, string) (*domain.MonthlyUsage, error) {
	return nil, nil
}

func TestAggregateUseCase_Execute(t *testing.T) {
	const tenant = "8b6c1e33-1c57-4f85-a8fa-1025451490a4"
	const period = "2026-06"
	key := tenant + "|" + period

	tests := []struct {
		name          string
		input         application.AggregateInput
		sumByKey      map[string]int
		countByKey    map[string]int
		sumErr        error
		countErr      error
		upsertErr     error
		wantPeriod    string
		wantMinutes   int
		wantRooms     int
		wantUpserts   int
		wantErrSubstr string
	}{
		{
			name:        "happy path soma minutos e conta salas",
			input:       application.AggregateInput{TenantID: tenant, Period: period},
			sumByKey:    map[string]int{key: 1234},
			countByKey:  map[string]int{key: 17},
			wantPeriod:  period,
			wantMinutes: 1234,
			wantRooms:   17,
			wantUpserts: 1,
		},
		{
			name:        "período vazio cai no mês corrente UTC",
			input:       application.AggregateInput{TenantID: tenant, Period: ""},
			wantPeriod:  time.Now().UTC().Format("2006-01"),
			wantMinutes: 0,
			wantRooms:   0,
			wantUpserts: 1,
		},
		{
			name:        "zero minutos e zero salas ainda gravam linha (UPSERT idempotente)",
			input:       application.AggregateInput{TenantID: tenant, Period: period},
			wantPeriod:  period,
			wantMinutes: 0,
			wantRooms:   0,
			wantUpserts: 1,
		},
		{
			name:          "erro em SumMinutes propaga sem chamar Upsert",
			input:         application.AggregateInput{TenantID: tenant, Period: period},
			sumErr:        errors.New("db down"),
			wantErrSubstr: "summing minutes",
		},
		{
			name:          "erro em CountRooms propaga sem chamar Upsert",
			input:         application.AggregateInput{TenantID: tenant, Period: period},
			sumByKey:      map[string]int{key: 100},
			countErr:      errors.New("db down"),
			wantErrSubstr: "counting rooms",
		},
		{
			name:          "erro em Upsert propaga",
			input:         application.AggregateInput{TenantID: tenant, Period: period},
			sumByKey:      map[string]int{key: 100},
			countByKey:    map[string]int{key: 5},
			upsertErr:     errors.New("conflict"),
			wantErrSubstr: "upserting monthly usage",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sess := &fakeSessions{
				sumByKey:   tc.sumByKey,
				countByKey: tc.countByKey,
				sumErr:     tc.sumErr,
				countErr:   tc.countErr,
			}
			usage := &fakeUsage{err: tc.upsertErr}
			uc := application.NewAggregateUseCase(sess, usage, zap.NewNop())

			out, err := uc.Execute(context.Background(), tc.input)

			if tc.wantErrSubstr != "" {
				if err == nil {
					t.Fatalf("esperava erro contendo %q, veio nil", tc.wantErrSubstr)
				}
				if !strings.Contains(err.Error(), tc.wantErrSubstr) {
					t.Errorf("err = %q, esperava conter %q", err.Error(), tc.wantErrSubstr)
				}
				if len(usage.upserted) != 0 {
					t.Errorf("não devia ter chamado Upsert; teve %d", len(usage.upserted))
				}
				return
			}

			if err != nil {
				t.Fatalf("err inesperado: %v", err)
			}
			if out.TenantID != tenant {
				t.Errorf("TenantID = %q, esperava %q", out.TenantID, tenant)
			}
			if out.Period != tc.wantPeriod {
				t.Errorf("Period = %q, esperava %q", out.Period, tc.wantPeriod)
			}
			if out.TotalMinutes != tc.wantMinutes {
				t.Errorf("TotalMinutes = %d, esperava %d", out.TotalMinutes, tc.wantMinutes)
			}
			if out.TotalRooms != tc.wantRooms {
				t.Errorf("TotalRooms = %d, esperava %d", out.TotalRooms, tc.wantRooms)
			}
			if len(usage.upserted) != tc.wantUpserts {
				t.Errorf("Upsert calls = %d, esperava %d", len(usage.upserted), tc.wantUpserts)
			}
			if tc.wantUpserts == 1 {
				u := usage.upserted[0]
				if u.TenantID != tenant || u.Period != tc.wantPeriod || u.TotalMinutes != tc.wantMinutes || u.TotalRooms != tc.wantRooms {
					t.Errorf("MonthlyUsage upsertado = %+v, esperava {tenant=%s period=%s min=%d rooms=%d}",
						u, tenant, tc.wantPeriod, tc.wantMinutes, tc.wantRooms)
				}
				if u.UpdatedAt.IsZero() {
					t.Errorf("UpdatedAt não devia ser zero")
				}
			}
			if sess.gotSumTenant != tenant {
				t.Errorf("Sum chamado com tenant %q, esperava %q", sess.gotSumTenant, tenant)
			}
			if sess.gotSumPeriod != tc.wantPeriod {
				t.Errorf("Sum chamado com period %q, esperava %q", sess.gotSumPeriod, tc.wantPeriod)
			}
			if sess.gotCountTenant != tenant {
				t.Errorf("Count chamado com tenant %q, esperava %q", sess.gotCountTenant, tenant)
			}
			if sess.gotCountPeriod != tc.wantPeriod {
				t.Errorf("Count chamado com period %q, esperava %q", sess.gotCountPeriod, tc.wantPeriod)
			}
		})
	}
}
