-- Inicialização do Postgres para Keycloak.
-- Executado UMA VEZ no primeiro start do container (entrypoint padrão do imagem postgres).
-- Quando o cluster já existe em volume, este script é ignorado.

-- Extensões úteis (auditoria, busca por UUID, etc.)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tuning conservador (válido em dev; em prod use parameter group/postgres.conf)
ALTER DATABASE keycloak SET timezone TO 'UTC';
ALTER DATABASE keycloak SET log_statement TO 'ddl';

-- Schema dedicado para o Keycloak (ele cria as tabelas automaticamente na flyway interna)
-- Mantemos o default `public` para não precisar configurar KC_DB_SCHEMA.

COMMENT ON DATABASE keycloak IS 'PlexCare IAM — Keycloak 26 backing store';
