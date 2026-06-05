-- Migration: add idp_session
-- Opaque refresh token (UUID v4 as id) with rotation + revocation.
-- Depends on existing table: idp_user.

CREATE TABLE `idp_session` (
  `id` CHAR(36) NOT NULL,
  `idp_user_id` BIGINT UNSIGNED NOT NULL,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `client_id` VARCHAR(64) NOT NULL,
  `user_agent` VARCHAR(512) NULL,
  `ip_address` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `revoke_reason` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_idp_session_user` (`idp_user_id`),
  KEY `idx_idp_session_expires` (`expires_at`),
  CONSTRAINT `fk_idp_session_user` FOREIGN KEY (`idp_user_id`) REFERENCES `idp_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
