# plexcare-sre

**Responsabilidade:** confiabilidade, observabilidade e operação dos serviços PlexCare.

## Escopo
- SLIs/SLOs e error budgets por serviço
- Observabilidade: logs, métricas e traces (OpenTelemetry)
- Dashboards e alertas (burn-rate)
- Runbooks, resposta a incidentes e postmortems
- Auditoria de acesso (compliance telemedicina)

## Stack prevista
- OpenTelemetry, Prometheus, Grafana, Alertmanager
- APM/integrações (Datadog/Grafana Cloud)

## Não é responsabilidade daqui
Implementar features de produto ou provisionar a infra base (ver `plexcare-infra`).
