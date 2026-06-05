-- Migration: add idp_signing_key
-- Rotates JWKS Ed25519 (active | previous | retired).
-- Private key is encrypted at rest with KEK (env in dev, KMS in prod).

CREATE TABLE `idp_signing_key` (
  `kid` VARCHAR(64) NOT NULL,
  `alg` VARCHAR(16) NOT NULL DEFAULT 'EdDSA',
  `public_jwk` JSON NOT NULL,
  `private_jwk_encrypted` BLOB NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rotated_at` DATETIME(3) NULL,
  PRIMARY KEY (`kid`),
  KEY `idx_idp_key_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
