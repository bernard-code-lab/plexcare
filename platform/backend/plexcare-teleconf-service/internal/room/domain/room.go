package domain

import (
	"errors"
	"time"
)

type RoomStatus string

const (
	RoomStatusPending  RoomStatus = "pending"
	RoomStatusActive   RoomStatus = "active"
	RoomStatusFinished RoomStatus = "finished"
	RoomStatusExpired  RoomStatus = "expired"
)

type ParticipantRole string

const (
	RoleHost     ParticipantRole = "host"
	RoleGuest    ParticipantRole = "guest"
	RoleObserver ParticipantRole = "observer"
)

type RoomFeatures struct {
	Recording       bool
	Transcription   bool
	MaxParticipants int
}

type Room struct {
	ID            string
	TenantID      string
	AppointmentID string
	LiveKitName   string
	Status        RoomStatus
	MaxDuration   time.Duration
	Features      RoomFeatures
	CreatedAt     time.Time
	StartedAt     *time.Time
	FinishedAt    *time.Time
}

type Participant struct {
	ID       string
	RoomID   string
	TenantID string
	Role     ParticipantRole
	Identity string // e.g. "doctor_<uuid>" ou "patient_<uuid>"
}

var (
	ErrRoomNotFound     = errors.New("room not found")
	ErrRoomAlreadyEnded = errors.New("room already ended")
	ErrPlanLimitReached = errors.New("plan limit reached for active rooms")
)

func (r *Room) IsJoinable() bool {
	return r.Status == RoomStatusPending || r.Status == RoomStatusActive
}

// ActiveRooms é o agregado de negócio para checar limite do plano.
// O uso real vem do TenantContext injetado pelo middleware.
func (r *Room) Finish(at time.Time) error {
	if r.Status == RoomStatusFinished {
		return ErrRoomAlreadyEnded
	}
	r.Status = RoomStatusFinished
	r.FinishedAt = &at
	return nil
}
