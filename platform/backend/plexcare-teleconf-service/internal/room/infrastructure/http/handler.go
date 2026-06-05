package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"plexcare/platform/plexcare-teleconf-service/internal/room/application"
	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
)

// CreateRoomExecutor é a porta de entrada (driving port) do use case.
// Definido aqui para permitir mock no teste HTTP sem importar nada de domain.
type CreateRoomExecutor interface {
	Execute(ctx context.Context, in application.CreateRoomInput) (application.CreateRoomOutput, error)
}

type createRoomRequest struct {
	AppointmentID   string `json:"appointment_id"`
	HostIdentity    string `json:"host_identity"`
	GuestIdentity   string `json:"guest_identity"`
	MaxDurationMin  int    `json:"max_duration_min"`
	MaxParticipants int    `json:"max_participants"`
	Recording       bool   `json:"recording"`
}

type createRoomResponse struct {
	RoomID      string    `json:"room_id"`
	LiveKitName string    `json:"livekit_name"`
	HostToken   string    `json:"host_token"`
	GuestToken  string    `json:"guest_token"`
	ExpiresAt   time.Time `json:"expires_at"`
}

func CreateRoom(uc CreateRoomExecutor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createRoomRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
			return
		}
		if msg, ok := validateCreate(req); !ok {
			writeError(w, http.StatusBadRequest, "invalid_input", msg)
			return
		}

		out, err := uc.Execute(r.Context(), application.CreateRoomInput{
			AppointmentID: req.AppointmentID,
			HostIdentity:  req.HostIdentity,
			GuestIdentity: req.GuestIdentity,
			MaxDuration:   time.Duration(req.MaxDurationMin) * time.Minute,
			Features: domain.RoomFeatures{
				Recording:       req.Recording,
				MaxParticipants: req.MaxParticipants,
			},
		})
		if err != nil {
			handleUseCaseError(w, err)
			return
		}

		writeJSON(w, http.StatusCreated, createRoomResponse{
			RoomID:      out.RoomID,
			LiveKitName: out.LiveKitName,
			HostToken:   out.HostToken,
			GuestToken:  out.GuestToken,
			ExpiresAt:   out.ExpiresAt,
		})
	}
}

// ListRoomsExecutor é a porta de entrada do use case de listagem.
type ListRoomsExecutor interface {
	Execute(ctx context.Context, in application.ListRoomsInput) (application.ListRoomsOutput, error)
}

type roomDTO struct {
	ID              string     `json:"id"`
	TenantID        string     `json:"tenant_id"`
	AppointmentID   string     `json:"appointment_id"`
	LiveKitName     string     `json:"livekit_name"`
	Status          string     `json:"status"`
	MaxDurationMin  int        `json:"max_duration_min"`
	MaxParticipants int        `json:"max_participants"`
	Recording       bool       `json:"recording"`
	CreatedAt       time.Time  `json:"created_at"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	FinishedAt      *time.Time `json:"finished_at,omitempty"`
}

type listRoomsResponse struct {
	Rooms      []roomDTO `json:"rooms"`
	NextCursor string    `json:"next_cursor,omitempty"`
}

func ListRooms(uc ListRoomsExecutor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		limit := 0
		if raw := q.Get("limit"); raw != "" {
			n, err := strconv.Atoi(raw)
			if err != nil {
				writeError(w, http.StatusBadRequest, "invalid_input", "limit must be integer")
				return
			}
			limit = n
		}

		out, err := uc.Execute(r.Context(), application.ListRoomsInput{
			Limit:  limit,
			Cursor: q.Get("cursor"),
		})
		if err != nil {
			handleUseCaseError(w, err)
			return
		}

		resp := listRoomsResponse{
			Rooms:      make([]roomDTO, 0, len(out.Rooms)),
			NextCursor: out.NextCursor,
		}
		for _, room := range out.Rooms {
			resp.Rooms = append(resp.Rooms, roomDTO{
				ID:              room.ID,
				TenantID:        room.TenantID,
				AppointmentID:   room.AppointmentID,
				LiveKitName:     room.LiveKitName,
				Status:          string(room.Status),
				MaxDurationMin:  int(room.MaxDuration.Minutes()),
				MaxParticipants: room.Features.MaxParticipants,
				Recording:       room.Features.Recording,
				CreatedAt:       room.CreatedAt,
				StartedAt:       room.StartedAt,
				FinishedAt:      room.FinishedAt,
			})
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

type DeleteRoomExecutor interface {
	DeleteByLiveKitName(ctx context.Context, livekitName string) error
}

func DeleteRoom(uc DeleteRoomExecutor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := chi.URLParam(r, "name")
		if name == "" {
			writeError(w, http.StatusBadRequest, "invalid_input", "missing room name")
			return
		}
		if err := uc.DeleteByLiveKitName(r.Context(), name); err != nil {
			handleUseCaseError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func validateCreate(r createRoomRequest) (string, bool) {
	switch {
	case r.AppointmentID == "":
		return "appointment_id required", false
	case r.HostIdentity == "":
		return "host_identity required", false
	case r.GuestIdentity == "":
		return "guest_identity required", false
	case r.MaxDurationMin <= 0:
		return "max_duration_min must be > 0", false
	case r.MaxParticipants <= 0:
		return "max_participants must be > 0", false
	}
	return "", true
}

func handleUseCaseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, application.ErrMissingTenantContext):
		writeError(w, http.StatusUnauthorized, "missing_tenant", err.Error())
	case errors.Is(err, domain.ErrPlanLimitReached):
		writeError(w, http.StatusTooManyRequests, "plan_limit_reached", err.Error())
	case errors.Is(err, domain.ErrRoomNotFound):
		writeError(w, http.StatusNotFound, "room_not_found", err.Error())
	case errors.Is(err, domain.ErrRoomAlreadyEnded):
		writeError(w, http.StatusConflict, "room_already_ended", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, errorBody{Code: code, Message: msg})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
