# plexcare-teleconf — Sala virtual (Go 1.23)

> Carregado quando Claude trabalha em `platform/plexcare-teleconf/**`. Veja `../../CLAUDE.md` (raiz) para contexto do produto e compliance.

## O que é

Serviço Go responsável pelo ciclo de vida da sala virtual de telemedicina:
- Criar/fechar salas via LiveKit Server SDK
- Gerar tokens JWT com permissões por role (doctor/patient)
- Processar webhooks LiveKit (participant joined/left, room ended)
- Metering de minutos de uso por sala → eventos Kafka para billing

## Arquitetura

**Hexagonal (Ports & Adapters) + DDD** com bounded contexts isolados.

```
platform/plexcare-teleconf/
├── cmd/
│   ├── room-service/main.go         HTTP API (porta 8080)
│   └── usage-metering/main.go       Kafka consumer
├── internal/
│   ├── room/
│   │   ├── domain/                  Entidade Room, value objects, erros tipados
│   │   ├── application/             Use cases (CreateRoom, FinishRoom)
│   │   ├── ports/                   Interfaces driven + driving
│   │   └── infrastructure/          Adapters (postgres, livekit, kafka)
│   └── metering/
│       ├── domain/                  Entidade Usage, agregações
│       ├── application/             Use cases (ProcessEvent, Aggregate)
│       ├── ports/
│       └── infrastructure/
├── pkg/
│   ├── tenant/context.go            Propagação tenant_id via context.Context
│   └── telemetry/                   OTel setup compartilhado
├── migrations/                       SQL (golang-migrate)
├── go.mod                            module plexcare/platform/plexcare-teleconf
├── Dockerfile
└── docker-compose.dev.yml            Stack local (postgres, redis, kafka, livekit)
```

**Regras invioláveis:**
- `domain/` nunca importa de `infrastructure/` nem de framework
- `application/` orquestra `domain/` via `ports/` — nunca conhece o adapter
- `infrastructure/` implementa `ports/` — pode importar libs externas
- `cmd/` faz wiring (DI manual) — nenhuma lógica de negócio

## Stack interna

| Dependência | Uso |
|---|---|
| `github.com/go-chi/chi/v5` | HTTP router |
| `github.com/jackc/pgx/v5` | Driver Postgres |
| `github.com/redis/go-redis/v9` | Redis (routing, rate limit) |
| `github.com/segmentio/kafka-go` | Kafka producer/consumer |
| `github.com/livekit/server-sdk-go/v2` | LiveKit Server SDK |
| `go.uber.org/zap` | Logger estruturado |
| `go.opentelemetry.io/otel` | Tracing + métricas |
| `github.com/google/uuid` | IDs |

## Multi-tenancy — não-negociável

Todo request entra por middleware que:
1. Extrai `tenant_id` do header/token JWT
2. Coloca em `context.Context` via `pkg/tenant`
3. Repository **rejeita query** sem `tenant_id` no context

Logs e spans sempre carregam `tenant_id` como atributo. Métricas Prometheus usam `tenant_id` como label.

## Testes

- **TDD obrigatório** em `domain/` e `application/`
- **Table-driven tests** para qualquer lógica com múltiplos cenários
- Cobertura ≥ 90% nos pacotes acima
- Use mocks gerados por `mockery` ou implementação em-memória dos ports
- Integration tests sob `_test.go` com tag de build `//go:build integration`

```go
func TestRoomService_CreateRoom(t *testing.T) {
    tests := []struct{
        name      string
        input     room.CreateRoomInput
        setupMock func(*mockRoomRepo)
        wantErr   error
    }{
        {
            name:  "médico cria sala dentro do limite do plano",
            input: room.CreateRoomInput{TenantID: "t1", Role: "doctor"},
            wantErr: nil,
        },
        // ...
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) { /* ... */ })
    }
}
```

## Comandos

```bash
# Stack local completa
docker compose -f docker-compose.dev.yml up -d

# Subir só infraestrutura (rodar Go nativo com hot-reload)
docker compose -f docker-compose.dev.yml up -d postgres redis kafka livekit
air                                          # hot-reload via .air.toml

# Testes
go test ./...
go test -race ./...
go test -cover ./internal/room/domain/...
go test -run TestRoomService_CreateRoom ./internal/room/...

# Build
go build -o bin/room-service ./cmd/room-service
go build -o bin/usage-metering ./cmd/usage-metering

# Migrations
migrate -path migrations -database "$DATABASE_URL" up
```

## Domínios-chave para mexer

| Pacote | O que faz |
|---|---|
| `internal/room/application/create_room.go` | Use case `CreateRoom` (com quota enforcement) |
| `internal/room/domain/room.go` | Entidade Room + invariantes |
| `internal/room/infrastructure/livekit/` | Adapter LiveKit Server SDK |
| `internal/metering/application/process_event.go` | Use case que consome webhook → publica no Kafka |
| `pkg/tenant/context.go` | API canônica para `tenant_id` no context |

## Métricas obrigatórias (todo serviço novo)

Expor no `/metrics`:
- `http_requests_total{status, method, route, tenant_id}`
- `http_request_duration_seconds` (histogram)
- `room_active_total` (gauge)
- `room_duration_seconds` (histogram)
- `billing_events_total{status}`
- `webrtc_connection_errors_total{reason}`

Spans OTel obrigatórios em: toda request HTTP, `generateToken`, `processWebhook`, `publishBillingEvent`.

## Quando invocar agentes

- Feature backend nova → `/software-engineer` (TDD)
- Decisão arquitetural (ex: trocar Kafka por SQS) → `/solutions-architect`
- Criar test cases para release → `/qa-engineer`
- Observabilidade / alerta novo → `/sre-infra-engineer`
- Deploy / pipeline → `/devops-platform-engineer`

## Do / Don't

| ✅ Faça | ❌ Não faça |
|---|---|
| Erros como tipos (`var ErrRoomFull = errors.New(...)`) | `fmt.Errorf("room full")` espalhado |
| `tenant_id` em todo log/span/query | Query global sem filtro |
| `context.Context` como primeiro arg | Variável global de tenant |
| Mock via interface (port) | Mock de tipo concreto |
| `go test -race` antes de PR | Confiar que CI pega |
