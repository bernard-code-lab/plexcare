package domain_test

import (
	"errors"
	"testing"
	"time"

	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
)

func TestRoom_IsJoinable(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status domain.RoomStatus
		want   bool
	}{
		{"pending é joinable", domain.RoomStatusPending, true},
		{"active é joinable", domain.RoomStatusActive, true},
		{"finished não é joinable", domain.RoomStatusFinished, false},
		{"expired não é joinable", domain.RoomStatusExpired, false},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			r := &domain.Room{Status: tc.status}
			if got := r.IsJoinable(); got != tc.want {
				t.Errorf("IsJoinable() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestRoom_Finish(t *testing.T) {
	t.Parallel()

	finishedAt := time.Date(2026, 6, 3, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name        string
		initial     domain.RoomStatus
		wantErr     error
		wantStatus  domain.RoomStatus
		wantFinAtOK bool
	}{
		{
			name:        "sala active é finalizada",
			initial:     domain.RoomStatusActive,
			wantStatus:  domain.RoomStatusFinished,
			wantFinAtOK: true,
		},
		{
			name:        "sala pending também pode ser finalizada (timeout antes do uso)",
			initial:     domain.RoomStatusPending,
			wantStatus:  domain.RoomStatusFinished,
			wantFinAtOK: true,
		},
		{
			name:    "sala já finalizada retorna ErrRoomAlreadyEnded (idempotência)",
			initial: domain.RoomStatusFinished,
			wantErr: domain.ErrRoomAlreadyEnded,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			r := &domain.Room{Status: tc.initial}
			err := r.Finish(finishedAt)

			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
			if tc.wantErr != nil {
				return
			}
			if r.Status != tc.wantStatus {
				t.Errorf("Status = %v, want %v", r.Status, tc.wantStatus)
			}
			if tc.wantFinAtOK {
				if r.FinishedAt == nil || !r.FinishedAt.Equal(finishedAt) {
					t.Errorf("FinishedAt = %v, want %v", r.FinishedAt, finishedAt)
				}
			}
		})
	}
}
