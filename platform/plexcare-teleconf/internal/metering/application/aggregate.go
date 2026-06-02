package application

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf/internal/metering/domain"
	"plexcare/platform/plexcare-teleconf/internal/metering/ports"
)

// AggregateUseCase consolida o uso mensal de um tenant.
// Chamado:
//   1. Pelo cron job diário (para manter MonthlyUsage atualizado no DB)
//   2. Pelo Billing Service antes de gerar fatura (garante dados frescos)
//   3. Manualmente via endpoint interno para reconciliação
type AggregateUseCase struct {
	sessions  ports.SessionRepository
	usage     ports.UsageRepository
	log       *zap.Logger
}

func NewAggregateUseCase(
	sessions ports.SessionRepository,
	usage ports.UsageRepository,
	log *zap.Logger,
) *AggregateUseCase {
	return &AggregateUseCase{sessions: sessions, usage: usage, log: log}
}

type AggregateInput struct {
	TenantID string
	Period   string // "2026-06" — se vazio, usa mês corrente
}

type AggregateOutput struct {
	TenantID     string
	Period       string
	TotalMinutes int
	TotalRooms   int
}

func (uc *AggregateUseCase) Execute(ctx context.Context, input AggregateInput) (AggregateOutput, error) {
	ctx, span := tracer.Start(ctx, "AggregateUsage")
	defer span.End()

	period := input.Period
	if period == "" {
		period = time.Now().UTC().Format("2006-01")
	}

	span.SetAttributes(
		attribute.String("tenant.id", input.TenantID),
		attribute.String("period", period),
	)

	totalMinutes, err := uc.sessions.SumMinutesByTenantAndPeriod(ctx, input.TenantID, period)
	if err != nil {
		return AggregateOutput{}, fmt.Errorf("summing minutes: %w", err)
	}

	totalRooms, err := uc.sessions.CountRoomsByTenantAndPeriod(ctx, input.TenantID, period)
	if err != nil {
		return AggregateOutput{}, fmt.Errorf("counting rooms: %w", err)
	}

	monthly := &domain.MonthlyUsage{
		TenantID:     input.TenantID,
		Period:       period,
		TotalMinutes: totalMinutes,
		TotalRooms:   totalRooms,
		UpdatedAt:    time.Now().UTC(),
	}

	// UPSERT — idempotente, pode ser chamado quantas vezes quiser.
	if err := uc.usage.Upsert(ctx, monthly); err != nil {
		return AggregateOutput{}, fmt.Errorf("upserting monthly usage: %w", err)
	}

	uc.log.Info("usage aggregated",
		zap.String("tenant_id", input.TenantID),
		zap.String("period", period),
		zap.Int("total_minutes", totalMinutes),
		zap.Int("total_rooms", totalRooms),
	)

	span.SetAttributes(
		attribute.Int("total_minutes", totalMinutes),
		attribute.Int("total_rooms", totalRooms),
	)

	return AggregateOutput{
		TenantID:     input.TenantID,
		Period:       period,
		TotalMinutes: totalMinutes,
		TotalRooms:   totalRooms,
	}, nil
}
