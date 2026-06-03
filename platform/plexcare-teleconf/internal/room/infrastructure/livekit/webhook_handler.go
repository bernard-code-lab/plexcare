package livekit

import (
	"context"
	"net/http"
	"time"

	lkauth "github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	"github.com/livekit/protocol/webhook"
	"go.uber.org/zap"
)

// WebhookEventBus é o sink para os eventos do LiveKit já validados.
// Em produção, isso publica no Kafka; em testes, pode ser um in-memory recorder.
type WebhookEventBus interface {
	OnRoomFinished(ctx context.Context, livekitRoomName string, finishedAt time.Time) error
	OnParticipantJoined(ctx context.Context, livekitRoomName, participantID, role string, at time.Time) error
	OnParticipantLeft(ctx context.Context, livekitRoomName, participantID, role string, at time.Time) error
}

// WebhookHandler valida HMAC e roteia eventos para o EventBus.
// LiveKit envia POST /webhooks/livekit com header Authorization: <jwt>
// que assina o body com o api-secret. webhook.ReceiveWebhookEvent valida tudo.
type WebhookHandler struct {
	provider lkauth.KeyProvider
	bus      WebhookEventBus
	log      *zap.Logger
}

func NewWebhookHandler(apiKey, apiSecret string, bus WebhookEventBus, log *zap.Logger) *WebhookHandler {
	return &WebhookHandler{
		provider: lkauth.NewSimpleKeyProvider(apiKey, apiSecret),
		bus:      bus,
		log:      log,
	}
}

func (h *WebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	event, err := webhook.ReceiveWebhookEvent(r, h.provider)
	if err != nil {
		h.log.Warn("webhook validation failed", zap.Error(err))
		http.Error(w, "invalid webhook signature", http.StatusUnauthorized)
		return
	}

	at := time.UnixMicro(event.CreatedAt * 1_000_000).UTC()
	if at.IsZero() || event.CreatedAt == 0 {
		at = time.Now().UTC()
	}

	switch event.GetEvent() {
	case webhook.EventRoomFinished:
		h.handleRoomFinished(r.Context(), event, at)
	case webhook.EventParticipantJoined:
		h.handleParticipantJoined(r.Context(), event, at)
	case webhook.EventParticipantLeft:
		h.handleParticipantLeft(r.Context(), event, at)
	default:
		// Eventos não tratados ainda (room_started, track_published, etc.) — ignorados silenciosamente.
		h.log.Debug("ignoring webhook event", zap.String("event", event.GetEvent()))
	}

	// LiveKit retentará se receber não-2xx — sempre devolva 200 após processar.
	w.WriteHeader(http.StatusOK)
}

func (h *WebhookHandler) handleRoomFinished(ctx context.Context, event *livekit.WebhookEvent, at time.Time) {
	room := event.GetRoom()
	if room == nil {
		return
	}
	if err := h.bus.OnRoomFinished(ctx, room.GetName(), at); err != nil {
		h.log.Error("OnRoomFinished failed",
			zap.String("room", room.GetName()),
			zap.Error(err),
		)
	}
}

func (h *WebhookHandler) handleParticipantJoined(ctx context.Context, event *livekit.WebhookEvent, at time.Time) {
	room := event.GetRoom()
	p := event.GetParticipant()
	if room == nil || p == nil {
		return
	}
	role := participantRoleFromIdentity(p.GetIdentity())
	if err := h.bus.OnParticipantJoined(ctx, room.GetName(), p.GetIdentity(), role, at); err != nil {
		h.log.Error("OnParticipantJoined failed", zap.Error(err))
	}
}

func (h *WebhookHandler) handleParticipantLeft(ctx context.Context, event *livekit.WebhookEvent, at time.Time) {
	room := event.GetRoom()
	p := event.GetParticipant()
	if room == nil || p == nil {
		return
	}
	role := participantRoleFromIdentity(p.GetIdentity())
	if err := h.bus.OnParticipantLeft(ctx, room.GetName(), p.GetIdentity(), role, at); err != nil {
		h.log.Error("OnParticipantLeft failed", zap.Error(err))
	}
}

// participantRoleFromIdentity infere o papel a partir do prefixo da identity.
// Convenção: tokens emitidos pelo TokenGenerator usam "doctor_<uuid>" / "patient_<uuid>".
func participantRoleFromIdentity(identity string) string {
	switch {
	case len(identity) >= 7 && identity[:7] == "doctor_":
		return "doctor"
	case len(identity) >= 8 && identity[:8] == "patient_":
		return "patient"
	default:
		return "unknown"
	}
}
