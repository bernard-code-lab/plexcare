package livekit_test

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	lkauth "github.com/livekit/protocol/auth"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/livekit"
)

type recorderBus struct {
	mu               sync.Mutex
	finished         []string
	joined           []string
	left             []string
	forceErrFinished error
}

func (r *recorderBus) OnRoomFinished(_ context.Context, name string, _ time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.finished = append(r.finished, name)
	return r.forceErrFinished
}
func (r *recorderBus) OnParticipantJoined(_ context.Context, room, pid, _ string, _ time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.joined = append(r.joined, room+"/"+pid)
	return nil
}
func (r *recorderBus) OnParticipantLeft(_ context.Context, room, pid, _ string, _ time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.left = append(r.left, room+"/"+pid)
	return nil
}

func TestWebhookHandler_AcceptsValidSignature(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		event      string
		identity   string
		assertSink func(t *testing.T, b *recorderBus)
	}{
		{
			name:  "room_finished registra sala fechada",
			event: "room_finished",
			assertSink: func(t *testing.T, b *recorderBus) {
				if len(b.finished) != 1 || b.finished[0] != "room_x" {
					t.Errorf("finished = %v", b.finished)
				}
			},
		},
		{
			name:     "participant_joined registra entrada",
			event:    "participant_joined",
			identity: "doctor_1",
			assertSink: func(t *testing.T, b *recorderBus) {
				if len(b.joined) != 1 || !strings.HasSuffix(b.joined[0], "/doctor_1") {
					t.Errorf("joined = %v", b.joined)
				}
			},
		},
		{
			name:     "participant_left registra saída",
			event:    "participant_left",
			identity: "patient_1",
			assertSink: func(t *testing.T, b *recorderBus) {
				if len(b.left) != 1 {
					t.Errorf("left = %v", b.left)
				}
			},
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			bus := &recorderBus{}
			h := livekit.NewWebhookHandler(testAPIKey, testAPISecret, bus, zap.NewNop())

			body := mustWebhookBody(t, tc.event, "room_x", tc.identity)
			req := signedRequest(t, body, testAPIKey, testAPISecret)

			rr := httptest.NewRecorder()
			h.ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("code = %d, want 200", rr.Code)
			}
			tc.assertSink(t, bus)
		})
	}
}

func TestWebhookHandler_RejectsInvalidSignature(t *testing.T) {
	t.Parallel()

	bus := &recorderBus{}
	h := livekit.NewWebhookHandler(testAPIKey, testAPISecret, bus, zap.NewNop())

	body := mustWebhookBody(t, "room_finished", "r", "")
	req := signedRequest(t, body, testAPIKey, "wrong-secret-wrong-secret-wrong-ab")

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", rr.Code)
	}
}

func mustWebhookBody(t *testing.T, event, roomName, participantIdentity string) []byte {
	t.Helper()
	payload := map[string]any{
		"event":      event,
		"room":       map[string]any{"name": roomName},
		"createdAt":  time.Now().Unix(),
	}
	if participantIdentity != "" {
		payload["participant"] = map[string]any{"identity": participantIdentity}
	}
	b, _ := json.Marshal(payload)
	return b
}

func signedRequest(t *testing.T, body []byte, apiKey, apiSecret string) *http.Request {
	t.Helper()

	sum := sha256.Sum256(body)
	hash := base64.StdEncoding.EncodeToString(sum[:])

	tok := lkauth.NewAccessToken(apiKey, apiSecret).
		SetValidFor(time.Hour).
		SetSha256(hash)
	jwt, err := tok.ToJWT()
	if err != nil {
		t.Fatalf("ToJWT: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/webhooks/livekit",
		strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/webhook+json")
	req.Header.Set("Authorization", jwt)
	return req
}
