package livekit_test

import (
	"strings"
	"testing"
	"time"

	lkauth "github.com/livekit/protocol/auth"

	"plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/livekit"
)

const (
	testAPIKey    = "devkey"
	testAPISecret = "devsecret123456devsecret123456ab" // ≥32 bytes para HMAC-SHA256
)

func TestTokenGenerator_ForHost(t *testing.T) {
	t.Parallel()

	gen := livekit.NewTokenGenerator(testAPIKey, testAPISecret)

	tok, err := gen.ForHost("room_abc", "doctor_1", 1*time.Hour)
	if err != nil {
		t.Fatalf("ForHost: %v", err)
	}
	if tok == "" {
		t.Fatal("empty token")
	}

	grant := decodeGrant(t, tok)
	if grant.Room != "room_abc" {
		t.Errorf("Room = %q, want room_abc", grant.Room)
	}
	if !grant.RoomJoin {
		t.Error("RoomJoin = false, want true")
	}
	if grant.CanPublish == nil || !*grant.CanPublish {
		t.Error("CanPublish = false/nil, want true (host publica vídeo/áudio)")
	}
	if grant.CanSubscribe == nil || !*grant.CanSubscribe {
		t.Error("CanSubscribe = false/nil, want true")
	}
}

func TestTokenGenerator_ForGuest(t *testing.T) {
	t.Parallel()

	gen := livekit.NewTokenGenerator(testAPIKey, testAPISecret)

	tok, err := gen.ForGuest("room_abc", "patient_1", 30*time.Minute)
	if err != nil {
		t.Fatalf("ForGuest: %v", err)
	}

	grant := decodeGrant(t, tok)
	if !grant.RoomJoin {
		t.Error("RoomJoin = false, want true")
	}
	if grant.CanPublish == nil || !*grant.CanPublish {
		t.Error("guest também publica (paciente fala/aparece)")
	}
}

func TestTokenGenerator_ForObserver(t *testing.T) {
	t.Parallel()

	gen := livekit.NewTokenGenerator(testAPIKey, testAPISecret)

	tok, err := gen.ForObserver("room_abc", "auditor_1", 1*time.Hour)
	if err != nil {
		t.Fatalf("ForObserver: %v", err)
	}

	grant := decodeGrant(t, tok)
	if grant.CanPublish != nil && *grant.CanPublish {
		t.Error("observer NÃO publica (só assiste)")
	}
	if grant.CanSubscribe == nil || !*grant.CanSubscribe {
		t.Error("observer assina")
	}
	if !grant.Hidden {
		t.Error("observer fica oculto da lista de participantes")
	}
}

func TestTokenGenerator_ErrorOnEmptySecret(t *testing.T) {
	t.Parallel()

	gen := livekit.NewTokenGenerator(testAPIKey, "")
	if _, err := gen.ForHost("r", "i", time.Hour); err == nil {
		t.Error("expected error with empty secret")
	}
}

// decodeGrant decodifica o JWT usando a chave de teste e devolve o VideoGrant.
func decodeGrant(t *testing.T, raw string) *lkauth.VideoGrant {
	t.Helper()

	parts := strings.Split(raw, ".")
	if len(parts) != 3 {
		t.Fatalf("JWT malformado: %d partes", len(parts))
	}

	verifier, err := lkauth.ParseAPIToken(raw)
	if err != nil {
		t.Fatalf("ParseAPIToken: %v", err)
	}
	_, grants, err := verifier.Verify(testAPISecret)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if grants == nil || grants.Video == nil {
		t.Fatal("grants.Video é nil")
	}
	return grants.Video
}
