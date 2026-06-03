package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"plexcare/platform/plexcare-teleconf-service/internal/room/application"
	"plexcare/platform/plexcare-teleconf-service/internal/room/domain"
	"plexcare/platform/plexcare-teleconf-service/internal/room/ports"
	"plexcare/platform/plexcare-teleconf-service/pkg/tenant"
)

// --- fake repo --------------------------------------------------------------

type fakeRoomLister struct {
	gotTenantID string
	gotOpts     ports.ListRoomsOptions
	out         []*domain.Room
	nextCursor  string
	err         error
}

func (f *fakeRoomLister) ListByTenant(
	_ context.Context,
	tenantID string,
	opts ports.ListRoomsOptions,
) ([]*domain.Room, string, error) {
	f.gotTenantID = tenantID
	f.gotOpts = opts
	return f.out, f.nextCursor, f.err
}

func ctxWithTenant(id string) context.Context {
	return tenant.WithContext(
		context.Background(),
		tenant.NewContext(id, "pro", 10, nil),
	)
}

// --- tests ------------------------------------------------------------------

func TestListRoomsUseCase_Execute(t *testing.T) {
	t.Parallel()

	t1 := time.Date(2026, 6, 3, 12, 0, 0, 0, time.UTC)
	roomA := &domain.Room{ID: "r-1", TenantID: "t-1", LiveKitName: "room_r-1", Status: domain.RoomStatusFinished, CreatedAt: t1}
	roomB := &domain.Room{ID: "r-2", TenantID: "t-1", LiveKitName: "room_r-2", Status: domain.RoomStatusActive, CreatedAt: t1.Add(-time.Hour)}

	tests := []struct {
		name           string
		ctx            context.Context
		input          application.ListRoomsInput
		fakeOut        []*domain.Room
		fakeCursor     string
		fakeErr        error
		wantErr        error
		wantTenantID   string
		wantLimit      int
		wantCursor     string
		wantRoomsLen   int
		wantNextCursor string
	}{
		{
			name:         "happy path — usa limit default quando 0",
			ctx:          ctxWithTenant("t-1"),
			input:        application.ListRoomsInput{},
			fakeOut:      []*domain.Room{roomA, roomB},
			wantTenantID: "t-1",
			wantLimit:    20,
			wantRoomsLen: 2,
		},
		{
			name:         "limit explícito passa para o repo",
			ctx:          ctxWithTenant("t-1"),
			input:        application.ListRoomsInput{Limit: 50},
			fakeOut:      []*domain.Room{roomA},
			wantTenantID: "t-1",
			wantLimit:    50,
			wantRoomsLen: 1,
		},
		{
			name:         "limit acima do máximo é capado em 100",
			ctx:          ctxWithTenant("t-1"),
			input:        application.ListRoomsInput{Limit: 999},
			fakeOut:      nil,
			wantTenantID: "t-1",
			wantLimit:    100,
		},
		{
			name:         "limit negativo cai para default",
			ctx:          ctxWithTenant("t-1"),
			input:        application.ListRoomsInput{Limit: -1},
			wantTenantID: "t-1",
			wantLimit:    20,
		},
		{
			name:           "cursor é propagado e nextCursor retorna",
			ctx:            ctxWithTenant("t-1"),
			input:          application.ListRoomsInput{Cursor: "cur-X"},
			fakeOut:        []*domain.Room{roomB},
			fakeCursor:     "cur-Y",
			wantTenantID:   "t-1",
			wantLimit:      20,
			wantCursor:     "cur-X",
			wantRoomsLen:   1,
			wantNextCursor: "cur-Y",
		},
		{
			name:    "sem tenant no contexto → erro tipado",
			ctx:     context.Background(),
			input:   application.ListRoomsInput{},
			wantErr: application.ErrMissingTenantContext,
		},
		{
			name:    "erro do repo é propagado wrappado",
			ctx:     ctxWithTenant("t-1"),
			input:   application.ListRoomsInput{},
			fakeErr: errors.New("db down"),
			wantErr: errors.New("listing rooms: db down"),
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			repo := &fakeRoomLister{out: tc.fakeOut, nextCursor: tc.fakeCursor, err: tc.fakeErr}
			uc := application.NewListRoomsUseCase(repo)

			out, err := uc.Execute(tc.ctx, tc.input)

			if tc.wantErr != nil {
				if err == nil {
					t.Fatalf("err = nil, want %v", tc.wantErr)
				}
				if errors.Is(tc.wantErr, application.ErrMissingTenantContext) {
					if !errors.Is(err, application.ErrMissingTenantContext) {
						t.Fatalf("err = %v, want errors.Is ErrMissingTenantContext", err)
					}
					return
				}
				if err.Error() != tc.wantErr.Error() {
					t.Fatalf("err = %q, want %q", err.Error(), tc.wantErr.Error())
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if repo.gotTenantID != tc.wantTenantID {
				t.Errorf("repo got tenantID = %q, want %q", repo.gotTenantID, tc.wantTenantID)
			}
			if repo.gotOpts.Limit != tc.wantLimit {
				t.Errorf("repo got limit = %d, want %d", repo.gotOpts.Limit, tc.wantLimit)
			}
			if repo.gotOpts.Cursor != tc.wantCursor {
				t.Errorf("repo got cursor = %q, want %q", repo.gotOpts.Cursor, tc.wantCursor)
			}
			if len(out.Rooms) != tc.wantRoomsLen {
				t.Errorf("rooms len = %d, want %d", len(out.Rooms), tc.wantRoomsLen)
			}
			if out.NextCursor != tc.wantNextCursor {
				t.Errorf("next cursor = %q, want %q", out.NextCursor, tc.wantNextCursor)
			}
		})
	}
}
