# plexcare-backend

**Responsabilidade:** APIs, serviços de domínio e regras de negócio da PlexCare.

## Escopo
- Agendamento multicanal (Google, iOS, WhatsApp) e IA anti-no-show
- Laudo digital (assinatura ICP-Brasil) e marketplace jurídico
- Teleconsulta (salas, tokens, metering, billing)
- Autenticação multi-tenant, consentimento eletrônico (LGPD/CFM 2.314/2022)

## Stack prevista
- NestJS ou Go (EKS)
- PostgreSQL (transacional), Redis (cache/rate limit), Kafka/SQS (eventos)
- Stripe/Iugu (billing)

## Não é responsabilidade daqui
Renderização de UI, provisionamento de infra e definição de SLOs/alertas.
