# ADR-0001 — Kafka como event bus interno

- **Data:** 2026-06-02
- **Status:** Accepted
- **Deciders:** equipe de plataforma (Rafael)
- **Tags:** `area/backend` `area/infra` `module/plexcare-teleconf`

## Contexto

O `plexcare-teleconf` precisa de comunicação assíncrona em dois pontos:

1. **`room-service` → `usage-metering`**: cada criação/finalização de sala vira um evento que o consumer agrega em minutos faturáveis para billing.
2. **Webhook LiveKit → consumers internos**: `participant_joined`, `participant_left`, `room_finished` precisam virar eventos duráveis (não dependem de o consumer estar up no momento do webhook — LiveKit retentaria, mas duplicação seria custosa).

Requisitos:
- **Durabilidade strong** — evento de billing perdido = receita perdida.
- **Ordering por sala** — `participant_joined` antes de `participant_left` da mesma sala.
- **Replay** — reprocessar eventos para corrigir bug de cálculo no consumer.
- **Particionamento por tenant** — isolamento de throughput + locality para queries de auditoria.
- **Compatível com EKS em prod** (AWS).

## Decisão

Adotamos **Apache Kafka** como event bus interno do `plexcare-teleconf` (e default para qualquer módulo futuro de `platform/`).

**Configuração:**
- Dev: `confluentinc/cp-kafka:7.7` em modo **KRaft** (sem ZooKeeper), single broker, no `docker-compose.dev.yml`.
- Prod (planejado): **AWS MSK** com 3 brokers, multi-AZ.
- **Particionamento por `tenant_id`** via hash (kafka-go `Balancer: &kafka.Hash{}`).
- **Durabilidade:** `acks=all`, `min.insync.replicas=2` em prod.
- **Cliente:** `github.com/segmentio/kafka-go` (lazy writer pool, hash partitioning).
- **Topic naming:** `<module>.<event-type>` (ex: `room.events`, `billing.usage`).

**Dual listener obrigatório em dev** (ver [[plexcare-livekit-dev-gotchas]]):
```yaml
KAFKA_LISTENERS: INTERNAL://0.0.0.0:9092,EXTERNAL://0.0.0.0:29092,CONTROLLER://0.0.0.0:9093
KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:9092,EXTERNAL://localhost:29092
```
Containers usam `kafka:9092`; integration tests do host usam `localhost:29092`.

## Consequências

**Positivas**
- Durabilidade strong + retenção configurável + replay nativo.
- Ordering por partition resolve o requisito de eventos por sala.
- Particionamento por `tenant_id` dá isolamento de throughput e simplifica auditoria multi-tenant.
- Stack já amplamente usada em saúde (paths de certificação conhecidos).
- MSK em prod é managed (operacional reduzido).

**Negativas / Trade-offs**
- Operacional pesado em dev local (Kafka + KRaft + listener dual) vs SQS-like.
- Custo > SQS para volume baixo (MSK tem floor de ~$120/mês em prod multi-AZ).
- Curva de aprendizado para devs sem familiaridade com Kafka.
- Auto-create topics em dev mascarou bug de controller advertised — agora documentado.

**Neutras / a observar**
- Schema registry: ainda não adotado. Eventos serializam como JSON. Quando chegar a 3+ schemas em conflito, avaliar Confluent Schema Registry ou similar.
- Particionamento por `tenant_id` cria hot partitions se um tenant for muito maior que os outros. Plano: rebalancear via subdivisão de chave (`tenant_id:room_id`) quando p99 de lag passar 5s.

## Alternativas consideradas

### AWS SQS
- Prós: managed, sem broker pra operar, custo previsível pequeno.
- Contras: ordering só via FIFO + MessageGroupId (limite 300 msg/s por grupo), sem replay nativo, sem partição lógica.
- Por que não: requisito de replay + ordering por sala em volume desconhecido invalidaria a escolha logo no primeiro escala.

### Redis Streams
- Prós: leve, já temos Redis na stack (LiveKit routing), latência baixa.
- Contras: durabilidade fraca sem AOF + sync (mata performance), replay limitado, sem partição real.
- Por que não: billing não tolera "perdemos o evento porque o nó caiu".

### NATS JetStream
- Prós: leve, durabilidade boa, ordering por subject.
- Contras: time sem familiaridade, comunidade menor em saúde BR, MSK não existe como managed equivalente.
- Por que não: trade-off custo-vs-familiaridade pendeu para Kafka.

### RabbitMQ
- Prós: maturidade, roteamento sofisticado (exchanges).
- Contras: ordering via single queue, replay via plugin, particionamento via sharding plugin (não nativo).
- Por que não: sentimos que estaríamos lutando contra a ferramenta para o caso de uso.

## Plano de revisão

Reavaliar se:
- MSK custo > 30% do TCO de infra do `plexcare-teleconf` em prod.
- Latência p99 de produção de evento ultrapassar 200ms (algo está errado).
- Time crescer para 10+ engenheiros e Kafka virar gargalo de onboarding.
- LiveKit/Cloud adicionar event sink managed direto (ex: webhook → EventBridge nativo).

## Referências

- Issue: #4 (Kafka topics canônicos), #10 (egress events)
- Código: `platform/plexcare-teleconf/internal/room/infrastructure/kafka/publisher.go`
- Memória: [[plexcare-livekit-dev-gotchas]]
- Stack local: `platform/plexcare-teleconf/docker-compose.dev.yml`
