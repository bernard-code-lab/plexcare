package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
	"plexcare/platform/plexcare-teleconf-service/internal/room/ports"
)

var finishTracer = otel.Tracer("room-service/finish-room")

// FinishRoomUseCase é acionado pelo Webhook Handler quando o LiveKit
// emite "room_finished". Fecha o ciclo de vida da sala no DB.
// Idempotente: receber o evento duplicado não é erro fatal.
type FinishRoomUseCase struct {
	repo      ports.RoomRepository
	publisher ports.EventPublisher
	log       *zap.Logger
}

func NewFinishRoomUseCase(repo ports.RoomRepository, publisher ports.EventPublisher, log *zap.Logger) *FinishRoomUseCase {
	return &FinishRoomUseCase{repo: repo, publisher: publisher, log: log}
}

type FinishRoomInput struct {
	LiveKitRoomName string
	FinishedAt      time.Time
}

func (uc *FinishRoomUseCase) Execute(ctx context.Context, input FinishRoomInput) error {
	ctx, span := finishTracer.Start(ctx, "FinishRoom")
	defer span.End()

	span.SetAttributes(attribute.String("livekit.room", input.LiveKitRoomName))

	room, err := uc.repo.FindByLiveKitName(ctx, input.LiveKitRoomName)
	if err != nil {
		if errors.Is(err, domain.ErrRoomNotFound) {
			// Webhook pode chegar para salas criadas fora do nosso fluxo (testes manuais).
			uc.log.Info("room not found for webhook, ignoring",
				zap.String("livekit_name", input.LiveKitRoomName),
			)
			return nil
		}
		return fmt.Errorf("finding room by livekit name: %w", err)
	}

	if err := room.Finish(input.FinishedAt); err != nil {
		if errors.Is(err, domain.ErrRoomAlreadyEnded) {
			uc.log.Info("room already finished, skipping",
				zap.String("livekit_name", input.LiveKitRoomName),
			)
			return nil
		}
		return fmt.Errorf("finishing room: %w", err)
	}

	if err := uc.repo.Update(ctx, room); err != nil {
		return fmt.Errorf("updating room: %w", err)
	}

	// Publish é best-effort — sala já está fechada no DB. Billing reconcilia via cron.
	if err := uc.publisher.Publish(ctx, "room.events", input.LiveKitRoomName, roomFinishedEvent{
		Type:        "room_finished",
		LiveKitName: input.LiveKitRoomName,
		RoomID:      room.ID,
		TenantID:    room.TenantID,
		FinishedAt:  input.FinishedAt,
	}); err != nil {
		uc.log.Warn("failed to publish room.finished event",
			zap.String("room_id", room.ID),
			zap.Error(err),
		)
	}

	return nil
}

type roomFinishedEvent struct {
	Type        string    `json:"type"`
	LiveKitName string    `json:"livekit_name"`
	RoomID      string    `json:"room_id"`
	TenantID    string    `json:"tenant_id"`
	FinishedAt  time.Time `json:"finished_at"`
}
