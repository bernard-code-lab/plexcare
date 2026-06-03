// Package ports define as interfaces que a camada de aplicação depende.
// Nada aqui conhece postgres, livekit SDK, kafka — são contratos puros.
package ports

import (
	"context"
	"time"

	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
)

// RoomRepository persiste e recupera salas.
type RoomRepository interface {
	Save(ctx context.Context, room *domain.Room) error
	FindByID(ctx context.Context, id string) (*domain.Room, error)
	FindByLiveKitName(ctx context.Context, name string) (*domain.Room, error)
	CountActiveByTenant(ctx context.Context, tenantID string) (int, error)
	ListByTenant(ctx context.Context, tenantID string, opts ListRoomsOptions) ([]*domain.Room, string, error)
	Update(ctx context.Context, room *domain.Room) error
}

// ListRoomsOptions é o filtro de paginação cursor-based.
// Cursor é opaco — encoding/decoding fica no adapter postgres.
type ListRoomsOptions struct {
	Limit  int    // tamanho da página (já normalizado pelo use case)
	Cursor string // opaco; vazio = primeira página
}

// LiveKitRoomClient gerencia salas no servidor LiveKit.
type LiveKitRoomClient interface {
	CreateRoom(ctx context.Context, name string, maxParticipants int, emptyTimeout time.Duration) error
	DeleteRoom(ctx context.Context, name string) error
}

// TokenGenerator emite JWT LiveKit com grants corretos por role.
type TokenGenerator interface {
	ForHost(roomName, identity string, ttl time.Duration) (string, error)
	ForGuest(roomName, identity string, ttl time.Duration) (string, error)
	ForObserver(roomName, identity string, ttl time.Duration) (string, error)
}

// EventPublisher publica eventos de domínio no Kafka.
type EventPublisher interface {
	Publish(ctx context.Context, topic string, key string, payload any) error
}
