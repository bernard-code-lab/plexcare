package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"go.uber.org/zap"

	// Wiring das infra implementations (a serem criadas na infra layer)
	// "plexcare/platform/plexcare-teleconf/internal/room/application"
	// "plexcare/platform/plexcare-teleconf/internal/room/infrastructure/postgres"
	// "plexcare/platform/plexcare-teleconf/internal/room/infrastructure/livekit"
	// "plexcare/platform/plexcare-teleconf/internal/room/infrastructure/kafka"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync()

	cfg := loadConfig()

	// --- Dependency wiring ---
	// db := postgres.Connect(cfg.DatabaseURL)
	// lkClient := livekit.NewClient(cfg.LiveKitHost, cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)
	// tokenGen := livekit.NewTokenGenerator(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)
	// publisher := kafka.NewPublisher(cfg.KafkaBrokers)
	// roomRepo := postgres.NewRoomRepository(db)

	// createRoom := application.NewCreateRoomUseCase(roomRepo, lkClient, tokenGen, publisher, log)
	// finishRoom := application.NewFinishRoomUseCase(roomRepo, publisher, log)
	// _ = createRoom
	// _ = finishRoom

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// r.Post("/rooms", handler.CreateRoom(createRoom))
	// r.Delete("/rooms/{roomName}", handler.FinishRoom(finishRoom))

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info("room-service starting", zap.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("forced shutdown", zap.Error(err))
	}
}

type config struct {
	Port              string
	DatabaseURL       string
	LiveKitHost       string
	LiveKitAPIKey     string
	LiveKitAPISecret  string
	KafkaBrokers      string
	RedisURL          string
}

func loadConfig() config {
	return config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      mustEnv("DATABASE_URL"),
		LiveKitHost:      mustEnv("LIVEKIT_HOST"),
		LiveKitAPIKey:    mustEnv("LIVEKIT_API_KEY"),
		LiveKitAPISecret: mustEnv("LIVEKIT_API_SECRET"),
		KafkaBrokers:     getEnv("KAFKA_BROKERS", "localhost:9092"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379"),
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
