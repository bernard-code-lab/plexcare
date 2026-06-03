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

	"plexcare/platform/plexcare-teleconf/internal/room/application"
	"plexcare/platform/plexcare-teleconf/internal/room/domain"
	httpadapter "plexcare/platform/plexcare-teleconf/internal/room/infrastructure/http"
	"plexcare/platform/plexcare-teleconf/pkg/tenant"
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
