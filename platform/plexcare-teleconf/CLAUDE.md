# plexcare-teleconf — Sala virtual (Go 1.26)

> Carregado quando Claude trabalha em `platform/plexcare-teleconf/**`. Veja `../../CLAUDE.md` (raiz) para contexto do produto e compliance.

## Antes de explorar o código — leia estes 6 arquivos

São os "load-bearing files" do módulo. Cobrem domínio, contratos, wiring e gotchas. Qualquer task de domínio começa por aqui (em vez de listar diretórios):

| Arquivo | Por que importa |
|---|---|
| `internal/room/domain/room.go` | Entidade Room, invariantes, erros tipados |
| `internal/room/ports/ports.go` | Contratos driven/driving — toda integração passa aqui |
| `internal/room/application/create_room.go` | Use case canônico: padrão para qualquer outro |
| `internal/room/infrastructure/livekit/client.go` | Como falar com LiveKit (Twirp + JWT) |
| `cmd/room-service/main.go` | DI manual — quem fala com quem |
| `pkg/tenant/context.go` | API canônica de multi-tenancy |

## Pesquisa antes de ler

- Para "onde está X?" / "quem chama Y?" → use `/graphify` primeiro. `Read` em arquivo inteiro só depois de localizar o trecho exato.
- Para "como rodar Z?" → consulte a seção **Comandos** abaixo, não execute trial-and-error.
- Para decisão arquitetural → consulte ADRs em `../../docs/adr/` antes de propor:
  - [ADR-0001](../../docs/adr/0001-kafka-como-event-bus-interno.md) — Kafka como event bus
  - [ADR-0002](../../docs/adr/0002-multi-tenancy-via-header-context.md) — Multi-tenancy via header + context

## O que é

Serviço Go responsável pelo ciclo de vida da sala virtual de telemedicina:
- Criar/fechar salas via LiveKit Server SDK
- Gerar tokens JWT com permissões por role (doctor/patient)
- Processar webhooks LiveKit (participant joined/left, room ended)
- Metering de minutos de uso por sala → eventos Kafka para billing

## Endpoints implementados

| Endpoint | Auth | Body / Header | Comportamento |
|---|---|---|---|
| `GET /health` | nenhuma | — | `200 {"status":"ok"}` |
| `POST /api/v1/rooms` | `X-Tenant-Id` (UUID) | `{appointment_id, host_identity, guest_identity, max_duration_min, max_participants, recording}` | Cria sala no LiveKit + grava em `rooms` + publica `room.events`. Retorna `{room_id, livekit_name, host_token, guest_token, expires_at}` |
| `POST /webhooks/livekit` | header `Authorization: <jwt>` HMAC-SHA256 do body | LiveKit WebhookEvent JSON | Roteia para `WebhookEventBus` (finishRoom, participant joined/left). Sempre 200 (LiveKit retentaria). |

**Não implementado ainda:** `DELETE /api/v1/rooms/{name}` (issue #2), real tenant auth (issue #3, ver abaixo), egress/gravação (issue #10).

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
│   └── tenant/context.go            Propagação tenant_id via context.Context
├── scripts/
│   └── create-test-room.sh          Cria sala de teste e imprime URLs meet.livekit.io
├── migrations/                       SQL (rodam no docker-entrypoint-initdb.d)
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

**`tenant_id` é `UUID` no schema (`rooms.tenant_id`).** Mandar string não-UUID retorna `invalid input syntax for type uuid (SQLSTATE 22P02)`. Em dev: `uuidgen | tr [:upper:] [:lower:]`.

### Auth em dev — `devtenant.Resolver` é FAKE

`internal/room/infrastructure/devtenant/resolver.go` aceita **qualquer UUID** no header `X-Tenant-Id` e devolve plano Pro (50 salas). Não valida contra DB, API key ou blocklist.

- **Status:** consciente, tracked em **issue #3** (P1).
- **Nunca subir para staging/prod sem #3 fechada.** Auth real virá com `platform/plexcare-auth-api/` (issue #17).
- Sinal de alerta: qualquer PR tocando `room-service` em prod sem resolver #3 → bloquear no review.

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

## Gotchas de dev (não repetir)

Três pegadinhas já corrigidas no `docker-compose.dev.yml` mas que reaparecem em forks/infra nova:

1. **LiveKit API secret precisa ter ≥ 32 chars** para HMAC-SHA256. Scaffold tinha `devsecret123456` (15 chars) → `unauthenticated` em qualquer Twirp. Fix: `devsecret123456devsecret123456ab` (32). Mesmo valor em `LIVEKIT_API_SECRET` do room-service **e** na config YAML inline do LiveKit. Fail-closed — não é boa-prática.

2. **Kafka exige listener dual** para integration tests do host. Single listener `KAFKA_ADVERTISED_LISTENERS: kafka:9092` funciona para Write simples mas quebra em `Conn.Controller()` (devolve `kafka:9092`, não-roteável do host). Padrão correto: `INTERNAL://kafka:9092` (containers) + `EXTERNAL://localhost:29092` (host). Tests usam `KAFKA_BROKERS=localhost:29092`.

3. **`air@latest` exige Go ≥ 1.26** (v1.65+). Para Go 1.23, pinar `air@v1.61.7`. Neste módulo a base já é `golang:1.26-alpine` (livekit/protocol exige).

Ao criar `platform/plexcare-infra/` (issue #13) e portar para Terraform/Helm, replicar os 3 padrões — especialmente dual listener no MSK.

## Comandos

```bash
# Stack local completa
docker compose -f docker-compose.dev.yml up -d

# Subir só infraestrutura (rodar Go nativo com hot-reload)
docker compose -f docker-compose.dev.yml up -d postgres redis kafka livekit
air                                          # hot-reload via .air.toml

# Testes
go test ./...                                          # unit
go test -race ./...                                    # com data race detector
go test -cover ./internal/room/domain/...              # cobertura domínio
go test -tags=integration ./internal/room/infrastructure/...  # integration (precisa stack up)
go test -run TestRoomService_CreateRoom ./internal/room/...   # teste específico

# Build
go build -o bin/room-service ./cmd/room-service
go build -o bin/usage-metering ./cmd/usage-metering

# Sala de teste (cria sala + imprime URLs prontas para meet.livekit.io)
./scripts/create-test-room.sh

# Migrations rodam automaticamente no primeiro start do postgres
# (montado em /docker-entrypoint-initdb.d via docker-compose).
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
| `tenant_id` como UUID válido | Strings arbitrárias no header `X-Tenant-Id` |
| `/graphify` para localizar código | `Read` em arquivo inteiro sem direção |
| Tratar `devtenant` como dev-only | Deploy sem issue #3 resolvida |
