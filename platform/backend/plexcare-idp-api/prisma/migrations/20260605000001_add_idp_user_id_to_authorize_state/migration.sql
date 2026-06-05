-- Migration: add idp_user_id to authorize_state
-- Closes a P0 security flaw: previously the /v1/token exchange could not
-- recover the authenticated user identity from the PKCE state, falling back
-- to "latest registered user". This column lets /v1/auth/login persist the
-- authenticated idp_user.id so /v1/token issues tokens for the right user.
-- Nullable to keep compatibility with rows created before this migration.

ALTER TABLE `authorize_state`
  ADD COLUMN `idp_user_id` BIGINT UNSIGNED NULL AFTER `nonce`,
  ADD COLUMN `email_verified` TINYINT(1) NULL AFTER `idp_user_id`,
  ADD KEY `idx_authorize_state_idp_user` (`idp_user_id`);
