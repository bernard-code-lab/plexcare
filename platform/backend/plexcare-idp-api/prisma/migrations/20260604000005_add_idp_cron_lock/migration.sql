-- Migration: add idp_cron_lock
-- Distributed cron lock (MySQL-only, no Redis dependency).
-- Used by OutboxWorker, JwksRotator, Purger when replicas > 1.

CREATE TABLE `idp_cron_lock` (
  `name` VARCHAR(64) NOT NULL,
  `holder` VARCHAR(255) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
