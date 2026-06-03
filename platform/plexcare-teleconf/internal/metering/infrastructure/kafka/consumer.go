// Package kafka implementa o Kafka consumer do usage-metering.
package kafka

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	kgo "github.com/segmentio/kafka-go"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf/internal/metering/application"
)

// Processor é a porta que o consumer chama para cada evento.
type Processor interface {
	Execute(ctx context.Context, event application.ParticipantEvent) error
}

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

// Run bloqueia até o contexto ser cancelado. Loga e segue em erros — at-least-once.
// Mensagens malformadas vão para log e DLQ (DLQ não implementada ainda, é TODO).
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

		var event application.ParticipantEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			c.log.Warn("malformed message, skipping",
				zap.Int64("offset", msg.Offset),
				zap.Error(err),
			)
			_ = c.reader.CommitMessages(ctx, msg)
			continue
		}

		// Filtra eventos que não são de participante (ex: room_finished).
		if event.Type == "" {
			_ = c.reader.CommitMessages(ctx, msg)
			continue
		}

		if err := c.processor.Execute(ctx, event); err != nil {
			c.log.Error("processor failed",
				zap.String("room_id", event.RoomID),
				zap.String("participant_id", event.ParticipantID),
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
