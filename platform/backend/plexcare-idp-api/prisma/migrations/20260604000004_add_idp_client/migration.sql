-- Migration: add idp_client
-- OIDC clients (plexcare-platform-web, plexcare-login-web, etc.).
-- Per-client TTLs and PKCE/confidential flags.

CREATE TABLE `idp_client` (
  `client_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `audience` VARCHAR(64) NOT NULL,
  `redirect_uris` JSON NOT NULL,
  `allowed_grants` JSON NOT NULL,
  `pkce_required` TINYINT(1) NOT NULL DEFAULT 1,
  `confidential` TINYINT(1) NOT NULL DEFAULT 0,
  `secret_hash` VARCHAR(255) NULL,
  `access_token_ttl_seconds` INT NOT NULL DEFAULT 900,
  `refresh_token_ttl_seconds` INT NOT NULL DEFAULT 2592000,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
