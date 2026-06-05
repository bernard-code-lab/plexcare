-- Migration: add idp_idempotency
-- Cache of responses for Idempotency-Key header.
-- TTL 15 min default. Purger removes expired rows.

CREATE TABLE `idp_idempotency` (
  `key` VARCHAR(128) NOT NULL,
  `route` VARCHAR(128) NOT NULL,
  `response_status` SMALLINT NOT NULL,
  `response_body` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`, `route`),
  KEY `idp_idempotency_expiresAt_idx` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
