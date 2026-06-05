package tenant_test

import (
	"context"
	"testing"

	"plexcare/platform/plexcare-teleconf-service/pkg/tenant"
)

func TestTenantContext_RoundTrip(t *testing.T) {
	t.Parallel()

	tc := tenant.NewContext("t-1", "pro", 10, map[string]bool{"recording": true})
	ctx := tenant.WithContext(context.Background(), tc)

	got, ok := tenant.FromContext(ctx)
	if !ok {
		t.Fatal("FromContext: not found")
	}
	if got.ID != "t-1" || got.Plan != "pro" || got.MaxConcurrentRooms != 10 {
		t.Errorf("got = %+v", got)
	}
}

func TestTenantContext_MissingReturnsFalse(t *testing.T) {
	t.Parallel()

	_, ok := tenant.FromContext(context.Background())
	if ok {
		t.Error("FromContext: expected ok=false for empty context")
	}
}

func TestHasFeature(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		feature string
		setup   func() context.Context
		want    bool
	}{
		{
			name:    "feature presente",
			feature: "recording",
			setup: func() context.Context {
				tc := tenant.NewContext("t-1", "pro", 10, map[string]bool{"recording": true})
				return tenant.WithContext(context.Background(), tc)
			},
			want: true,
		},
		{
			name:    "feature ausente do tenant",
			feature: "transcription",
			setup: func() context.Context {
				tc := tenant.NewContext("t-1", "pro", 10, map[string]bool{"recording": true})
				return tenant.WithContext(context.Background(), tc)
			},
			want: false,
		},
		{
			name:    "tenant ausente do context",
			feature: "recording",
			setup:   func() context.Context { return context.Background() },
			want:    false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := tenant.HasFeature(tc.setup(), tc.feature); got != tc.want {
				t.Errorf("HasFeature(%q) = %v, want %v", tc.feature, got, tc.want)
			}
		})
	}
}
