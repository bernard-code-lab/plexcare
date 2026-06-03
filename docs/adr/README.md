# Architecture Decision Records (ADRs)

Decisões arquiteturais grandes do PlexCare. Formato [MADR](https://adr.github.io/madr/) (Markdown ADR), em pt-BR.

## Por que ADR?

Decisões grandes (escolha de fila, multi-tenancy, banco, protocolo) precisam ficar registradas com **contexto** e **alternativas consideradas**. Sem ADR:

- A motivação some em 6 meses
- Onboarding repete o mesmo debate
- Mudanças futuras quebram constraints invisíveis

ADRs vivem aqui no repo (não em Notion/Confluence) porque viajam com o código e qualquer dev (humano ou IA) lê no clone.

## Quando escrever ADR

- Escolha de tecnologia (Kafka vs SQS, Postgres vs DynamoDB, REST vs gRPC)
- Estratégia cross-cutting (multi-tenancy, auth, observabilidade)
- Trade-off explícito que vai surpreender alguém no futuro
- Mudança de uma decisão anterior (cria ADR novo com `Supersedes ADR-XXXX`)

**Não escreva ADR para:** decisão reversível em < 1h (escolha de lib de log, formatador), padrão de código (vai no `CLAUDE.md` ou linter), bug fix.

## Status

- `Proposed` — em discussão, não implementado
- `Accepted` — decidido e em vigor
- `Deprecated` — não é mais a abordagem recomendada, mas ainda em uso
- `Superseded by ADR-NNNN` — substituído por outro ADR

## Index

| ID | Título | Status | Data |
|---|---|---|---|
| [ADR-0001](0001-kafka-como-event-bus-interno.md) | Kafka como event bus interno | Accepted | 2026-06-02 |
| [ADR-0002](0002-multi-tenancy-via-header-context.md) | Multi-tenancy via header `X-Tenant-Id` propagado por `context.Context` | Accepted (com migração JWT planejada) | 2026-06-02 |

## Como criar um ADR novo

1. Copie `template.md` → `NNNN-titulo-em-kebab-case.md` com o próximo número.
2. Use o slash command `/adr` se quiser que o Claude rascunhe (invoca o Solutions Architect).
3. Abra PR para discussão antes de marcar `Accepted`.
4. Atualize o index acima.
</content>
</invoke>