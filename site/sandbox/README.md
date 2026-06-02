# sandbox/

Workspace do PlexCare organizado por **responsabilidade** (taxonomia padronizada).
Cada diretório é um domínio independente, com seu próprio ciclo de vida, donos e deploy.

| Diretório | Responsabilidade | Stack prevista |
|-----------|------------------|----------------|
| [`plexcare-frontend`](./plexcare-frontend) | Interfaces e clientes (web app, landing, portais) | Vite + React + Tailwind |
| [`plexcare-backend`](./plexcare-backend) | APIs, serviços de domínio e regras de negócio | NestJS/Go, PostgreSQL |
| [`plexcare-sre`](./plexcare-sre) | Confiabilidade, observabilidade, on-call | OpenTelemetry, Prometheus/Grafana, runbooks |
| [`plexcare-infra`](./plexcare-infra) | Infraestrutura como código e plataforma | Terraform, Kubernetes/EKS, Helm |

## Convenção de nomes

`plexcare-<domínio>` — prefixo fixo `plexcare-`, domínio em kebab-case, singular por área de responsabilidade.
