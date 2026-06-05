package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"plexcare/platform/plexcare-teleconf-service/internal/room/application"
	"plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/devtenant"
	httpadapter "plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/http"
	kafkaadapter "plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/kafka"
	lkadapter "plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/livekit"
	pgadapter "plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/postgres"
	"plexcare/platform/plexcare-teleconf-service/internal/room/infrastructure/webhookbridge"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync()

	cfg := loadConfig()

	// --- Infraestrutura -----------------------------------------------------
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal("postgres pool", zap.Error(err))
	}
	defer pool.Close()

	roomRepo := pgadapter.NewRoomRepository(pool)
	lkClient := lkadapter.NewClient(cfg.LiveKitHTTP, cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)
	tokenGen := lkadapter.NewTokenGenerator(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)
	publisher := kafkaadapter.NewPublisher(strings.Split(cfg.KafkaBrokers, ","))
	defer publisher.Close()

	// --- Use cases ----------------------------------------------------------
	createRoom := application.NewCreateRoomUseCase(roomRepo, lkClient, tokenGen, publisher, log)
	finishRoom := application.NewFinishRoomUseCase(roomRepo, publisher, log)
	listRooms := application.NewListRoomsUseCase(roomRepo)

	// --- Webhook bridge -----------------------------------------------------
	bridge := webhookbridge.New(finishRoom, publisher, roomRepo, log)
	webhookHandler := lkadapter.NewWebhookHandler(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret, bridge, log)

	// --- HTTP router --------------------------------------------------------
	resolver := devtenant.New()

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Tenant-Id", "X-Request-Id"},
		ExposedHeaders:   []string{"X-Request-Id"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Webhook do LiveKit — fora do middleware de tenant (LiveKit não envia X-Tenant-Id).
	r.Post("/webhooks/livekit", webhookHandler.ServeHTTP)

	// API pública — protegida por tenant.
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(httpadapter.TenantMiddleware(resolver))
		r.Post("/rooms", httpadapter.CreateRoom(createRoom))
		r.Get("/rooms", httpadapter.ListRooms(listRooms))
	})

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
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("forced shutdown", zap.Error(err))
	}
}

type config struct {
	Port               string
	DatabaseURL        string
	LiveKitHTTP        string
	LiveKitAPIKey      string
	LiveKitAPISecret   string
	KafkaBrokers       string
	RedisURL           string
	CORSAllowedOrigins []string
}

func loadConfig() config {
	return config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        mustEnv("DATABASE_URL"),
		LiveKitHTTP:        getEnv("LIVEKIT_HTTP_URL", "http://livekit:7880"),
		LiveKitAPIKey:      mustEnv("LIVEKIT_API_KEY"),
		LiveKitAPISecret:   mustEnv("LIVEKIT_API_SECRET"),
		KafkaBrokers:       getEnv("KAFKA_BROKERS", "kafka:9092"),
		RedisURL:           getEnv("REDIS_URL", "redis://redis:6379"),
		CORSAllowedOrigins: splitCSV(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5174")),
	}
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
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
