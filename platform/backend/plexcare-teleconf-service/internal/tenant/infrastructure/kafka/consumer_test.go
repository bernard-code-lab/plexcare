package kafka_test

import (
	"encoding/json"
	"testing"
	"time"

	tkafka "plexcare/platform/plexcare-teleconf-service/internal/tenant/infrastructure/kafka"
)

// Envelope CloudEvents 1.0 emitido pelo plexcare-idp-api
// (src/modules/outbox/cloudevents.ts).
type envelopeJSON struct {
	SpecVersion     string          `json:"specversion"`
	ID              string          `json:"id"`
	Source          string          `json:"source"`
	Type            string          `json:"type"`
	Subject         string          `json:"subject"`
	Time            string          `json:"time"`
	DataContentType string          `json:"datacontenttype"`
	Data            json.RawMessage `json:"data"`
	TenantID        *string         `json:"tenantid"`
}

const tenantUUID = "8b6c1e33-1c57-4f85-a8fa-1025451490a4"

func dataJSON(t *testing.T) json.RawMessage {
	t.Helper()
	payload := map[string]any{
		"tenant_id":            tenantUUID,
		"account_id":           "7",
		"plan_code":            "rooms_clinica_annual",
		"product_sku":          "rooms",
		"plan_tier":            "clinica",
		"status":               "active",
		"max_concurrent_rooms": 30,
		"features":             map[string]bool{"recording": true},
		"trial_ends_at":        nil,
		"current_period_end":   "2026-07-07T00:00:00.000Z",
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal data: %v", err)
	}
	return raw
}

func envelope(t *testing.T, eventType string) []byte {
	t.Helper()
	tenantID := tenantUUID
	env := envelopeJSON{
		SpecVersion:     "1.0",
		ID:              "00000000-0000-0000-0000-000000000001",
		Source:          "plexcare-idp-api",
		Type:            eventType,
		Subject:         "tenant/" + tenantUUID,
		Time:            "2026-06-07T10:00:00.000Z",
		DataContentType: "application/json",
		Data:            dataJSON(t),
		TenantID:        &tenantID,
	}
	raw, err := json.Marshal(env)
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}
	return raw
}

func TestParseEnvelope_TenantSubscriptionChanged(t *testing.T) {
	raw := envelope(t, "tenant.subscription.changed")

	sub, err := tkafka.ParseEnvelope(raw)
	if err != nil {
		t.Fatalf("ParseEnvelope: %v", err)
	}
	if sub == nil {
		t.Fatal("esperava Subscription, veio nil")
	}
	if sub.TenantID != tenantUUID {
		t.Errorf("TenantID = %q, want %q", sub.TenantID, tenantUUID)
	}
	if sub.AccountID != 7 {
		t.Errorf("AccountID = %d, want 7", sub.AccountID)
	}
	if string(sub.ProductSKU) != "rooms" {
		t.Errorf("ProductSKU = %q, want rooms", sub.ProductSKU)
	}
	if sub.MaxConcurrentRooms != 30 {
		t.Errorf("MaxConcurrentRooms = %d, want 30", sub.MaxConcurrentRooms)
	}
	if !sub.Features["recording"] {
		t.Errorf("Features[recording] = false, want true")
	}
	if sub.TrialEndsAt != nil {
		t.Errorf("TrialEndsAt = %v, want nil", sub.TrialEndsAt)
	}
	expectedTime := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	if !sub.UpdatedAt.Equal(expectedTime) {
		t.Errorf("UpdatedAt = %v, want %v", sub.UpdatedAt, expectedTime)
	}
}

func TestParseEnvelope_OutroTipoRetornaNilSemErro(t *testing.T) {
	raw := envelope(t, "idp.user.signed_up")

	sub, err := tkafka.ParseEnvelope(raw)
	if err != nil {
		t.Fatalf("não deveria retornar erro p/ tipo desconhecido: %v", err)
	}
	if sub != nil {
		t.Errorf("esperava nil Subscription para tipo desconhecido, veio %+v", sub)
	}
}

func TestParseEnvelope_EnvelopeMalformadoRetornaErro(t *testing.T) {
	_, err := tkafka.ParseEnvelope([]byte("{not json"))
	if err == nil {
		t.Fatal("esperava erro para envelope mal-formado")
	}
}

func TestParseEnvelope_AccountIDInvalido(t *testing.T) {
	// data com account_id não-numérico
	payload := map[string]any{
		"tenant_id":            tenantUUID,
		"account_id":           "abc",
		"plan_code":            "x",
		"product_sku":          "rooms",
		"plan_tier":            "clinica",
		"status":               "active",
		"max_concurrent_rooms": 10,
		"features":             map[string]bool{},
		"trial_ends_at":        nil,
		"current_period_end":   "2026-07-07T00:00:00.000Z",
	}
	data, _ := json.Marshal(payload)
	tid := tenantUUID
	env := envelopeJSON{
		SpecVersion:     "1.0",
		ID:              "00000000-0000-0000-0000-000000000002",
		Source:          "plexcare-idp-api",
		Type:            "tenant.subscription.changed",
		Subject:         "tenant/" + tenantUUID,
		Time:            "2026-06-07T10:00:00.000Z",
		DataContentType: "application/json",
		Data:            data,
		TenantID:        &tid,
	}
	raw, _ := json.Marshal(env)

	_, err := tkafka.ParseEnvelope(raw)
	if err == nil {
		t.Fatal("esperava erro para account_id não-numérico")
	}
}

func TestParseEnvelope_TrialEndsAtPresente(t *testing.T) {
	payload := map[string]any{
		"tenant_id":            tenantUUID,
		"account_id":           "1",
		"plan_code":            "x",
		"product_sku":          "rooms",
		"plan_tier":            "trial",
		"status":               "trialing",
		"max_concurrent_rooms": 1,
		"features":             map[string]bool{},
		"trial_ends_at":        "2026-06-21T00:00:00.000Z",
		"current_period_end":   "2026-06-21T00:00:00.000Z",
	}
	data, _ := json.Marshal(payload)
	tid := tenantUUID
	env := envelopeJSON{
		SpecVersion:     "1.0",
		ID:              "00000000-0000-0000-0000-000000000003",
		Source:          "plexcare-idp-api",
		Type:            "tenant.subscription.changed",
		Subject:         "tenant/" + tenantUUID,
		Time:            "2026-06-07T10:00:00.000Z",
		DataContentType: "application/json",
		Data:            data,
		TenantID:        &tid,
	}
	raw, _ := json.Marshal(env)

	sub, err := tkafka.ParseEnvelope(raw)
	if err != nil {
		t.Fatalf("ParseEnvelope: %v", err)
	}
	if sub.TrialEndsAt == nil {
		t.Fatal("esperava TrialEndsAt preenchido")
	}
	expected := time.Date(2026, 6, 21, 0, 0, 0, 0, time.UTC)
	if !sub.TrialEndsAt.Equal(expected) {
		t.Errorf("TrialEndsAt = %v, want %v", sub.TrialEndsAt, expected)
	}
}
