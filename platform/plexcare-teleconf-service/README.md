<p align="center">
  <img src="https://img.shields.io/badge/go-1.23-00ADD8?logo=go&logoColor=white" alt="Go 1.23" />
  <img src="https://img.shields.io/badge/livekit-v1.7-FF6B35" alt="LiveKit" />
  <img src="https://img.shields.io/badge/postgres-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/kafka-KRaft-231F20?logo=apachekafka&logoColor=white" alt="Kafka" />
  <img src="https://img.shields.io/badge/redis-7-DC382D?logo=redis&logoColor=white" alt="Redis 7" />
</p>

# plexcare-teleconf

Sala virtual de telemedicina — gerenciamento de salas LiveKit, tokens JWT por role, metering de uso e webhooks de eventos.

---

## Dominios

| Dominio | Descricao |
|---|---|
| **room** | Criar/fechar salas via LiveKit API, gerar tokens JWT com permissoes por role (doctor/patient) |
| **metering** | Registrar minutos de uso por sala, publicar eventos no Kafka para billing |

## Servicos

| Binario | Tipo | Porta | Descricao |
|---|---|---|---|
| `room-service` | HTTP API | 8080 | Cria salas, gera tokens, processa webhooks LiveKit |
| `usage-metering` | Kafka consumer | — | Consome eventos de sala e agrega metricas de uso |

## Arquitetura

Segue **Hexagonal Architecture** (Ports & Adapters) com DDD:

```
plexcare-teleconf-service/
  cmd/
    room-service/main.go         Entrypoint HTTP
    usage-metering/main.go       Entrypoint Kafka consumer
  internal/
    room/
      domain/room.go             Entidade Room, value objects, erros
      application/               Use cases (CreateRoom, FinishRoom)
      ports/ports.go             Interfaces driven + driving
      infrastructure/            Adapters (postgres, livekit, kafka)
    metering/
      domain/usage.go            Entidade Usage, agregacoes
      application/               Use cases (ProcessEvent, Aggregate)
      ports/ports.go             Interfaces driven + driving
      infrastructure/            Adapters (postgres, kafka)
  pkg/
    tenant/context.go            Multi-tenancy context propagation
  migrations/
    001_init.sql                 Schema inicial
```

## Dependencias de Infraestrutura

| Servico | Versao | Uso |
|---|---|---|
| PostgreSQL | 16 | Persistencia de salas, uso, tenants |
| Redis | 7 | Routing LiveKit, rate limiting |
| Kafka | 7.7 (KRaft) | Eventos de sala, billing, metering |
| LiveKit Server | v1.7 | SFU WebRTC (media) |

## Desenvolvimento Local

### Pre-requisitos

- Go >= 1.23
- Docker + Docker Compose

### Subir infraestrutura + servicos

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Subir apenas infraestrutura (rodar Go localmente)

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis kafka livekit
go run ./cmd/room-service
```

### Ferramentas opcionais

```bash
docker compose -f docker-compose.dev.yml --profile tools up -d  # Kafka UI em :8090
```

### Variaveis de Ambiente

| Variavel | Descricao | Default (dev) |
|---|---|---|
| `PORT` | Porta HTTP do room-service | `8080` |
| `DATABASE_URL` | Connection string PostgreSQL | `postgres://plexcare:plexcare@localhost:5432/plexcare_dev` |
| `REDIS_URL` | Connection string Redis | `redis://localhost:6379` |
| `KAFKA_BROKERS` | Brokers Kafka | `localhost:9092` |
| `LIVEKIT_HOST` | Endpoint LiveKit | `ws://localhost:7880` |
| `LIVEKIT_API_KEY` | API key LiveKit | `devkey` |
| `LIVEKIT_API_SECRET` | API secret LiveKit | `devsecret123456` |
| `CORS_ALLOWED_ORIGINS` | CSV de origins liberados | `http://localhost:5174` (o `-web`) |

## Portas (dev)

| Porta | Servico |
|---|---|
| 8080 | room-service API |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 9092 | Kafka |
| 7880 | LiveKit HTTP/WS |
| 7881 | LiveKit RTC TCP |
| 7882/udp | LiveKit RTC UDP |
| 8090 | Kafka UI (profile tools) |
