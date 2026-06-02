# plexcare-infra

**Responsabilidade:** infraestrutura como código e plataforma de execução da PlexCare.

## Escopo
- Provisionamento cloud (rede, clusters, bancos, buckets, filas)
- Kubernetes/EKS, Helm charts, ingress, TURN (coturn) para WebRTC
- CI/CD, ambientes (dev/staging/prod) e secrets
- Segurança de base: TLS 1.3, criptografia em repouso, IAM

## Stack prevista
- Terraform (módulos por recurso)
- Kubernetes/EKS, Helm
- GitHub Actions

## Não é responsabilidade daqui
Lógica de negócio, UI e definição de SLOs/alertas (ver `plexcare-sre`).
