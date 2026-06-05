//go:build integration

package kafka_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	kgo "github.com/segmentio/kafka-go"

	"plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/kafka"
)

// Pre-req: docker compose -f docker-compose.dev.yml up -d kafka
// Run:     go test -tags=integration ./internal/room/infrastructure/kafka/...

func brokers() []string {
	v := os.Getenv("KAFKA_BROKERS")
	if v == "" {
		v = "localhost:9092"
	}
	return strings.Split(v, ",")
}

func TestPublisher_PublishAndConsume(t *testing.T) {
	topic := fmt.Sprintf("itest_%d", time.Now().UnixNano())
	bs := brokers()

	// Pré-criação evita race UNKNOWN_TOPIC_OR_PARTITION no primeiro Write
	// (auto-create roda concorrente com metadata fetch).
	createTopic(t, bs[0], topic)

	pub := kafka.NewPublisher(bs)
	t.Cleanup(func() { _ = pub.Close() })

	type evt struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	payload := evt{ID: "r-1", Name: "consultation"}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := pub.Publish(ctx, topic, "r-1", payload); err != nil {
		t.Fatalf("Publish: %v", err)
	}

	reader := kgo.NewReader(kgo.ReaderConfig{
		Brokers:  bs,
		Topic:    topic,
		GroupID:  "itest-consumer",
		MinBytes: 1,
		MaxBytes: 10e6,
	})
	t.Cleanup(func() { _ = reader.Close() })

	msgCtx, msgCancel := context.WithTimeout(ctx, 10*time.Second)
	defer msgCancel()
	msg, err := reader.ReadMessage(msgCtx)
	if err != nil {
		t.Fatalf("ReadMessage: %v", err)
	}

	var got evt
	if err := json.Unmarshal(msg.Value, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != "r-1" || got.Name != "consultation" {
		t.Errorf("got = %+v", got)
	}
	if string(msg.Key) != "r-1" {
		t.Errorf("key = %s, want r-1", string(msg.Key))
	}
}

func createTopic(t *testing.T, broker, topic string) {
	t.Helper()
	conn, err := kgo.Dial("tcp", broker)
	if err != nil {
		t.Fatalf("dial broker: %v", err)
	}
	defer conn.Close()

	controller, err := conn.Controller()
	if err != nil {
		t.Fatalf("controller: %v", err)
	}
	ctrlConn, err := kgo.Dial("tcp", fmt.Sprintf("%s:%d", controller.Host, controller.Port))
	if err != nil {
		t.Fatalf("dial controller: %v", err)
	}
	defer ctrlConn.Close()

	if err := ctrlConn.CreateTopics(kgo.TopicConfig{
		Topic:             topic,
		NumPartitions:     1,
		ReplicationFactor: 1,
	}); err != nil {
		t.Fatalf("CreateTopics: %v", err)
	}
}
