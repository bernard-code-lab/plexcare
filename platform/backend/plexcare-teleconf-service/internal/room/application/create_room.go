package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
	"plexcare/platform/plexcare-teleconf-service/internal/room/ports"
	"plexcare/platform/plexcare-teleconf-service/pkg/tenant"
)

var tracer = otel.Tracer("room-service/create-room")

// CreateRoomInput é o contrato de entrada do caso de uso.
// Validação de formato (IDs não-vazios, MaxDuration > 0) pertence ao handler HTTP,
// não aqui — application layer assume input sanitizado.
type CreateRoomInput struct {
	AppointmentID   string
	HostIdentity    string        // "doctor_<uuid>" — identidade no LiveKit
	GuestIdentity   string        // "patient_<uuid>"
	MaxDuration     time.Duration // duração máxima da sala (ex: 60min)
	Features        domain.RoomFeatures
}

type CreateRoomOutput struct {
	RoomID      string
	LiveKitName string
	HostToken   string
	GuestToken  string
	ExpiresAt   time.Time
}

type CreateRoomUseCase struct {
	repo      ports.RoomRepository
	livekit   ports.LiveKitRoomClient
	tokens    ports.TokenGenerator
	publisher ports.EventPublisher
	log       *zap.Logger
}

func NewCreateRoomUseCase(
	repo ports.RoomRepository,
	lk ports.LiveKitRoomClient,
	tokens ports.TokenGenerator,
	publisher ports.EventPublisher,
	log *zap.Logger,
) *CreateRoomUseCase {
	return &CreateRoomUseCase{repo: repo, livekit: lk, tokens: tokens, publisher: publisher, log: log}
}

func (uc *CreateRoomUseCase) Execute(ctx context.Context, input CreateRoomInput) (CreateRoomOutput, error) {
	ctx, span := tracer.Start(ctx, "CreateRoom")
	defer span.End()

	tc, ok := tenant.FromContext(ctx)
	if !ok {
		return CreateRoomOutput{}, fmt.Errorf("missing tenant context")
	}

	span.SetAttributes(
		attribute.String("tenant.id", tc.ID),
		attribute.String("tenant.plan", tc.Plan),
		attribute.String("appointment.id", input.AppointmentID),
	)

	// Checa limite do plano antes de criar qualquer recurso.
	active, err := uc.repo.CountActiveByTenant(ctx, tc.ID)
	if err != nil {
		return CreateRoomOutput{}, fmt.Errorf("checking active rooms: %w", err)
	}
	if active >= tc.MaxConcurrentRooms {
		return CreateRoomOutput{}, domain.ErrPlanLimitReached
	}

	roomID := uuid.New().String()
	livekitName := fmt.Sprintf("room_%s", roomID)

	// Buffer de 15min além da duração para tokens não expirarem cedo.
	tokenTTL := input.MaxDuration + 15*time.Minute

	// Cria sala no LiveKit — emptyTimeout garante cleanup automático se ninguém entrar.
	if err := uc.livekit.CreateRoom(ctx, livekitName, input.Features.MaxParticipants, 5*time.Minute); err != nil {
		span.SetStatus(codes.Error, "livekit.CreateRoom failed")
		return CreateRoomOutput{}, fmt.Errorf("creating livekit room: %w", err)
	}

	hostToken, err := uc.tokens.ForHost(livekitName, input.HostIdentity, tokenTTL)
	if err != nil {
		return CreateRoomOutput{}, fmt.Errorf("generating host token: %w", err)
	}

	guestToken, err := uc.tokens.ForGuest(livekitName, input.GuestIdentity, tokenTTL)
	if err != nil {
		return CreateRoomOutput{}, fmt.Errorf("generating guest token: %w", err)
	}

	now := time.Now().UTC()
	room := &domain.Room{
		ID:            roomID,
		TenantID:      tc.ID,
		AppointmentID: input.AppointmentID,
		LiveKitName:   livekitName,
		Status:        domain.RoomStatusPending,
		MaxDuration:   input.MaxDuration,
		Features:      input.Features,
		CreatedAt:     now,
	}

	if err := uc.repo.Save(ctx, room); err != nil {
		span.SetStatus(codes.Error, "repo.Save failed")
		return CreateRoomOutput{}, fmt.Errorf("saving room: %w", err)
	}

	// Kafka publish é best-effort: o room já existe no DB.
	// O billing pode reconciliar via cron se o evento não chegar.
	if err := uc.publisher.Publish(ctx, "room.events", roomID, roomCreatedEvent{
		RoomID:        roomID,
		TenantID:      tc.ID,
		AppointmentID: input.AppointmentID,
		LiveKitName:   livekitName,
		CreatedAt:     now,
	}); err != nil {
		uc.log.Warn("failed to publish room.created event",
			zap.String("room_id", roomID),
			zap.Error(err),
		)
	}

	span.SetAttributes(attribute.String("room.id", roomID))

	return CreateRoomOutput{
		RoomID:      roomID,
		LiveKitName: livekitName,
		HostToken:   hostToken,
		GuestToken:  guestToken,
		ExpiresAt:   now.Add(tokenTTL),
	}, nil
}

type roomCreatedEvent struct {
	RoomID        string    `json:"room_id"`
	TenantID      string    `json:"tenant_id"`
	AppointmentID string    `json:"appointment_id"`
	LiveKitName   string    `json:"livekit_name"`
	CreatedAt     time.Time `json:"created_at"`
}
