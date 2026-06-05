package ports

import (
	"context"
	"time"

	"plexcare/platform/plexcare-teleconf-service/internal/metering/domain"
)

type SessionRepository interface {
	Save(ctx context.Context, session *domain.ParticipantSession) error
	FindActive(ctx context.Context, roomID, participantID string) (*domain.ParticipantSession, error)
	CloseSession(ctx context.Context, roomID, participantID string, leftAt time.Time) (*domain.ParticipantSession, error)
	SumMinutesByTenantAndPeriod(ctx context.Context, tenantID, period string) (int, error)
	CountRoomsByTenantAndPeriod(ctx context.Context, tenantID, period string) (int, error)
}

type UsageRepository interface {
	Upsert(ctx context.Context, usage *domain.MonthlyUsage) error
	FindByTenantAndPeriod(ctx context.Context, tenantID, period string) (*domain.MonthlyUsage, error)
}

type EventPublisher interface {
	Publish(ctx context.Context, topic, key string, payload any) error
}
