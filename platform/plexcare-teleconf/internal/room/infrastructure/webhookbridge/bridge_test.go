package webhookbridge

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf/internal/room/application"
	"plexcare/platform/plexcare-teleconf/internal/room/domain"
)

type capturedPublish struct {
	topic   string
	key     string
	payload ParticipantEvent
}

type fakePublisher struct {
	calls []capturedPublish
	err   error
}

func (f *fakePublisher) Publish(_ context.Context, topic, key string, payload any) error {
	pe, _ := payload.(ParticipantEvent)
	f.calls = append(f.calls, capturedPublish{topic: topic, key: key, payload: pe})
	return f.err
}

type fakeRoomFinder struct {
	room *domain.Room
	err  error
}

func (f *fakeRoomFinder) FindByLiveKitName(_ context.Context, _ string) (*domain.Room, error) {
	return f.room, f.err
}

type noopFinish struct{}

func (noopFinish) Execute(_ context.Context, _ application.FinishRoomInput) error { return nil }

// O bug: o Bridge publicava room_id = nome LiveKit ("room_<uuid>") e tenant_id = "",
// e o usage-metering rejeitava no INSERT (room_id/tenant_id são UUID NOT NULL).
// Fix escolhido: o Bridge resolve livekit_name -> (room UUID, tenant UUID) antes de publicar.
func TestBridge_ParticipantEventsPublishResolvedUUIDs(t *testing.T) {
	const (
		livekitName = "room_382f878e-9058-4208-bfaa-96fce832596f"
		roomUUID    = "382f878e-9058-4208-bfaa-96fce832596f"
		tenantUUID  = "8b6c1e33-1c57-4f85-a8fa-1025451490a4"
	)
	at := time.Date(2026, 6, 3, 2, 22, 0, 0, time.UTC)

	tests := []struct {
		name     string
		call     func(b *Bridge) error
		wantType string
		wantPID  string
		wantRole string
	}{
		{
			name: "participant_joined resolve room e tenant",
			call: func(b *Bridge) error {
				return b.OnParticipantJoined(context.Background(), livekitName, "doctor_64287f4c", "doctor", at)
			},
			wantType: "participant_joined",
			wantPID:  "doctor_64287f4c",
			wantRole: "doctor",
		},
		{
			name: "participant_left resolve room e tenant",
			call: func(b *Bridge) error {
				return b.OnParticipantLeft(context.Background(), livekitName, "patient_74d5fb30", "patient", at)
			},
			wantType: "participant_left",
			wantPID:  "patient_74d5fb30",
			wantRole: "patient",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pub := &fakePublisher{}
			finder := &fakeRoomFinder{room: &domain.Room{ID: roomUUID, TenantID: tenantUUID, LiveKitName: livekitName}}
			b := New(noopFinish{}, pub, finder, zap.NewNop())

			if err := tc.call(b); err != nil {
				t.Fatalf("call returned error: %v", err)
			}
			if len(pub.calls) != 1 {
				t.Fatalf("esperava 1 publish, veio %d", len(pub.calls))
			}
			got := pub.calls[0]
			if got.topic != "room.events" {
				t.Errorf("topic = %q, quero room.events", got.topic)
			}
			if got.payload.Type != tc.wantType {
				t.Errorf("Type = %q, quero %q", got.payload.Type, tc.wantType)
			}
			if got.payload.RoomID != roomUUID {
				t.Errorf("RoomID = %q, quero o UUID interno %q (não o nome LiveKit)", got.payload.RoomID, roomUUID)
			}
			if got.payload.TenantID != tenantUUID {
				t.Errorf("TenantID = %q, quero %q (não vazio)", got.payload.TenantID, tenantUUID)
			}
			if got.payload.ParticipantID != tc.wantPID {
				t.Errorf("ParticipantID = %q, quero %q", got.payload.ParticipantID, tc.wantPID)
			}
			if got.payload.ParticipantRole != tc.wantRole {
				t.Errorf("ParticipantRole = %q, quero %q", got.payload.ParticipantRole, tc.wantRole)
			}
			if !got.payload.OccurredAt.Equal(at) {
				t.Errorf("OccurredAt = %v, quero %v", got.payload.OccurredAt, at)
			}
		})
	}
}

func TestBridge_ParticipantJoinedSkipsPublishWhenRoomUnresolved(t *testing.T) {
	pub := &fakePublisher{}
	finder := &fakeRoomFinder{err: errors.New("room not found")}
	b := New(noopFinish{}, pub, finder, zap.NewNop())

	err := b.OnParticipantJoined(context.Background(), "room_unknown", "doctor_x", "doctor", time.Now())
	if err == nil {
		t.Fatal("esperava erro quando o room não resolve")
	}
	if len(pub.calls) != 0 {
		t.Fatalf("não devia publicar evento com room não resolvido, veio %d", len(pub.calls))
	}
}
