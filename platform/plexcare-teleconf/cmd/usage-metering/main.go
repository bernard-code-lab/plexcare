package main

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf/internal/metering/application"
	kafkaadapter "plexcare/platform/plexcare-teleconf/internal/metering/infrastructure/kafka"
	pgadapter "plexcare/platform/plexcare-teleconf/internal/metering/infrastructure/postgres"
	roomkafka "plexcare/platform/plexcare-teleconf/internal/room/infrastructure/kafka"
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

	sessionRepo := pgadapter.NewSessionRepository(pool)

	// Publisher das eventos UsageRecordedEvent (após processar leave).
	publisher := roomkafka.NewPublisher(strings.Split(cfg.KafkaBrokers, ","))
	defer publisher.Close()

	processEvent := application.NewProcessEventUseCase(sessionRepo, publisher, log)

	consumer := kafkaadapter.NewConsumer(
		strings.Split(cfg.KafkaBrokers, ","),
		"room.events",
		"usage-metering",
		processEvent,
		log,
	)
	defer consumer.Close()

	log.Info("usage-metering consuming room.events...")
	if err := consumer.Run(ctx); err != nil {
		log.Error("consumer loop ended", zap.Error(err))
	}
	log.Info("usage-metering shutting down")
}

type config struct {
	DatabaseURL  string
	KafkaBrokers string
}

func loadConfig() config {
	return config{
		DatabaseURL:  mustEnv("DATABASE_URL"),
		KafkaBrokers: getEnv("KAFKA_BROKERS", "kafka:9092"),
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
