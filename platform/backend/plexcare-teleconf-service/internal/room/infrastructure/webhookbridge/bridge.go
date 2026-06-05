// Package webhookbridge conecta os eventos validados do LiveKit Webhook
// aos use cases internos (FinishRoomUseCase) e ao Kafka (room.events topic).
package webhookbridge

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/room/application"
	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
)

// FinishRoomExecutor é a porta de entrada do FinishRoomUseCase.
type FinishRoomExecutor interface {
	Execute(ctx context.Context, in application.FinishRoomInput) error
}

// EventPublisher é o mesmo contrato do room/ports — declarado aqui para evitar import cycle.
type EventPublisher interface {
	Publish(ctx context.Context, topic, key string, payload any) error
}

// RoomFinder resolve o nome LiveKit ("room_<uuid>") na entidade Room, de onde
// extraímos o UUID interno e o tenant_id. Satisfeito por room/infrastructure/postgres.RoomRepository.
type RoomFinder interface {
	FindByLiveKitName(ctx context.Context, name string) (*domain.Room, error)
}

type Bridge struct {
	finish    FinishRoomExecutor
	publisher EventPublisher
	rooms     RoomFinder
	log       *zap.Logger
}

func New(finish FinishRoomExecutor, publisher EventPublisher, rooms RoomFinder, log *zap.Logger) *Bridge {
	return &Bridge{finish: finish, publisher: publisher, rooms: rooms, log: log}
}

func (b *Bridge) OnRoomFinished(ctx context.Context, livekitRoomName string, finishedAt time.Time) error {
	return b.finish.Execute(ctx, application.FinishRoomInput{
		LiveKitRoomName: livekitRoomName,
		FinishedAt:      finishedAt,
	})
}

// ParticipantEvent é o payload que o usage-metering consome de "room.events".
// Mesma shape de internal/metering/application.ParticipantEvent (mantida sincronizada).
type ParticipantEvent struct {
	Type            string    `json:"type"`      // "participant_joined" | "participant_left"
	RoomID          string    `json:"room_id"`   // UUID interno da sala (resolvido via RoomFinder)
	TenantID        string    `json:"tenant_id"` // tenant_id resolvido — participant_sessions exige UUID NOT NULL
	ParticipantID   string    `json:"participant_id"`
	ParticipantRole string    `json:"participant_role"`
	OccurredAt      time.Time `json:"occurred_at"`
}

func (b *Bridge) OnParticipantJoined(ctx context.Context, livekitRoomName, participantID, role string, at time.Time) error {
	return b.publish(ctx, "participant_joined", livekitRoomName, participantID, role, at)
}

func (b *Bridge) OnParticipantLeft(ctx context.Context, livekitRoomName, participantID, role string, at time.Time) error {
	return b.publish(ctx, "participant_left", livekitRoomName, participantID, role, at)
}

func (b *Bridge) publish(ctx context.Context, eventType, livekitName, pid, role string, at time.Time) error {
	// Resolve nome LiveKit -> UUID interno + tenant_id. participant_sessions exige ambos
	// como UUID NOT NULL; publicar o nome cru ("room_<uuid>") quebrava o INSERT no usage-metering.
	r, err := b.rooms.FindByLiveKitName(ctx, livekitName)
	if err != nil {
		return fmt.Errorf("resolving room %q: %w", livekitName, err)
	}
	return b.publisher.Publish(ctx, "room.events", r.ID, ParticipantEvent{
		Type:            eventType,
		RoomID:          r.ID,
		TenantID:        r.TenantID,
		ParticipantID:   pid,
		ParticipantRole: role,
		OccurredAt:      at,
	})
}
