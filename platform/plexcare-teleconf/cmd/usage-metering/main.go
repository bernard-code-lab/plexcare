package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"

	// "plexcare/platform/plexcare-teleconf/internal/metering/application"
	// "plexcare/platform/plexcare-teleconf/internal/metering/infrastructure/postgres"
	// "plexcare/platform/plexcare-teleconf/internal/metering/infrastructure/kafka"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync()

	cfg := loadConfig()
	_ = cfg

	// --- Dependency wiring ---
	// db := postgres.Connect(cfg.DatabaseURL)
	// publisher := kafka.NewPublisher(cfg.KafkaBrokers)
	// sessionRepo := postgres.NewSessionRepository(db)
	// usageRepo := postgres.NewUsageRepository(db)

	// processEvent := application.NewProcessEventUseCase(sessionRepo, publisher, log)
	// aggregate := application.NewAggregateUseCase(sessionRepo, usageRepo, log)

	// consumer := kafka.NewConsumer(cfg.KafkaBrokers, "room.events", "usage-metering-group")

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	log.Info("usage-metering starting, consuming room.events...")

	// Kafka consume loop — cada mensagem é processada pelo ProcessEventUseCase.
	// kafka.ConsumeLoop(ctx, consumer, func(msg kafka.Message) error {
	// 	var event application.ParticipantEvent
	// 	if err := json.Unmarshal(msg.Value, &event); err != nil {
	// 		return fmt.Errorf("unmarshal event: %w", err)
	// 	}
	// 	return processEvent.Execute(ctx, event)
	// })

	// Cron diário de agregação (alternativa: usar um CronJob no Kubernetes).
	// cron.New().AddFunc("0 2 * * *", func() {
	// 	aggregate.Execute(context.Background(), application.AggregateInput{})
	// })

	<-ctx.Done()
	log.Info("usage-metering shutting down")
}

type config struct {
	DatabaseURL  string
	KafkaBrokers string
}

func loadConfig() config {
	return config{
		DatabaseURL:  mustEnv("DATABASE_URL"),
		KafkaBrokers: getEnv("KAFKA_BROKERS", "localhost:9092"),
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
