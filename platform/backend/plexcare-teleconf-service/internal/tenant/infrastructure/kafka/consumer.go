// Package kafka implementa o consumer Kafka que projeta tenant.subscription.changed
// no read-model (ADR-0011 §D-2).
//
// Estratégia: ler envelope CloudEvents 1.0 produzido pelo plexcare-idp-api,
// validar tipo, desserializar `data` em domain.Subscription, invocar o use case.
// Mensagens com tipo diferente (eventos idp.user.*, idp.session.*, etc, que
// porventura caiam no mesmo topic) são puladas com commit — at-least-once
// preservado para os eventos relevantes.
package kafka

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	kgo "github.com/segmentio/kafka-go"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/tenant/domain"
)

// EventType emitido pelo idp-api.
const EventTypeTenantSubscriptionChanged = "tenant.subscription.changed"

// Processor é a porta que o consumer chama para cada evento válido.
type Processor interface {
	Execute(ctx context.Context, sub *domain.Subscription) error
}

// cloudEventEnvelope espelha o envelope produzido por
// src/modules/outbox/cloudevents.ts do plexcare-idp-api (CloudEvents 1.0).
type cloudEventEnvelope struct {
	SpecVersion     string          `json:"specversion"`
	ID              string          `json:"id"`
	Source          string          `json:"source"`
	Type            string          `json:"type"`
	Subject         string          `json:"subject"`
	Time            time.Time       `json:"time"`
	DataContentType string          `json:"datacontenttype"`
	Data            json.RawMessage `json:"data"`
	TenantID        *string         `json:"tenantid"`
}

// tenantSubscriptionChangedData espelha o payload Zod-validado por
// src/modules/outbox/events/tenant-subscription-changed.event.ts.
type tenantSubscriptionChangedData struct {
	TenantID           string          `json:"tenant_id"`
	AccountID          string          `json:"account_id"` // BigInt serializado como string
	PlanCode           string          `json:"plan_code"`
	ProductSKU         string          `json:"product_sku"`
	PlanTier           string          `json:"plan_tier"`
	Status             string          `json:"status"`
	MaxConcurrentRooms int             `json:"max_concurrent_rooms"`
	Features           map[string]bool `json:"features"`
	TrialEndsAt        *time.Time      `json:"trial_ends_at"`
	CurrentPeriodEnd   time.Time       `json:"current_period_end"`
}

// ParseEnvelope desserializa um envelope CloudEvents e devolve a Subscription
// se o tipo for tenant.subscription.changed. Retorna nil sem erro quando o
// tipo é outro (consumer pula e commita).
func ParseEnvelope(raw []byte) (*domain.Subscription, error) {
	var env cloudEventEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, fmt.Errorf("decode envelope: %w", err)
	}
	if env.Type != EventTypeTenantSubscriptionChanged {
		return nil, nil
	}
	var data tenantSubscriptionChangedData
	if err := json.Unmarshal(env.Data, &data); err != nil {
		return nil, fmt.Errorf("decode data: %w", err)
	}
	accountID, err := parseInt64(data.AccountID)
	if err != nil {
		return nil, fmt.Errorf("parse account_id: %w", err)
	}
	return &domain.Subscription{
		TenantID:           data.TenantID,
		AccountID:          accountID,
		PlanCode:           data.PlanCode,
		ProductSKU:         domain.ProductSKU(data.ProductSKU),
		PlanTier:           domain.PlanTier(data.PlanTier),
		Status:             domain.SubscriptionStatus(data.Status),
		MaxConcurrentRooms: data.MaxConcurrentRooms,
		Features:           data.Features,
		TrialEndsAt:        data.TrialEndsAt,
		CurrentPeriodEnd:   data.CurrentPeriodEnd,
		UpdatedAt:          env.Time,
	}, nil
}

// Consumer espelha o padrão do internal/metering/infrastructure/kafka/consumer.go
// (at-least-once via commit explícito após processar).
type Consumer struct {
	reader    *kgo.Reader
	processor Processor
	log       *zap.Logger
}

func NewConsumer(brokers []string, topic, group string, processor Processor, log *zap.Logger) *Consumer {
	r := kgo.NewReader(kgo.ReaderConfig{
		Brokers:        brokers,
		Topic:          topic,
		GroupID:        group,
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: 0, // commit explícito após processar
	})
	return &Consumer{reader: r, processor: processor, log: log}
}

func (c *Consumer) Run(ctx context.Context) error {
	for {
		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return nil
			}
			c.log.Error("FetchMessage error", zap.Error(err))
			continue
		}

		sub, parseErr := ParseEnvelope(msg.Value)
		if parseErr != nil {
			c.log.Warn("malformed envelope, skipping",
				zap.Int64("offset", msg.Offset),
				zap.Error(parseErr),
			)
			_ = c.reader.CommitMessages(ctx, msg)
			continue
		}
		if sub == nil {
			// Tipo de evento que não nos interessa — commita.
			_ = c.reader.CommitMessages(ctx, msg)
			continue
		}

		if err := c.processor.Execute(ctx, sub); err != nil {
			c.log.Error("processor failed",
				zap.String("tenant_id", sub.TenantID),
				zap.Error(err),
			)
			// Não commit — retentaremos.
			continue
		}

		if err := c.reader.CommitMessages(ctx, msg); err != nil {
			return fmt.Errorf("commit offset: %w", err)
		}
	}
}

func (c *Consumer) Close() error { return c.reader.Close() }

// parseInt64 tolera strings vazias devolvendo erro tipado para o caller logar.
func parseInt64(s string) (int64, error) {
	if s == "" {
		return 0, errors.New("empty account_id")
	}
	var n int64
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, fmt.Errorf("invalid digit %q in account_id", r)
		}
		n = n*10 + int64(r-'0')
	}
	return n, nil
}
