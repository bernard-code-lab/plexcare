package application

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"
)

// FinishRoomUseCase é acionado pelo Webhook Service quando o LiveKit
// emite o evento "room_finished". Fecha o ciclo de vida da sala no DB.
type FinishRoomUseCase struct {
	repo      roomRepo
	publisher roomPublisher
	log       *zap.Logger
}

// Interfaces locais para manter o use case testável de forma isolada.
type roomRepo interface {
	FindByLiveKitName(ctx context.Context, name string) (*roomEntity, error)
	Update(ctx context.Context, room *roomEntity) error
}

type roomPublisher interface {
	Publish(ctx context.Context, topic, key string, payload any) error
}

// roomEntity é alias interno para domain.Room — evita import cycle em testes unitários.
type roomEntity = interface{ Finish(at time.Time) error }

type FinishRoomInput struct {
	LiveKitRoomName string
	FinishedAt      time.Time
}

func (uc *FinishRoomUseCase) Execute(ctx context.Context, input FinishRoomInput) error {
	ctx, span := tracer.Start(ctx, "FinishRoom")
	defer span.End()

	// FindByLiveKitName usa índice — LiveKit não manda UUIDs internos.
	room, err := uc.repo.FindByLiveKitName(ctx, input.LiveKitRoomName)
	if err != nil {
		return fmt.Errorf("finding room by livekit name: %w", err)
	}

	if err := room.Finish(input.FinishedAt); err != nil {
		// Idempotente: evento duplicado do LiveKit não é erro fatal.
		uc.log.Info("room already finished, skipping",
			zap.String("livekit_name", input.LiveKitRoomName),
		)
		return nil
	}

	span.SetAttributes(attribute.String("livekit.room", input.LiveKitRoomName))

	if err := uc.repo.Update(ctx, room); err != nil {
		return fmt.Errorf("updating room: %w", err)
	}

	return uc.publisher.Publish(ctx, "room.events", input.LiveKitRoomName, roomFinishedEvent{
		LiveKitName: input.LiveKitRoomName,
		FinishedAt:  input.FinishedAt,
	})
}

type roomFinishedEvent struct {
	LiveKitName string    `json:"livekit_name"`
	FinishedAt  time.Time `json:"finished_at"`
}
