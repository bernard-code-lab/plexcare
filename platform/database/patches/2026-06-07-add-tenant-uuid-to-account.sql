-- Patch idempotente para ambientes existentes do schema db_plexcare_tenancy.
-- Source-of-truth do schema é platform/database/db_plexcare_tenancy.sql
-- (estratégia "tabela compartilhada gerenciada externamente" — ver CLAUDE.md
-- do idp-api, gotcha "Tabelas pré-existentes em db_plexcare_tenancy são
-- apenas mapeadas no Prisma").
--
-- Contexto: ADR-0011 §D-1 (refinado em 2026-06-07) + Issue #3.
-- O idp-api NÃO emite migration Prisma sobre `account` porque outros serviços
-- do monorepo (care/catalog/party/settlement) também mapeiam essa tabela.
--
-- Aplicar com:
--   mysql -u <user> -p db_plexcare_tenancy < 2026-06-07-add-tenant-uuid-to-account.sql
--
-- Em dev local (docker-compose), o dump já contém a coluna; este patch é
-- apenas para ambientes que rodaram o dump em data anterior a 2026-06-07.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'account'
     AND COLUMN_NAME = 'tenant_uuid'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `account` ADD COLUMN `tenant_uuid` CHAR(36) NOT NULL DEFAULT (UUID()) COMMENT ''Identificador externo UUID do tenant — usado em JWT claim tenant_id (ADR-0011, Issue #3)''',
  'SELECT ''tenant_uuid já existe em account, skip ALTER'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'account'
     AND INDEX_NAME = 'idx_account_tenant_uuid'
);

SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `account` ADD UNIQUE KEY `idx_account_tenant_uuid` (`tenant_uuid`)',
  'SELECT ''idx_account_tenant_uuid já existe, skip ALTER'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
