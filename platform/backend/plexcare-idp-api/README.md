# plexcare-idp-api

Authorization Server REST da PlexCare. Valida senha no Keycloak via Direct Grant, emite JWT Ed25519 próprio com claims `account_id/roles`, persiste sessões refresh-rotacionáveis e publica eventos via outbox → Kafka.

> **Status:** scaffold (Etapa 1 do spec). Sem endpoints implementados ainda. Acompanhe progresso em [tasks/idp-api-spec.md](../../../tasks/idp-api-spec.md).

## Stack

- NestJS 10 + Fastify
- Prisma 5 + MySQL 8
- `jose` (Ed25519) + JWKS rotacionável
- `kafkajs` + outbox transacional
- Zod + zod-to-openapi (OpenAPI 3.1)
- Pino + OpenTelemetry + Prometheus
- Jest + Testcontainers

## Quickstart

```bash
cp .env.example .env
# editar JWKS_KEK_DEV e credenciais conforme necessário

# subir infra local (mysql + mailhog)
docker compose -f docker-compose.dev.yml up -d

# Keycloak e Kafka vêm da stack do teleconf-service — suba-a primeiro:
# cd ../plexcare-teleconf-service && docker compose -f docker-compose.dev.yml up -d

npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

API: `http://localhost:4000`
MailHog UI: `http://localhost:8025`

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | NestJS em watch mode |
| `npm run build` | Build TypeScript |
| `npm test` | Unit + integration tests |
| `npm run test:e2e` | E2E com Testcontainers |
| `npm run test:cov` | Cobertura |
| `npm run lint` | ESLint estrito |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:migrate` | Cria/aplica migration em dev |
| `npm run prisma:studio` | Prisma Studio |

## Referências

- [Spec](../../../tasks/idp-api-spec.md)
- [Blueprint](../../../tasks/idp-api-blueprint.md)
- [Discovery](../../../tasks/idp-api-discovery.md)
- [CLAUDE.md do módulo](./CLAUDE.md)
