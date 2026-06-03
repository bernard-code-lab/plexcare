package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf/internal/metering/domain"
	"plexcare/platform/plexcare-teleconf/internal/metering/ports"
)

var tracer = otel.Tracer("usage-metering/process-event")

type EventType string

const (
	EventParticipantJoined EventType = "participant_joined"
	EventParticipantLeft   EventType = "participant_left"
)

// ParticipantEvent é o payload consumido do Kafka (topic: room.events).
// Emitido pelo Webhook Service ao receber eventos do LiveKit.
type ParticipantEvent struct {
	Type            EventType
	RoomID          string
	TenantID        string
	ParticipantID   string
	ParticipantRole string
	OccurredAt      time.Time
}

// UsageRecordedEvent é publicado após fechar uma sessão.
// O Billing Service consome este tópico para acumular minutos.
type UsageRecordedEvent struct {
	TenantID        string    `json:"tenant_id"`
	RoomID          string    `json:"room_id"`
	ParticipantID   string    `json:"participant_id"`
	ParticipantRole string    `json:"participant_role"`
	BillableMinutes int       `json:"billable_minutes"`
	Period          string    `json:"period"`
	RecordedAt      time.Time `json:"recorded_at"`
}

type ProcessEventUseCase struct {
	sessions  ports.SessionRepository
	publisher ports.EventPublisher
	log       *zap.Logger
}

func NewProcessEventUseCase(
	sessions ports.SessionRepository,
	publisher ports.EventPublisher,
	log *zap.Logger,
) *ProcessEventUseCase {
	return &ProcessEventUseCase{sessions: sessions, publisher: publisher, log: log}
}

func (uc *ProcessEventUseCase) Execute(ctx context.Context, event ParticipantEvent) error {
	ctx, span := tracer.Start(ctx, "ProcessEvent")
	defer span.End()

	span.SetAttributes(
		attribute.String("event.type", string(event.Type)),
		attribute.String("room.id", event.RoomID),
		attribute.String("tenant.id", event.TenantID),
		attribute.String("participant.id", event.ParticipantID),
	)

	switch event.Type {
	case EventParticipantJoined:
		return uc.handleJoined(ctx, event)
	case EventParticipantLeft:
		return uc.handleLeft(ctx, event)
	default:
		uc.log.Debug("ignoring unhandled event type", zap.String("type", string(event.Type)))
		return nil
	}
}

func (uc *ProcessEventUseCase) handleJoined(ctx context.Context, event ParticipantEvent) error {
	session := &domain.ParticipantSession{
		ID:              uuid.New().String(),
		RoomID:          event.RoomID,
		TenantID:        event.TenantID,
		ParticipantID:   event.ParticipantID,
		ParticipantRole: event.ParticipantRole,
		JoinedAt:        event.OccurredAt,
	}

	if err := uc.sessions.Save(ctx, session); err != nil {
		return fmt.Errorf("saving participant session: %w", err)
	}

	uc.log.Info("session opened",
		zap.String("session_id", session.ID),
		zap.String("room_id", event.RoomID),
		zap.String("participant_id", event.ParticipantID),
	)
	return nil
}

func (uc *ProcessEventUseCase) handleLeft(ctx context.Context, event ParticipantEvent) error {
	ctx, span := tracer.Start(ctx, "handleLeft")
	defer span.End()

	session, err := uc.sessions.CloseSession(ctx, event.RoomID, event.ParticipantID, event.OccurredAt)
	if err != nil {
		// Pode acontecer se o participant_joined chegou fora de ordem ou foi perdido.
		// Logamos mas não retornamos erro — o Kafka não vai retentar (seria duplicata).
		uc.log.Warn("could not close session, possible out-of-order event",
			zap.String("room_id", event.RoomID),
			zap.String("participant_id", event.ParticipantID),
			zap.Error(err),
		)
		return nil
	}

	minutes := session.BillableMinutes()
	period := event.OccurredAt.Format("2006-01")

	uc.log.Info("session closed",
		zap.String("session_id", session.ID),
		zap.Int("billable_minutes", minutes),
		zap.String("period", period),
	)

	// Publica para o tópico de usage — Billing Service agrega a partir daqui.
	if err := uc.publisher.Publish(ctx, "metering.usage", session.ID, UsageRecordedEvent{
		TenantID:        event.TenantID,
		RoomID:          event.RoomID,
		ParticipantID:   event.ParticipantID,
		ParticipantRole: event.ParticipantRole,
		BillableMinutes: minutes,
		Period:          period,
		RecordedAt:      time.Now().UTC(),
	}); err != nil {
		// Non-fatal: sessão está fechada no DB. O AggregateUseCase reconcilia via DB.
		uc.log.Warn("failed to publish usage.recorded event",
			zap.String("session_id", session.ID),
			zap.Error(err),
		)
	}

	span.SetAttributes(attribute.Int("billable_minutes", minutes))

	return nil
}
