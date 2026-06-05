package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"plexcare/platform/plexcare-teleconf-service/internal/room/application"
	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
	httpadapter "plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/http"
	"plexcare/platform/plexcare-teleconf-service/pkg/tenant"
)

// --- fakes --------------------------------------------------------------

type fakeCreateExecutor struct {
	out application.CreateRoomOutput
	err error
}

func (f *fakeCreateExecutor) Execute(_ context.Context, _ application.CreateRoomInput) (application.CreateRoomOutput, error) {
	return f.out, f.err
}

type fakeResolver struct {
	tc  tenant.Context
	err error
}

func (f *fakeResolver) Resolve(string) (tenant.Context, error) { return f.tc, f.err }

func defaultResolver() *fakeResolver {
	return &fakeResolver{tc: tenant.NewContext("t-1", "pro", 10, nil)}
}

func validBody() string {
	return `{
		"appointment_id": "appt-1",
		"host_identity":  "doctor_1",
		"guest_identity": "patient_1",
		"max_duration_min": 60,
		"max_participants": 4,
		"recording": false
	}`
}

// --- tests --------------------------------------------------------------

func TestCreateRoom_Validation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		body     string
		wantCode int
		wantErr  string
	}{
		{
			name:     "appointment_id obrigatório",
			body:     `{"host_identity":"d","guest_identity":"p","max_duration_min":60,"max_participants":4}`,
			wantCode: http.StatusBadRequest,
			wantErr:  "invalid_input",
		},
		{
			name:     "max_duration_min > 0",
			body:     `{"appointment_id":"a","host_identity":"d","guest_identity":"p","max_duration_min":0,"max_participants":4}`,
			wantCode: http.StatusBadRequest,
			wantErr:  "invalid_input",
		},
		{
			name:     "JSON malformado",
			body:     `{not-json`,
			wantCode: http.StatusBadRequest,
			wantErr:  "invalid_json",
		},
		{
			name:     "happy path retorna 201",
			body:     validBody(),
			wantCode: http.StatusCreated,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			exec := &fakeCreateExecutor{out: application.CreateRoomOutput{
				RoomID:      "r-1",
				LiveKitName: "room_r-1",
				HostToken:   "host.jwt",
				GuestToken:  "guest.jwt",
				ExpiresAt:   time.Now().Add(time.Hour),
			}}
			rr := serve(t, exec, defaultResolver(), tc.body)

			if rr.Code != tc.wantCode {
				t.Fatalf("code = %d, want %d body=%s", rr.Code, tc.wantCode, rr.Body.String())
			}
			if tc.wantErr != "" {
				var e map[string]string
				_ = json.Unmarshal(rr.Body.Bytes(), &e)
				if e["code"] != tc.wantErr {
					t.Errorf("err code = %q, want %q", e["code"], tc.wantErr)
				}
			}
		})
	}
}

func TestCreateRoom_PlanLimit(t *testing.T) {
	t.Parallel()

	exec := &fakeCreateExecutor{err: domain.ErrPlanLimitReached}
	rr := serve(t, exec, defaultResolver(), validBody())

	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("code = %d, want 429", rr.Code)
	}
}

func TestCreateRoom_MissingTenant(t *testing.T) {
	t.Parallel()

	r := chi.NewRouter()
	r.Use(httpadapter.TenantMiddleware(defaultResolver()))
	r.Post("/rooms", httpadapter.CreateRoom(&fakeCreateExecutor{}))

	req := httptest.NewRequest(http.MethodPost, "/rooms", strings.NewReader(validBody()))
	// sem X-Tenant-Id
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", rr.Code)
	}
}

func TestCreateRoom_InternalError(t *testing.T) {
	t.Parallel()

	exec := &fakeCreateExecutor{err: errors.New("kaboom")}
	rr := serve(t, exec, defaultResolver(), validBody())

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("code = %d, want 500", rr.Code)
	}
}

// --- ListRooms --------------------------------------------------------------

type fakeListExecutor struct {
	gotInput application.ListRoomsInput
	out      application.ListRoomsOutput
	err      error
}

func (f *fakeListExecutor) Execute(_ context.Context, in application.ListRoomsInput) (application.ListRoomsOutput, error) {
	f.gotInput = in
	return f.out, f.err
}

func TestListRooms_QueryParsing(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		url        string
		wantLimit  int
		wantCursor string
		wantCode   int
	}{
		{name: "sem query → limit 0 (use case normaliza)", url: "/rooms", wantLimit: 0, wantCode: http.StatusOK},
		{name: "limit numérico", url: "/rooms?limit=25", wantLimit: 25, wantCode: http.StatusOK},
		{name: "limit não-numérico → 400", url: "/rooms?limit=abc", wantCode: http.StatusBadRequest},
		{name: "cursor é propagado", url: "/rooms?cursor=opaque-xyz", wantCursor: "opaque-xyz", wantCode: http.StatusOK},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			exec := &fakeListExecutor{}
			rr := serveList(t, exec, defaultResolver(), tc.url)

			if rr.Code != tc.wantCode {
				t.Fatalf("code = %d, want %d, body=%s", rr.Code, tc.wantCode, rr.Body.String())
			}
			if tc.wantCode != http.StatusOK {
				return
			}
			if exec.gotInput.Limit != tc.wantLimit {
				t.Errorf("limit = %d, want %d", exec.gotInput.Limit, tc.wantLimit)
			}
			if exec.gotInput.Cursor != tc.wantCursor {
				t.Errorf("cursor = %q, want %q", exec.gotInput.Cursor, tc.wantCursor)
			}
		})
	}
}

func TestListRooms_HappyPath(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 3, 10, 0, 0, 0, time.UTC)
	exec := &fakeListExecutor{out: application.ListRoomsOutput{
		Rooms: []*domain.Room{
			{ID: "r-1", TenantID: "t-1", AppointmentID: "ap-1", LiveKitName: "room_r-1", Status: domain.RoomStatusFinished, CreatedAt: now, MaxDuration: 60 * time.Minute, Features: domain.RoomFeatures{MaxParticipants: 4}},
		},
		NextCursor: "next-cur",
	}}
	rr := serveList(t, exec, defaultResolver(), "/rooms?limit=10")

	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, body=%s", rr.Code, rr.Body.String())
	}
	var body struct {
		Rooms []struct {
			ID            string    `json:"id"`
			TenantID      string    `json:"tenant_id"`
			AppointmentID string    `json:"appointment_id"`
			LiveKitName   string    `json:"livekit_name"`
			Status        string    `json:"status"`
			CreatedAt     time.Time `json:"created_at"`
		} `json:"rooms"`
		NextCursor string `json:"next_cursor"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(body.Rooms) != 1 || body.Rooms[0].ID != "r-1" || body.Rooms[0].Status != "finished" {
		t.Errorf("rooms = %+v", body.Rooms)
	}
	if body.NextCursor != "next-cur" {
		t.Errorf("next_cursor = %q, want next-cur", body.NextCursor)
	}
}

func TestListRooms_MissingTenantContext(t *testing.T) {
	t.Parallel()

	// Use case retorna ErrMissingTenantContext quando middleware não rodou.
	exec := &fakeListExecutor{err: application.ErrMissingTenantContext}
	rr := serveList(t, exec, defaultResolver(), "/rooms")

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", rr.Code)
	}
}

func TestListRooms_InternalError(t *testing.T) {
	t.Parallel()

	exec := &fakeListExecutor{err: errors.New("boom")}
	rr := serveList(t, exec, defaultResolver(), "/rooms")

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("code = %d, want 500", rr.Code)
	}
}

func serveList(t *testing.T, exec httpadapter.ListRoomsExecutor, res httpadapter.TenantResolver, url string) *httptest.ResponseRecorder {
	t.Helper()
	r := chi.NewRouter()
	r.Use(httpadapter.TenantMiddleware(res))
	r.Get("/rooms", httpadapter.ListRooms(exec))

	req := httptest.NewRequest(http.MethodGet, url, nil)
	req.Header.Set(httpadapter.HeaderTenantID, "t-1")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func serve(t *testing.T, exec httpadapter.CreateRoomExecutor, res httpadapter.TenantResolver, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := chi.NewRouter()
	r.Use(httpadapter.TenantMiddleware(res))
	r.Post("/rooms", httpadapter.CreateRoom(exec))

	req := httptest.NewRequest(http.MethodPost, "/rooms", bytes.NewBufferString(body))
	req.Header.Set(httpadapter.HeaderTenantID, "t-1")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}
