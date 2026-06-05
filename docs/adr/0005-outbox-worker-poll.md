# ADR 0005 — Outbox transacional + worker poll para Kafka

**Status:** Aceita — 2026-06-05
**Decisores:** Solutions Architect, Software Engineer
**Substitui:** —
**Consultar antes:** [ADR-0001 Kafka como event bus](./0001-kafka-como-event-bus-interno.md), [blueprint](../../tasks/idp-api-blueprint.md) §6 TO-4, [spec](../../tasks/idp-api-spec.md) Etapa 21

## Contexto

O `plexcare-idp-api` publica eventos de negócio (signup, login, refresh, role-change) que outros serviços consomem via Kafka. Precisamos garantir **at-least-once** sem perder eventos quando o broker estiver instável.

Alternativas avaliadas:

| Opção | Mecanismo | Trade-off principal |
|---|---|---|
| **Outbox + worker poll** | INSERT em tabela `outbox` na mesma TX; worker drena com `SELECT FOR UPDATE SKIP LOCKED`. | Pequena latência adicional (~500ms); worker = SPOF mitigado por lock distribuído. |
| Outbox + Debezium CDC | Kafka Connect lê binlog do MySQL. | Operacional pesado (Debezium + Connect cluster); overkill para MVP. |
| Publicar direto na transação | Service.x() faz INSERT + Kafka produce na mesma função. | Quebra at-least-once: se Kafka cair entre commit DB e produce, evento se perde. |

## Decisão

**Outbox transacional + worker poll**:

- `OutboxService.publish(tx, event)` faz INSERT na mesma transação Prisma do business write (em [`src/modules/outbox/outbox.service.ts`](../../platform/backend/plexcare-idp-api/src/modules/outbox/outbox.service.ts)).
- `OutboxWorker` (em [`outbox.worker.ts`](../../platform/backend/plexcare-idp-api/src/modules/outbox/outbox.worker.ts)) faz `setInterval` 500ms; lê batches de 100 com `FOR UPDATE SKIP LOCKED`; produz batch em Kafka com `acks=all`; marca `published_at`. Em falha, incrementa `attempts` + grava `last_error`.
- Lock distribuído via `idp_cron_lock` ([`cron-lock.service.ts`](../../platform/backend/plexcare-idp-api/src/shared/cron/cron-lock.service.ts)) — substitui Redis no MVP.
- Métricas expostas: `idp_outbox_pending`, `idp_outbox_lag_seconds`.

## Consequências

### Positivas

- **At-least-once** garantido. Consumers devem ser idempotentes pelo `event_id UNIQUE`.
- Sem dependência de infra adicional além do MySQL (que já temos).
- Fácil de raciocinar: 1 query SELECT, 1 produce, 1 UPDATE.

### Negativas

- Latência mínima ~500ms entre commit do write e chegada do evento ao Kafka — aceitável para o domínio IdP (assíncrono por natureza).
- Worker é singleton lógico (lock garante apenas 1 ativo); se replicas=3 e o lock-holder cai, a próxima tick pega o lock — recovery automático em < 500ms.

### Evolução

- Quando latência < 500ms virar requisito, considerar **Debezium CDC** lendo binlog. O contrato (mesma tabela `outbox`, mesmo envelope CloudEvents) é compatível.

## Referências

- [ADR-0001 Kafka como event bus](./0001-kafka-como-event-bus-interno.md)
- [blueprint §6 TO-4](../../tasks/idp-api-blueprint.md)
- [spec — Etapa 21](../../tasks/idp-api-spec.md)
