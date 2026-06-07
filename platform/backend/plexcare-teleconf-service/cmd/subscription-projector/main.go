// Command subscription-projector consome o topic Kafka
// "tenant.subscription.v1" (eventos publicados pelo plexcare-idp-api via
// outbox/ADR-0005) e projeta no read-model Postgres tenant_subscription_view.
//
// Lido pelo middleware HTTP do room-service via TenantViewRepository
// para enriquecer tenant.Context (ADR-0011 §D-2).
package main

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/tenant/application"
	kafkaadapter "plexcare/platform/plexcare-teleconf-service/internal/tenant/infrastructure/kafka"
	pgadapter "plexcare/platform/plexcare-teleconf-service/internal/tenant/infrastructure/postgres"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync()

	cfg := loadConfig()
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal("postgres pool", zap.Error(err))
	}
	defer pool.Close()

	repo := pgadapter.NewViewRepository(pool)
	uc := application.NewProjectSubscriptionUseCase(repo, log)

	consumer := kafkaadapter.NewConsumer(
		strings.Split(cfg.KafkaBrokers, ","),
		cfg.Topic,
		cfg.ConsumerGroup,
		uc,
		log,
	)
	defer consumer.Close()

	log.Info("subscription-projector starting",
		zap.String("topic", cfg.Topic),
		zap.String("group", cfg.ConsumerGroup),
	)
	if err := consumer.Run(ctx); err != nil {
		log.Error("consumer loop ended", zap.Error(err))
	}
	log.Info("subscription-projector shutting down")
}

type config struct {
	DatabaseURL   string
	KafkaBrokers  string
	Topic         string
	ConsumerGroup string
}

func loadConfig() config {
	return config{
		DatabaseURL:   mustEnv("DATABASE_URL"),
		KafkaBrokers:  getEnv("KAFKA_BROKERS", "kafka:9092"),
		Topic:         getEnv("TENANT_EVENTS_TOPIC", "tenant.subscription.v1"),
		ConsumerGroup: getEnv("TENANT_EVENTS_GROUP", "subscription-projector"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("required env var not set: " + key)
	}
	return v
}
