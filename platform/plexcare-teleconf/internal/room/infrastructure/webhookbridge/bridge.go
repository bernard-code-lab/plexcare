// Package webhookbridge conecta os eventos validados do LiveKit Webhook
// aos use cases internos (FinishRoomUseCase) e ao Kafka (room.events topic).
package webhookbridge

import (
	"context"
	"time"

	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf/internal/room/application"
)

// FinishRoomExecutor é a porta de entrada do FinishRoomUseCase.
type FinishRoomExecutor interface {
	Execute(ctx context.Context, in application.FinishRoomInput) error
}

// EventPublisher é o mesmo contrato do room/ports — declarado aqui para evitar import cycle.
type EventPublisher interface {
	Publish(ctx context.Context, topic, key string, payload any) error
}

type Bridge struct {
	finish    FinishRoomExecutor
	publisher EventPublisher
	log       *zap.Logger
}

func New(finish FinishRoomExecutor, publisher EventPublisher, log *zap.Logger) *Bridge {
	return &Bridge{finish: finish, publisher: publisher, log: log}
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
	Type            string    `json:"type"`            // "participant_joined" | "participant_left"
	RoomID          string    `json:"room_id"`         // livekit room name (não o UUID interno)
	TenantID        string    `json:"tenant_id"`       // vazio aqui — usage-metering resolve via repo.FindByLiveKitName
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

func (b *Bridge) publish(ctx context.Context, eventType, room, pid, role string, at time.Time) error {
	return b.publisher.Publish(ctx, "room.events", room, ParticipantEvent{
		Type:            eventType,
		RoomID:          room,
		ParticipantID:   pid,
		ParticipantRole: role,
		OccurredAt:      at,
	})
}
