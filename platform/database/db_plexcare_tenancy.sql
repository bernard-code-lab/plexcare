-- MySQL dump 10.13  Distrib 9.6.0, for macos26.2 (arm64)
--
-- Host: plexcare-db-dev-do-user-16586437-0.j.db.ondigitalocean.com    Database: db_plexcare_tenancy
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `db_plexcare_tenancy`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `db_plexcare_tenancy` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `db_plexcare_tenancy`;

--
-- Table structure for table `account`
--

DROP TABLE IF EXISTS `account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL COMMENT 'FK lógico a db_plexcare_party.customer(id)',
  `tenant_uuid` char(36) NOT NULL DEFAULT (UUID()) COMMENT 'Identificador externo UUID do tenant — usado em JWT claim tenant_id e exposto a serviços downstream (ADR-0011, Issue #3)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_id_customer` (`id`,`customer_id`),
  UNIQUE KEY `idx_account_tenant_uuid` (`tenant_uuid`),
  KEY `ix_account_customer_id` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account`
--

LOCK TABLES `account` WRITE;
/*!40000 ALTER TABLE `account` DISABLE KEYS */;
INSERT INTO `account` (`id`, `customer_id`) VALUES (1,1),(2,2);
/*!40000 ALTER TABLE `account` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `authorize_state`
--

DROP TABLE IF EXISTS `authorize_state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `authorize_state` (
  `state` varchar(96) COLLATE utf8mb4_unicode_ci NOT NULL,
  `audience` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pkce_challenge` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pkce_method` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `redirect_uri` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nonce` varchar(96) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` datetime(3) NOT NULL,
  PRIMARY KEY (`state`),
  KEY `idx_authorize_state_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `authorize_state`
--

LOCK TABLES `authorize_state` WRITE;
/*!40000 ALTER TABLE `authorize_state` DISABLE KEYS */;
/*!40000 ALTER TABLE `authorize_state` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client`
--

DROP TABLE IF EXISTS `client`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL COMMENT 'party id (P2)',
  `account_id` bigint unsigned NOT NULL,
  `account_customer_id` bigint unsigned NOT NULL,
  `client_profile_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_client_client_profile` (`client_profile_id`),
  KEY `fk_client_account` (`account_id`,`account_customer_id`),
  CONSTRAINT `fk_client_account` FOREIGN KEY (`account_id`, `account_customer_id`) REFERENCES `account` (`id`, `customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_client_client_profile` FOREIGN KEY (`client_profile_id`) REFERENCES `client_profile` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_client_customer_align` CHECK ((`customer_id` = `account_customer_id`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client`
--

LOCK TABLES `client` WRITE;
/*!40000 ALTER TABLE `client` DISABLE KEYS */;
/*!40000 ALTER TABLE `client` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_profile`
--

DROP TABLE IF EXISTS `client_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_profile` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `mobile` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_profile`
--

LOCK TABLES `client_profile` WRITE;
/*!40000 ALTER TABLE `client_profile` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_profile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee`
--

DROP TABLE IF EXISTS `employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `account_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned NOT NULL COMMENT 'party id (P2)',
  PRIMARY KEY (`id`),
  KEY `ix_employee_customer` (`customer_id`),
  KEY `fk_employee_account` (`account_id`,`customer_id`),
  CONSTRAINT `fk_employee_account` FOREIGN KEY (`account_id`, `customer_id`) REFERENCES `account` (`id`, `customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee`
--

LOCK TABLES `employee` WRITE;
/*!40000 ALTER TABLE `employee` DISABLE KEYS */;
INSERT INTO `employee` VALUES (2,2,2);
/*!40000 ALTER TABLE `employee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `idp_user`
--

DROP TABLE IF EXISTS `idp_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `idp_user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `login` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `keycloak_user_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_id` bigint unsigned NOT NULL,
  `account_customer_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_idp_user_keycloak` (`keycloak_user_id`),
  KEY `fk_idp_user_account` (`account_id`,`account_customer_id`),
  CONSTRAINT `fk_idp_user_account` FOREIGN KEY (`account_id`, `account_customer_id`) REFERENCES `account` (`id`, `customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `idp_user`
--

LOCK TABLES `idp_user` WRITE;
/*!40000 ALTER TABLE `idp_user` DISABLE KEYS */;
INSERT INTO `idp_user` VALUES (1,'felipe.kaiser@plexcare.com.br','9fe99a96-01d9-4190-be66-2705b5b2c10e',2,2);
/*!40000 ALTER TABLE `idp_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lockout`
--

DROP TABLE IF EXISTS `lockout`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lockout` (
  `key_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `failures_json` json NOT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lockout`
--

LOCK TABLES `lockout` WRITE;
/*!40000 ALTER TABLE `lockout` DISABLE KEYS */;
/*!40000 ALTER TABLE `lockout` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `outbox`
--

DROP TABLE IF EXISTS `outbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `outbox` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `occurred_at` datetime(3) NOT NULL,
  `enqueued_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `published_at` datetime(3) DEFAULT NULL,
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `last_error` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_outbox_event_id` (`event_id`),
  KEY `idx_outbox_unpublished` (`published_at`,`enqueued_at`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `outbox`
--

LOCK TABLES `outbox` WRITE;
/*!40000 ALTER TABLE `outbox` DISABLE KEYS */;
INSERT INTO `outbox` VALUES (1,'63a3e1fb-3600-401a-98d1-7adc704aaf87','identity.login.failed','{\"reason\": \"keycloak_down\", \"audience\": \"plexcare\", \"identifierKind\": \"email\"}','2026-05-26 05:45:16.164','2026-05-26 05:45:21.206',NULL,0,NULL),(2,'51cfe117-2817-4f61-9273-da67f8f5c830','identity.login.failed','{\"reason\": \"keycloak_down\", \"audience\": \"plexcare\", \"identifierKind\": \"email\"}','2026-05-26 05:46:11.778','2026-05-26 05:46:16.815',NULL,0,NULL),(3,'d783daf6-c997-4750-ba56-a3923858d82b','identity.login.failed','{\"reason\": \"keycloak_down\", \"audience\": \"plexcare\", \"identifierKind\": \"email\"}','2026-05-26 05:51:57.882','2026-05-26 05:52:08.867',NULL,0,NULL),(4,'96bd5346-8725-4f35-960c-942ae2d33110','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"1af3d98b-82b0-411f-a20d-d1830aa273e7\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 05:57:07.712','2026-05-26 05:57:08.284',NULL,0,NULL),(5,'4043a177-4492-4946-955c-c31afe869ab8','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"7b446d9d-a336-4897-b9c0-643822ae80d8\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 05:57:49.996','2026-05-26 05:57:50.367',NULL,0,NULL),(6,'7829c8c7-660f-4115-a7a4-b6e27dd7b1c5','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"0830727f-0259-4540-9c2d-0dc755e17475\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 05:58:47.370','2026-05-26 05:58:47.559',NULL,0,NULL),(7,'cbd9ba2d-c4ec-4f85-81a8-fd5e7628c2cb','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"2544c2f4-9182-4456-b300-f0630494d69b\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:05:59.723','2026-05-26 06:05:59.917',NULL,0,NULL),(8,'b8011b2c-fb35-4ea8-b9ad-b36ed80b94a6','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"1a10c689-e45c-4cb8-8a6c-ad4b724cfd71\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:10:22.082','2026-05-26 06:10:22.374',NULL,0,NULL),(9,'546a5650-0540-47eb-a2f0-8379cdf0e6c3','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"1690ba2f-c9f8-468e-ab7e-700a9df4e074\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:25:13.101','2026-05-26 06:25:14.066',NULL,0,NULL),(10,'cdb6e303-c4fa-4019-a28a-3a62dd624686','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"a0af6d17-df71-4e4a-9c55-93bfac510dd2\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:26:16.935','2026-05-26 06:26:17.159',NULL,0,NULL),(11,'4b81d959-119c-4899-8f31-35d602141fd2','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"e7f05b63-d8f5-4f62-9275-96aa0185ad4c\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:28:19.407','2026-05-26 06:28:19.608',NULL,0,NULL),(12,'7f4441cf-bc56-43e4-994b-aafbfb7e90b2','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"62b8e5d6-09f0-4fd5-b51c-b332076bfb22\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:29:23.570','2026-05-26 06:29:23.787',NULL,0,NULL),(13,'7b84a3be-5d7c-4c27-8fd8-2c3414d30043','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"37e64ce6-34a0-4fe4-af9a-34cb5027099e\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:30:27.975','2026-05-26 06:30:28.274',NULL,0,NULL),(14,'ff333585-545d-4124-819b-53b622c40e06','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"c50e6c3d-dda7-4132-814f-09de779c548b\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:30:37.463','2026-05-26 06:30:37.659',NULL,0,NULL),(15,'00046657-8438-4c1d-9ee0-49b9417c8a93','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"b3cc116b-5484-4216-8339-b998963c10f3\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:31:23.478','2026-05-26 06:31:23.710',NULL,0,NULL),(16,'884a1891-e186-4a43-bbbe-58790f1229c0','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"7f6f4420-80ab-4e79-bf99-4d0cfb2c89ac\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:38:15.678','2026-05-26 06:38:15.949',NULL,0,NULL),(17,'824a0bb3-9047-4630-85a4-dda331f6a5a7','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"e197ed0f-bf5d-4597-973a-e09811a36af3\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:38:38.615','2026-05-26 06:38:38.833',NULL,0,NULL),(18,'25f494b1-8fdb-4682-9f82-6eafc918696b','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"c014173e-578f-476f-8c40-16551286c672\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:40:06.561','2026-05-26 06:40:07.254',NULL,0,NULL),(19,'5ff3ece6-67bb-46b2-a112-0790d4c206d1','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"2a72f2fb-fc0c-4767-86b1-1a0ae76da6fa\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 06:41:49.076','2026-05-26 06:41:49.603',NULL,0,NULL),(20,'acf0ec07-1436-40f6-b922-16735c28c2bd','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"f6bda53c-983c-4a4b-97c5-7003cc7ba235\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 17:15:42.294','2026-05-26 17:15:43.671',NULL,0,NULL),(21,'21fc1ad7-1f44-43dd-8a0a-eb051b45ff62','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"8ff2cbc4-4a4d-4ffa-8005-ab9fe9aadfe9\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 17:50:26.322','2026-05-26 17:50:26.851',NULL,0,NULL),(22,'7ff3df64-1c1d-45da-9d1d-0fa62c110a77','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"a0329efd-45b3-4445-9d2e-018cff5d4ee0\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 21:57:53.685','2026-05-26 21:57:54.471',NULL,0,NULL),(23,'f5d4488d-f6f4-4de1-9066-f0db46403730','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"605050e8-18ba-4118-bb6f-5019491cf5a0\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 22:19:03.791','2026-05-26 22:19:04.327',NULL,0,NULL),(24,'ef8b3441-224f-4f32-938d-e5c35d1cb803','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"f9eee0cc-c0c2-4f03-8963-210b36a6b664\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 23:02:06.468','2026-05-26 23:02:06.862',NULL,0,NULL),(25,'2aa8947e-17b4-44f4-bfaf-eaa4ebbd6ae8','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"4512c3e3-58f4-476d-898b-088060c7ebae\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 23:13:14.309','2026-05-26 23:13:14.598',NULL,0,NULL),(26,'949a4643-a0a3-4a64-8e2b-709044961257','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"e0d97345-242d-45dc-8322-76a4e9a29679\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-26 23:42:50.211','2026-05-26 23:42:50.408',NULL,0,NULL),(27,'54a0b35a-6e42-4954-ac19-3018cfaaf558','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"fe77106b-c1f3-4a8c-bb28-7ab85af8595a\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-27 00:08:52.869','2026-05-27 00:08:53.138',NULL,0,NULL),(28,'a1581120-addf-4bd8-9d40-7aafad2ae8b2','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"f526e471-d100-4e64-b8fc-0343836e3c82\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-27 05:12:49.279','2026-05-27 05:12:49.872',NULL,0,NULL),(29,'21a1d552-3726-467f-915a-b8d16a72a985','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"4d0612d8-72f6-46c4-afe0-40d56fe46629\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-27 14:24:36.637','2026-05-27 14:24:38.216',NULL,0,NULL),(30,'b1ac66a7-240c-4a0a-b722-d83789f66041','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"8b0cfa77-29aa-4f4f-bad9-546607fd53f8\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-27 15:00:31.878','2026-05-27 15:00:32.237',NULL,0,NULL),(31,'f85cf738-adf6-40b9-a4d2-2d833f83a42f','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"7d165230-cc69-40e2-a4d2-0a68742c61fd\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-27 16:28:21.615','2026-05-27 16:28:21.976',NULL,0,NULL),(32,'0290fde0-8288-4c73-a377-ac216f4fd5f5','identity.login.succeeded','{\"audience\": \"plexcare\", \"sessionId\": \"2813c179-164f-4f1b-a32e-4acf13789133\", \"enrichment\": \"complete\", \"identityId\": \"1\", \"identifierKind\": \"email\"}','2026-05-27 16:57:14.805','2026-05-27 16:57:15.055',NULL,0,NULL);
/*!40000 ALTER TABLE `outbox` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session`
--

DROP TABLE IF EXISTS `session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `identity_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `audience` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kc_refresh_token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `refresh_token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_session_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` datetime(3) NOT NULL,
  `revoked_at` datetime(3) DEFAULT NULL,
  `revocation_reason` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_refresh_hash` (`refresh_token_hash`),
  KEY `idx_session_identity` (`identity_id`),
  KEY `idx_session_parent` (`parent_session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session`
--

LOCK TABLES `session` WRITE;
/*!40000 ALTER TABLE `session` DISABLE KEYS */;
INSERT INTO `session` VALUES ('0830727f-0259-4540-9c2d-0dc755e17475','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3NzY5MjcsImlhdCI6MTc3OTc3NTEyNywianRpIjoiMjlmZDM1YjctOWFlYy03OWI5LTNlMmItZGZmM2Q4YzIzZTg2IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiZDYyMjRlOTgtNmFhYS00YzQ2LWIzNzAtNGRlOTFhZGNjNzFlIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.AcCrt8RAjiOAkSSjU5bKGyS-ZHhFds3ymEuoBfiP3quNn-ogRJyfJ9h73qx8DPq_pIb62Jn0SrsvvyHBZMcU6g','838138e8f51ff696b39657cfaa471579abe9981e5b9d4f979985d8ef40f95730',NULL,'2026-05-26 05:58:47.370','2026-05-26 06:13:47.370',NULL,NULL),('1690ba2f-c9f8-468e-ab7e-700a9df4e074','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzg1MTMsImlhdCI6MTc3OTc3NjcxMywianRpIjoiZWM1ZTljODMtMzIwYS0xZGYwLTlhMjgtNWZjMjhjYmY5YWM5IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiYWQwMjYyNmQtNzlhYi00NTgyLTk0MzAtZmRhZjBlZmI2ZjhkIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.egROfgdir1xemU94g3AhTlK-q_pAlaHeNqgSxITRuALUAMwz2Y_5i9a3ZtJjlsc54ejNL8h6ZDrYcI4cngxxfg','7a2f36fac7c1f733434098c5ef6f1c5d104f70485f09ab6e560e479aaaebd7df',NULL,'2026-05-26 06:25:13.101','2026-05-26 06:40:13.101',NULL,NULL),('1a10c689-e45c-4cb8-8a6c-ad4b724cfd71','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzc2MjIsImlhdCI6MTc3OTc3NTgyMiwianRpIjoiMzVjNTg0ZDQtZmEyZi05MzE2LWFlZGEtOWM3MTdhNTg3MWQwIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiMmYzNDM5MDYtMjdlYy00YTQ0LTliY2MtZjk2MTlkNjU2MjI1Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.dJADJdzSKiReaPomtSKMBWHAU8E1bnJR2OFxhAs8thrrB0KWcLboZcqTbo_97Fxz-IGgPeswtaophPnDzpwaTA','0c4936a7663ebc85102d6e9cafca7e681c0274b486a624b577cf4405786de6d9',NULL,'2026-05-26 06:10:22.082','2026-05-26 06:25:22.082',NULL,NULL),('1af3d98b-82b0-411f-a20d-d1830aa273e7','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3NzY4MjcsImlhdCI6MTc3OTc3NTAyNywianRpIjoiZTIyYTFjZGEtYWI3My0xYjEzLWU1MmItZjU4Y2E3YzM3ZTRlIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiMjU3NWI5MDYtN2YwZC00NThjLWIwM2MtYmFlMGQzNzM1MWI3Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.gpCH3vDyc5Qn7441WrGzN-VxnLY3uCKNmx9q1klNGN5qOs0HwDnxDpqA0sYA2Pzk-lyVMkJz9CDSquIp1yZt_Q','7fd22cd907514b19e73fccd7a0102070a45eb9d20f5046892dcdec5966bf5434',NULL,'2026-05-26 05:57:07.712','2026-05-26 06:12:07.712',NULL,NULL),('2544c2f4-9182-4456-b300-f0630494d69b','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3NzczNTksImlhdCI6MTc3OTc3NTU1OSwianRpIjoiMjU1OGY3OGItZmU0Ni04MjM0LTM1YmYtYWViYjU2MmVjNzkxIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiYjRiNzU1NzUtYjYxYi00ZTk0LThmMTItMWI1MjVlNDBmZjJlIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.NCKKWhQTsEGMRo8rJNcOTIgvHFnVJaoJl1AQyWeBeZrFXbzV64uY6Gcslit9i_61p_shoH-S-Ov1ZN17x3Gweg','b30d0500cc79c8ca37fc07e6342cf73ef5d364cb4def1907178d451e7d5ad873',NULL,'2026-05-26 06:05:59.723','2026-05-26 06:20:59.723',NULL,NULL),('2813c179-164f-4f1b-a32e-4acf13789133','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk5MDI4MzQsImlhdCI6MTc3OTkwMTAzNCwianRpIjoiMjcwNTEzY2YtMTY3NS04Y2YwLTE5MDgtYzMyZjE2MjM1NzQxIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiZTI5Zjc1OTYtNGJhOC00ZTM2LWFiZDctMTU5MmYwZTZhMmJiIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.2y8H5mZWuGJkV61bqY0Bt5kbD5V6aFpGNmZ9m4fQPWGfRZkcK8wO0cZV05h105YchfhXvW_27nMJdEsY6GVLVg','ab7c1473bb5b684e69078a3f8312e497f1ae0ea8b9fb00d8f084f96ad48ac506',NULL,'2026-05-27 16:57:14.805','2026-05-27 17:12:14.805',NULL,NULL),('2a72f2fb-fc0c-4767-86b1-1a0ae76da6fa','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzk1MDksImlhdCI6MTc3OTc3NzcwOSwianRpIjoiYmQ0OTAyZTgtZmQ2OC02MjEwLTYyNjYtNTkyODUyNTUxN2E0IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiMzQyMGZlNWUtYzM0Yy00MmQ0LTkyNWYtZDg3NDRkZjMxNDU3Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.4zezb_FLLi-NfBeb4q-BF3eWStCZsJtNmSYUjHS4ARYZtcBHq-UG_oGTPR8G55m24mKOiA8NFWi4rwkocc3jDw','35220572616616409c9a22df9faa3c70546827f590875705a97f9883f272e428',NULL,'2026-05-26 06:41:49.076','2026-05-26 06:56:49.076',NULL,NULL),('37e64ce6-34a0-4fe4-af9a-34cb5027099e','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzg4MjgsImlhdCI6MTc3OTc3NzAyOCwianRpIjoiNGEzNTM5ZmQtNzY5OC1kNjU0LTI1NzktNDJjMTY0MDQxZGNhIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiZjhmMzU3YWYtMDExYy00ZjczLWJhODQtZmQ4YjQxY2IyYmRkIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.0j5SIi-Bn7Jr0SOXDsG_PfDjMMjVjGliABPjjBqCVu-glXRWFD5y01-uxJNl_lI-QLXDrVw7GPxK71EMNczt5g','7640ef67a6b050ebdfb3f2e461a6b68ed0a8c7a2d4a3a948751bcdb97795bdf7',NULL,'2026-05-26 06:30:27.975','2026-05-26 06:45:27.975',NULL,NULL),('4512c3e3-58f4-476d-898b-088060c7ebae','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4Mzg5OTQsImlhdCI6MTc3OTgzNzE5NCwianRpIjoiZTBmNDYyMjUtZDQ4Zi04NzAzLWViNTEtZGI1OGY1OTA5YWI0IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiY2M2ZjQ0NDktODUxZi00ZTcyLTkzODQtZTlkOTI0MGIwZGI4Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.OkfEWrf4BrczcmiCimqjftSOKEjqviItZ1gKc_1zA-bQA2z9vWGjBd_lBxopbqEgsaEk0r-eLloJPP5jztzCvQ','caef6e9be2242b9175bc9f945d7cca670819277cd03773bcffa8821a43684806',NULL,'2026-05-26 23:13:14.309','2026-05-26 23:28:14.309',NULL,NULL),('4d0612d8-72f6-46c4-afe0-40d56fe46629','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4OTM2NzcsImlhdCI6MTc3OTg5MTg3NywianRpIjoiOWJlMzVmOTUtOWI2YS0wZGZmLTQ0NjgtMjVkMjhjN2MzYzRlIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiMTRiMzhjNzUtMDU4Zi00M2E4LWIxMWItNjQ4YTZjZmI0YTc3Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.tVOkHBxjawbWpzvW2pYwy0RA0BNlzAKdC_ISBGYd3gwW2MTB9AGN2MQ23oywDtlzZF7AdgytYVQbcHYENHLD-w','8d6f75ea7576f9568f770674eb48da4cf19d732ec576635c077db6aab807cfa2',NULL,'2026-05-27 14:24:36.637','2026-05-27 14:39:36.637',NULL,NULL),('605050e8-18ba-4118-bb6f-5019491cf5a0','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4MzU3NDQsImlhdCI6MTc3OTgzMzk0NCwianRpIjoiYjBmZTA5ZjAtODkzZi1lNGVmLWJhNzUtMTViMmJiNTAxNzFmIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiZjI5ZWMxYzctMDliYi00MDllLWExZjAtNGIxMDk3MTg3MzY5Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.xPft1T0hW0WIOrALXbxoiVrHJxAByDb9SQPv_NDDWstP9Hns3BMBjqOfY4dHmDXWN1nScA8nVzEhK8ecs2ec0Q','45d1f9d4148905f792fcb7069611da23005974792ebce9eb727bc6de73d9ebf5',NULL,'2026-05-26 22:19:03.791','2026-05-26 22:34:03.791',NULL,NULL),('62b8e5d6-09f0-4fd5-b51c-b332076bfb22','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzg3NjMsImlhdCI6MTc3OTc3Njk2MywianRpIjoiYjk4NjI2YmMtYzVjNC1lYTQwLWYyMDQtMWUzNjFhYzg2YWRlIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiNTVkMzVlMmEtMjc5Ny00NDQwLTgyYjEtMDYzNzkxN2I0OWFlIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.pDPMwdP0Mhw3v7gYJhHRK4wt6yXBbQ20AkbGp4y0sL6mTgacGfgw9CNDZ1DsjdXfUr5uitfGJ4zZY_aXhh1qdg','644a2b96bd610474b24f111e1b144884ff8a21169088a0ef1c49d3101e7e3f0c',NULL,'2026-05-26 06:29:23.570','2026-05-26 06:44:23.570',NULL,NULL),('7b446d9d-a336-4897-b9c0-643822ae80d8','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3NzY4NzAsImlhdCI6MTc3OTc3NTA3MCwianRpIjoiZjYyMTQ5ZDgtMjZlOS1kODFmLWZhZDItN2FhMmM5MjYxN2I0IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiNjMxMzY4NzgtNzFkYi00YmM0LThhMjctZWMyYTYwZTEyNjkzIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.lEIOaFHvlIVaKUNQx1_9EUBufT6aqVrMvV-c_yqFQpRlPh4nDCpFUsR1PTQoyGmdEameoHZp1lvlAiXtPoqOxQ','8c8daeed18a6352cc48d5d12c3128da7e9cebda3e797266a6450511eba40d263',NULL,'2026-05-26 05:57:49.996','2026-05-26 06:12:49.996',NULL,NULL),('7d165230-cc69-40e2-a4d2-0a68742c61fd','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk5MDExMDEsImlhdCI6MTc3OTg5OTMwMSwianRpIjoiZGRmMGQ3YWYtYWQ1YS0xODM5LWI4ZTUtMjRjYzJlNzQ4YTRlIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiODg5NmNjYzctNmVjYS00ZDljLWFhNzYtOGMxYWQyODE4N2UzIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.gutWfCWZ2LCpB1vbpkyzviy5SeJWbBDhDwLN8o8fqILdkFoy4sXq9mIQ2x7jtsRA9RRMdeX2owV0JlknJbcC8A','d704e2364702c245ecf1effee68b3ab5953b6d7c796ce428747cf59c43785fcd',NULL,'2026-05-27 16:28:21.615','2026-05-27 16:43:21.615',NULL,NULL),('7f6f4420-80ab-4e79-bf99-4d0cfb2c89ac','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3NzkyOTUsImlhdCI6MTc3OTc3NzQ5NSwianRpIjoiNmRhOTQ3MjQtNDc4Ny1jNzk4LWJiOGYtZjkxMDQ2MTYxZDQ2IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiYzUwYmZhOTItNWI0Mi00OTYxLTlmYzctNjhhYzgyY2ZhZjg3Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.zcsOvHb5hF8OvB-8OGwNAIdGZKunzLNuJCr80dmVrx1H7_hlQq5hLfjDSkf57w_YgGWJnRC8sCwLCvn13AGa7A','68a17e4e5cb37a6197a62e3c584774809ebb40ccdf3afeb6738de630aa72cf79',NULL,'2026-05-26 06:38:15.678','2026-05-26 06:53:15.678',NULL,NULL),('8b0cfa77-29aa-4f4f-bad9-546607fd53f8','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4OTU4MzIsImlhdCI6MTc3OTg5NDAzMiwianRpIjoiOTQyYTJkOWEtNGNlMS0wM2QyLTlmOWItYmQwZTJiZmE2YTBhIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiNTM5Zjg2Y2YtOTA0MS00YmMwLWFjY2MtNGY0ZGMyYjE0YjMwIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.XutcCCc9_a9Yn1kq-BPK_Y_U9DmdSvSRtP6wLqOWr_mQF9Z0WMiFe9b1COuJ3h9b3E537hc0ltGhe-QciHcIrQ','a378f8ca26afcfb6c343cdbc1588582708e893a94eefb57dea9ecf0eefd22a2f',NULL,'2026-05-27 15:00:31.878','2026-05-27 15:15:31.878',NULL,NULL),('8ff2cbc4-4a4d-4ffa-8005-ab9fe9aadfe9','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4MTk2MjYsImlhdCI6MTc3OTgxNzgyNiwianRpIjoiYjJmYzU4ZmItMDgyMi1mZDQ3LTkyZjMtYjBkZmU5MmQ0OTJhIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiNjMxYjZhZGQtYWU0OC00Mzk2LWIzODQtY2Y2NDdhZDc0NTYwIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.p3z_f2v9uKQzc5zAiAdve0cCFoUWWkng5RD5MMw2ikw9ncdxBF4HafwvLIQOb9KpKzQs9VvgjCv08QPQB4gTkg','c24f8f3499b121969659160064b5fbdad70848f95bc5acb7623bb8d68783e716',NULL,'2026-05-26 17:50:26.322','2026-05-26 18:05:26.322',NULL,NULL),('a0329efd-45b3-4445-9d2e-018cff5d4ee0','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4MzQ0NzQsImlhdCI6MTc3OTgzMjY3NCwianRpIjoiZTVkNDg2YTEtY2Y1YS05NGZjLWRmZGEtYmZjZDBiYjljYWJlIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiMmU1Y2YwNmMtODJiMC00ZmQ3LWFiYTMtNDY5YWI2NjZkYjA0Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.7AEqbdsmYHlH13tPNywv_CVRl9I86CtoIespn7XexJCs3Gu8gA4uNsltGOB-3snQLKY6MhAx_aQEij4_g---kQ','412287b3f2bcf612b646c4d6e739e198d9a69960508e620d5fddc4782c5050cd',NULL,'2026-05-26 21:57:53.685','2026-05-26 22:12:53.685',NULL,NULL),('a0af6d17-df71-4e4a-9c55-93bfac510dd2','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzg1NzcsImlhdCI6MTc3OTc3Njc3NywianRpIjoiMDFmYTM3OGQtNmI4Yy05MDM1LTg5ZjUtMDQ3ODBiZDc2ODNhIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiZjJjMDk0ZjctZjVjYi00MDQwLThkNTctZWNiNzhmZDMyYTczIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.vjgDumC6BKLhjV5cfqFyx_Ae1oE5VDNWBz7pKuD3rj1VHrY25SyCf8UAcWMyyahAhJeNPGB8ovO3y68uTtuN3w','5782a0c5675c8b7b893dfae571a8b4053183fa4e5889ced69055e302ad336167',NULL,'2026-05-26 06:26:16.935','2026-05-26 06:41:16.935',NULL,NULL),('b3cc116b-5484-4216-8339-b998963c10f3','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzg4ODMsImlhdCI6MTc3OTc3NzA4MywianRpIjoiNWE3OWNmYTMtNWJlNC0zM2IzLTdjMTctZmE5ZDM3MmY2NmU2IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiMTlmYTlmYTUtNGEzOC00ODAwLWIzMmQtMWY3NjQ0MWNmOTIyIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.yVHQo4v_UomcAqBLg26qfSiMLJHLrhqwU8JsNGzVpFzYrlU7Th5MiOL2T5ELZIFNGglQ7GqoFbegzKtm173c4A','b5a692c79eef6f0ca8ae0489f82a39d5727bbb08156e3e049e44d3a764179ef0',NULL,'2026-05-26 06:31:23.478','2026-05-26 06:46:23.478',NULL,NULL),('c014173e-578f-476f-8c40-16551286c672','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzk0MDYsImlhdCI6MTc3OTc3NzYwNiwianRpIjoiYWU2NGRjOGItNDVhYy0wMTllLTdiOWYtM2Q5ODE3NmI4ODNmIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiYmIxZWE1YjMtNmZiMi00ODBhLTk1YWEtMTI4NDg3MTU2YTAxIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.yH_vPdYdZytudKxXPlohLrksJSmprIYs-wDMoCP-WDLbtZcB8wOR_jHekJCMwvs29k20B7pLoTDVYF5lx_1M9Q','82bde32b46417c364c57405af09c07c61c6fda16d096991aecf5288c7154249e',NULL,'2026-05-26 06:40:06.561','2026-05-26 06:55:06.561',NULL,NULL),('c50e6c3d-dda7-4132-814f-09de779c548b','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzg4MzcsImlhdCI6MTc3OTc3NzAzNywianRpIjoiZTEyY2RiNGYtZjNjOS1lNzI0LWIzZjQtYjExODNiYjEwODU3IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiYTBjN2VkNjMtYTJlYi00YzU1LWFiNWItZTI2YTE4N2U3M2I1Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.mbntAPRYM-wUOAbB9cwSp7twdwjyJVZUrr7QlTZ2MIn2E9oS9-F7ThZUTIj2dB4st7tSZ57mk1c_h3zNvd0HAw','0e243662ab87338bb8d7bb5405f8fc72d81473cd036ef332472ab32e9c822572',NULL,'2026-05-26 06:30:37.463','2026-05-26 06:45:37.463',NULL,NULL),('e0d97345-242d-45dc-8322-76a4e9a29679','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4NDA3NzAsImlhdCI6MTc3OTgzODk3MCwianRpIjoiZjlmM2M5ODUtZDRhMS0xZWIwLTJhYjctYjgwZmMyM2NlZjdlIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiMzNkNzZjNmEtZDY3Ni00NWY4LThiOWItZWYwMTg2NjJiZTczIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.OIENik1DvzQJVgsRfCBWNpDWf-FrjDUBpp5nViPQ_FUb5MytAX88XVz-KY67u_n5-z13cp7Ctf7i5apUlQrb-A','0886c548a1368e608a43c9a3ea6b65698077dd539f754e6e5f3ffd2fbe96cb91',NULL,'2026-05-26 23:42:50.211','2026-05-26 23:57:50.211',NULL,NULL),('e197ed0f-bf5d-4597-973a-e09811a36af3','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3NzkzMTgsImlhdCI6MTc3OTc3NzUxOCwianRpIjoiZTc5MjY1MmItNWE2Yy01OThlLTVmYzctNTliOTMwNjU5OThlIiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiODc3OGNmMzItODY3MC00NTRhLWEzMzMtZDkzYmJhMzcxYmM3Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.BWzcRRhPKfOOJEby1M7cv0304ZQnQJxBHVq2UClm8owZh9AIAbQPLiwViTRkNPAbBL0wk85aRspY6CMzHPxsjw','1c0d92a28a0f1fa0eb83a3df96c4952af093d2293e5c3f54d6e713d56f9e0d70',NULL,'2026-05-26 06:38:38.615','2026-05-26 06:53:38.615',NULL,NULL),('e7f05b63-d8f5-4f62-9275-96aa0185ad4c','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk3Nzg2OTksImlhdCI6MTc3OTc3Njg5OSwianRpIjoiOTMxOTdlMjUtNDAwZC0zZTZkLThkNmQtZTNlNDZmNTQ4NWI3IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiNDg1ZGFmZDQtMDNjMC00ZTExLWFjZmUtMDYxOWNiMWE0ZGQ1Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.oWPbwYdAm1Da0oyJn--rD8F0WZnIv7j1jIcuWXEZ4Kj1is0MeyP7M0Zn2EzRLWHnbL-eF7s97sPvRI7dzP3I2A','60a66c7d5a4741eb277ac2eeb8258547e3282e2a36f1042f2985ed5c8395e60a',NULL,'2026-05-26 06:28:19.407','2026-05-26 06:43:19.407',NULL,NULL),('f526e471-d100-4e64-b8fc-0343836e3c82','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4NjA1NjksImlhdCI6MTc3OTg1ODc2OSwianRpIjoiOGZhMGY1YWQtYTYzOS04YmJlLTljZGEtNzU1NjMzZDdlN2Q3IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiZjQ1OGM0NWQtNjIzYS00ZWNjLWJjNzYtYjQ5ZDhkMzBmY2Y5Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.Btkt_2U6zXw5C3PjQ63Lt3AM5cG33NIvbCvSQh0IP9u9qZfCZID5SO0q5MrEJ6Ra8pfRVStSZEbM1HLHGCOApw','5fd461266f207b7bc43ae863d1486ae0a8a67b765351e586a8a3f5c5993fffb1',NULL,'2026-05-27 05:12:49.279','2026-05-27 05:27:49.279',NULL,NULL),('f6bda53c-983c-4a4b-97c5-7003cc7ba235','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4MTc1NDMsImlhdCI6MTc3OTgxNTc0MywianRpIjoiYTU0ZTE4Y2ItYzRjOS0zZjVkLTk0MzYtNTMxMThiM2VmZGM3IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiNTU0ZDYyZjMtYTkwYi00MGE3LTlkZTctMjM1OGZmNmMyMDYxIiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.on_3cg0BdbUuHOanwEJcRaP67GOqaC-EgNzW7-U83Jn1pUx-dAfl3o0ekLp-z3C4c01qOWQnTQa9p25WL0FVFg','a63860930467c20d3fb95394d4907d12386af630b26b882a2e0e7a442d07d632',NULL,'2026-05-26 17:15:42.294','2026-05-26 17:30:42.294',NULL,NULL),('f9eee0cc-c0c2-4f03-8963-210b36a6b664','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4MzgzMjYsImlhdCI6MTc3OTgzNjUyNiwianRpIjoiZWMwN2FlOTEtYWYyOS1iOWIxLWVjNGQtZmIzMGZmMTU0MmQ0IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiZTA1OTAzMjktM2ViOS00MDcyLWE2YjQtNWYwNTBmMGNlNTQ0Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.ifoMneHQSQXAeG_iUc03NcLKn9_PaU0d9CCC8BhimK9DN8b24eA3LjfEGJHidqzTue945c3GDvtwZlA4Hct3Ig','c86e1918f4d62dddf229c57a5f45f57bb6eb65805266785e7bbca994cfa0d62a',NULL,'2026-05-26 23:02:06.468','2026-05-26 23:17:06.468',NULL,NULL),('fe77106b-c1f3-4a8c-bb28-7ab85af8595a','1','plexcare','eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIxNTUyMzJlNC1hMzM2LTQ0ZjctYjQyMC05YTRmYjlhMWNiYTUifQ.eyJleHAiOjE3Nzk4NDIzMzMsImlhdCI6MTc3OTg0MDUzMywianRpIjoiZjYxZDIzZWMtNDNlYS1jZGQyLTI1YjgtNjY1ZGFlZjRkZmI5IiwiaXNzIjoiaHR0cHM6Ly9kZXZlbG9wLWF1dGgucHJldmlkYXMuY29tLmJyL3JlYWxtcy9wcmV2aWRhcyIsImF1ZCI6Imh0dHBzOi8vZGV2ZWxvcC1hdXRoLnByZXZpZGFzLmNvbS5ici9yZWFsbXMvcHJldmlkYXMiLCJzdWIiOiI5ZmU5OWE5Ni0wMWQ5LTQxOTAtYmU2Ni0yNzA1YjViMmMxMGUiLCJ0eXAiOiJSZWZyZXNoIiwiYXpwIjoicG9ydGFsLXByZXZpZGFzIiwic2lkIjoiNzBhMmNkNDItNDExZi00NDNmLWE3OTQtYTJmYzQ1MTllMDc4Iiwic2NvcGUiOiJvcGVuaWQgYmFzaWMgYWNyIHByb2ZpbGUgd2ViLW9yaWdpbnMgZW1haWwgcm9sZXMifQ.M2eWALP5bByP5xaPqc-iI2gms3assw7Ov7Wxf_0aUjZ4I-5FeG8DJLCJQrZVmfHGdcgcwhigLbEd_Q3orD02Pw','5c079227eddec1ad10bb4e015212ce20465497806425a6da2d47839e0932b2f4',NULL,'2026-05-27 00:08:52.869','2026-05-27 00:23:52.869',NULL,NULL);
/*!40000 ALTER TABLE `session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'db_plexcare_tenancy'
--

--
-- Dumping routines for database 'db_plexcare_tenancy'
--
--
-- WARNING: can't read the INFORMATION_SCHEMA.libraries table. It's most probably an old server 8.0.45.
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-04  1:50:39

-- =============================================================================
-- IDP module — added 2026-06-04 (mirror of platform/backend/plexcare-idp-api migrations).
-- Source of truth for the application is the Prisma migrations directory.
-- This block exists so the legacy SQL dump alone still bootstraps a complete DB.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `idp_user_role` (
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

CREATE TABLE IF NOT EXISTS `idp_session` (
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

CREATE TABLE IF NOT EXISTS `idp_signing_key` (
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

CREATE TABLE IF NOT EXISTS `idp_client` (
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

CREATE TABLE IF NOT EXISTS `idp_cron_lock` (
  `name` VARCHAR(64) NOT NULL,
  `holder` VARCHAR(255) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration 20260605000001 — bind authorize_state row to the authenticated
-- idp_user (closes auth-bypass in /v1/token issuance). Applied idempotently
-- via dynamic SQL so the dump is safe to load on any DB state.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'authorize_state' AND column_name = 'idp_user_id'
);
SET @stmt := IF(@col_exists = 0,
  'ALTER TABLE `authorize_state` ADD COLUMN `idp_user_id` BIGINT UNSIGNED NULL AFTER `nonce`, ADD COLUMN `email_verified` TINYINT(1) NULL AFTER `idp_user_id`, ADD KEY `idx_authorize_state_idp_user` (`idp_user_id`)',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS `idp_idempotency` (
  `key` VARCHAR(128) NOT NULL,
  `route` VARCHAR(128) NOT NULL,
  `response_status` SMALLINT NOT NULL,
  `response_body` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`, `route`),
  KEY `idp_idempotency_expiresAt_idx` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
