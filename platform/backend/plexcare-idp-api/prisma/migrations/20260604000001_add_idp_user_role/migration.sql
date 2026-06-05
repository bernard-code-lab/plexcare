-- Migration: add idp_user_role
-- Multi-role per user per account (doctor | employee | client | admin).
-- Depends on existing tables: idp_user, account.

CREATE TABLE `idp_user_role` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `idp_user_id` BIGINT UNSIGNED NOT NULL,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `account_customer_id` BIGINT UNSIGNED NOT NULL,
  `role` VARCHAR(64) NOT NULL,
  `doctor_id` BIGINT UNSIGNED NULL,
  `client_id` BIGINT UNSIGNED NULL,
  `employee_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_idp_user_role` (`idp_user_id`, `account_id`, `role`),
  KEY `fk_idp_user_role_idp_user` (`idp_user_id`),
  KEY `fk_idp_user_role_account` (`account_id`, `account_customer_id`),
  CONSTRAINT `fk_idp_user_role_idp_user` FOREIGN KEY (`idp_user_id`) REFERENCES `idp_user`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_idp_user_role_account` FOREIGN KEY (`account_id`, `account_customer_id`) REFERENCES `account`(`id`, `customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
