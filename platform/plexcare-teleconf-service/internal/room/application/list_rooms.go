package application

import (
	"context"
	"errors"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"

	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
	"plexcare/platform/plexcare-teleconf-service/internal/room/ports"
	"plexcare/platform/plexcare-teleconf-service/pkg/tenant"
)

var listTracer = otel.Tracer("room-service/list-rooms")

const (
	defaultListLimit = 20
	maxListLimit     = 100
)

// ErrMissingTenantContext é retornado quando o use case roda sem tenant injetado.
// Tipado para o handler HTTP poder mapear para 401/403 explicitamente.
var ErrMissingTenantContext = errors.New("missing tenant context")

// ListRoomsInput é o contrato de entrada. Cursor é opaco.
type ListRoomsInput struct {
	Limit  int
	Cursor string
}

// ListRoomsOutput devolve as salas + cursor para próxima página (vazio se última).
type ListRoomsOutput struct {
	Rooms      []*domain.Room
	NextCursor string
}

type roomLister interface {
	ListByTenant(ctx context.Context, tenantID string, opts ports.ListRoomsOptions) ([]*domain.Room, string, error)
}

type ListRoomsUseCase struct {
	repo roomLister
}

func NewListRoomsUseCase(repo roomLister) *ListRoomsUseCase {
	return &ListRoomsUseCase{repo: repo}
}

func (uc *ListRoomsUseCase) Execute(ctx context.Context, in ListRoomsInput) (ListRoomsOutput, error) {
	ctx, span := listTracer.Start(ctx, "ListRooms")
	defer span.End()

	tc, ok := tenant.FromContext(ctx)
	if !ok {
		return ListRoomsOutput{}, ErrMissingTenantContext
	}

	limit := normalizeLimit(in.Limit)
	span.SetAttributes(
		attribute.String("tenant.id", tc.ID),
		attribute.Int("list.limit", limit),
	)

	rooms, next, err := uc.repo.ListByTenant(ctx, tc.ID, ports.ListRoomsOptions{
		Limit:  limit,
		Cursor: in.Cursor,
	})
	if err != nil {
		return ListRoomsOutput{}, fmt.Errorf("listing rooms: %w", err)
	}
	return ListRoomsOutput{Rooms: rooms, NextCursor: next}, nil
}

func normalizeLimit(n int) int {
	if n <= 0 {
		return defaultListLimit
	}
	if n > maxListLimit {
		return maxListLimit
	}
	return n
}
