//go:build integration

package livekit_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"plexcare/platform/plexcare-teleconf/internal/room/infrastructure/livekit"
)

// Pre-req: docker compose -f docker-compose.dev.yml up -d livekit
// Run:     go test -tags=integration ./internal/room/infrastructure/livekit/...

func TestLiveKitClient_CreateAndDeleteRoom(t *testing.T) {
	url := envOrDefault("LIVEKIT_HTTP_URL", "http://localhost:7880")
	key := envOrDefault("LIVEKIT_API_KEY", "devkey")
	secret := envOrDefault("LIVEKIT_API_SECRET", "devsecret123456devsecret123456ab")

	c := livekit.NewClient(url, key, secret)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	name := fmt.Sprintf("itest_%d", time.Now().UnixNano())

	if err := c.CreateRoom(ctx, name, 4, 5*time.Minute); err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	t.Cleanup(func() {
		_ = c.DeleteRoom(context.Background(), name)
	})

	// Re-criar é idempotente (LiveKit retorna sala existente, não erro).
	if err := c.CreateRoom(ctx, name, 4, 5*time.Minute); err != nil {
		t.Fatalf("CreateRoom (idempotência): %v", err)
	}

	if err := c.DeleteRoom(ctx, name); err != nil {
		t.Fatalf("DeleteRoom: %v", err)
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
