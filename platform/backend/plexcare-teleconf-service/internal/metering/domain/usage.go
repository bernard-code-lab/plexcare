package domain

import (
	"errors"
	"math"
	"time"
)

// ParticipantSession representa uma janela de presença de um participante na sala.
// Cada entrada (join) abre uma sessão; cada saída (leave) fecha e calcula a duração.
type ParticipantSession struct {
	ID              string
	RoomID          string
	TenantID        string
	ParticipantID   string
	ParticipantRole string
	JoinedAt        time.Time
	LeftAt          *time.Time
}

// Duration retorna 0 se a sessão ainda está aberta.
func (s *ParticipantSession) Duration() time.Duration {
	if s.LeftAt == nil {
		return 0
	}
	return s.LeftAt.Sub(s.JoinedAt)
}

// BillableMinutes arredonda para cima (ex: 1m30s → 2 min).
// Padrão da indústria para billing por minuto.
func (s *ParticipantSession) BillableMinutes() int {
	return int(math.Ceil(s.Duration().Minutes()))
}

func (s *ParticipantSession) Close(at time.Time) error {
	if s.LeftAt != nil {
		return ErrSessionAlreadyClosed
	}
	s.LeftAt = &at
	return nil
}

// MonthlyUsage é o agregado de consumo por tenant/período.
// Calculado pelo AggregateUseCase e persistido para o Billing Service ler.
type MonthlyUsage struct {
	TenantID     string
	Period       string // "2026-06" (YYYY-MM)
	TotalMinutes int
	TotalRooms   int
	UpdatedAt    time.Time
}

var (
	ErrSessionNotFound    = errors.New("participant session not found")
	ErrSessionAlreadyClosed = errors.New("participant session already closed")
)
