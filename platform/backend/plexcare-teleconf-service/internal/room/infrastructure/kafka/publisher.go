// Package kafka implementa room.ports.EventPublisher usando segmentio/kafka-go.
package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/segmentio/kafka-go"
)

// Publisher mantém um Writer por tópico (criados sob demanda).
// O Writer interno do kafka-go é thread-safe e pool de conexões.
type Publisher struct {
	brokers []string
	mu      sync.RWMutex
	writers map[string]*kafka.Writer
}

func NewPublisher(brokers []string) *Publisher {
	return &Publisher{
		brokers: brokers,
		writers: make(map[string]*kafka.Writer),
	}
}

func (p *Publisher) Publish(ctx context.Context, topic, key string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	w := p.writerFor(topic)
	if err := w.WriteMessages(ctx, kafka.Message{
		Key:   []byte(key),
		Value: body,
	}); err != nil {
		return fmt.Errorf("write message: %w", err)
	}
	return nil
}

// Close fecha todos os Writers. Chamar no shutdown da app.
func (p *Publisher) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	var firstErr error
	for _, w := range p.writers {
		if err := w.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	p.writers = nil
	return firstErr
}

func (p *Publisher) writerFor(topic string) *kafka.Writer {
	p.mu.RLock()
	if w, ok := p.writers[topic]; ok {
		p.mu.RUnlock()
		return w
	}
	p.mu.RUnlock()

	p.mu.Lock()
	defer p.mu.Unlock()
	if w, ok := p.writers[topic]; ok {
		return w
	}
	w := &kafka.Writer{
		Addr:                   kafka.TCP(p.brokers...),
		Topic:                  topic,
		Balancer:               &kafka.Hash{}, // mesma key sempre na mesma partição (ordering)
		RequiredAcks:           kafka.RequireAll,
		AllowAutoTopicCreation: true, // dev — em prod use IaC
	}
	p.writers[topic] = w
	return w
}
