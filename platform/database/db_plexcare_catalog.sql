-- MySQL dump 10.13  Distrib 9.6.0, for macos26.2 (arm64)
--
-- Host: plexcare-db-dev-do-user-16586437-0.j.db.ondigitalocean.com    Database: db_plexcare_catalog
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
-- Current Database: `db_plexcare_catalog`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `db_plexcare_catalog` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `db_plexcare_catalog`;

--
-- Table structure for table `feature`
--

DROP TABLE IF EXISTS `feature`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feature` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_kind` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'int|bool|string|json',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feature_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feature`
--

LOCK TABLES `feature` WRITE;
/*!40000 ALTER TABLE `feature` DISABLE KEYS */;
INSERT INTO `feature` VALUES (1,'max_users','Limite de utilizadores por conta','int'),(2,'max_agenda_slots_month','Limite mensal de agendamentos (Docfor)','int'),(3,'copilot_ia_franquia','Copilot escritório — franquia IA','int'),(4,'ques_ia_ativo','Módulo Quesitos IA (plexcare)','bool'),(5,'central_oportunidades_ativo','Central de oportunidades (plexcare)','bool'),(6,'consulta_jur_orientativa_ativo','Consulta jurídica orientativa (plexcare)','bool'),(7,'historico_clin_basico_ativo','Histórico clínico básico (Docfor)','bool'),(8,'teleconsulta_agenda_ativo','Agenda com suporte a teleconsulta (Docfor)','bool');
/*!40000 ALTER TABLE `feature` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan`
--

DROP TABLE IF EXISTS `plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan`
--

LOCK TABLES `plan` WRITE;
/*!40000 ALTER TABLE `plan` DISABLE KEYS */;
INSERT INTO `plan` VALUES (1,'prev_starter_escritorio','plexcare Starter — escritório compacto'),(2,'prev_business_escritorio','plexcare Business — escritório com IA e oportunidades'),(3,'prev_enterprise_escritorio','plexcare Enterprise — pacote escritório amplo'),(4,'docfor_clin_basico','Docfor — plano essencial clínico'),(5,'docfor_clin_pro','Docfor — plano clínico com histórico');
/*!40000 ALTER TABLE `plan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_feature`
--

DROP TABLE IF EXISTS `plan_feature`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_feature` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `plan_id` bigint unsigned NOT NULL,
  `feature_id` bigint unsigned NOT NULL,
  `value_int` bigint DEFAULT NULL,
  `value_bool` tinyint(1) DEFAULT NULL,
  `value_string` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_feature` (`plan_id`,`feature_id`),
  KEY `fk_plan_feature_feature` (`feature_id`),
  CONSTRAINT `fk_plan_feature_feature` FOREIGN KEY (`feature_id`) REFERENCES `feature` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plan_feature_plan` FOREIGN KEY (`plan_id`) REFERENCES `plan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_feature`
--

LOCK TABLES `plan_feature` WRITE;
/*!40000 ALTER TABLE `plan_feature` DISABLE KEYS */;
INSERT INTO `plan_feature` VALUES (1,1,1,10,NULL,NULL,NULL),(2,1,5,NULL,0,NULL,NULL),(3,1,6,NULL,0,NULL,NULL),(4,1,4,NULL,0,NULL,NULL),(5,1,3,0,NULL,NULL,NULL),(6,2,1,50,NULL,NULL,NULL),(7,2,5,NULL,1,NULL,NULL),(8,2,6,NULL,1,NULL,NULL),(10,2,3,50000,NULL,NULL,NULL),(11,2,4,NULL,0,NULL,NULL),(12,3,1,200,NULL,NULL,NULL),(13,3,5,NULL,1,NULL,NULL),(14,3,6,NULL,1,NULL,NULL),(15,3,4,NULL,1,NULL,NULL),(16,3,3,250000,NULL,NULL,NULL),(17,4,2,120,NULL,NULL,NULL),(18,4,1,10,NULL,NULL,NULL),(19,4,7,NULL,0,NULL,NULL),(20,4,8,NULL,1,NULL,NULL),(21,5,2,800,NULL,NULL,NULL),(22,5,1,40,NULL,NULL,NULL),(23,5,7,NULL,1,NULL,NULL),(24,5,8,NULL,1,NULL,NULL);
/*!40000 ALTER TABLE `plan_feature` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_price`
--

DROP TABLE IF EXISTS `plan_price`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_price` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `amount` decimal(12,2) NOT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BRL',
  `start_at` datetime(6) DEFAULT NULL,
  `end_at` datetime(6) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `plan_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_plan_price_plan` (`plan_id`),
  CONSTRAINT `fk_plan_price_plan` FOREIGN KEY (`plan_id`) REFERENCES `plan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_price`
--

LOCK TABLES `plan_price` WRITE;
/*!40000 ALTER TABLE `plan_price` DISABLE KEYS */;
INSERT INTO `plan_price` VALUES (1,299.90,'BRL','2026-05-11 02:57:32.358340',NULL,1,1),(2,599.90,'BRL','2026-05-11 02:57:33.223904',NULL,1,2),(3,1499.90,'BRL','2026-05-11 02:57:34.078485',NULL,1,3),(4,249.90,'BRL','2026-05-11 02:57:34.931004',NULL,1,4),(5,499.90,'BRL','2026-05-11 02:57:35.796419',NULL,1,5);
/*!40000 ALTER TABLE `plan_price` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_product`
--

DROP TABLE IF EXISTS `plan_product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_product` (
  `plan_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`plan_id`,`product_id`),
  KEY `fk_plan_product_product` (`product_id`),
  CONSTRAINT `fk_plan_product_plan` FOREIGN KEY (`plan_id`) REFERENCES `plan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plan_product_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_product`
--

LOCK TABLES `plan_product` WRITE;
/*!40000 ALTER TABLE `plan_product` DISABLE KEYS */;
INSERT INTO `plan_product` VALUES (1,1),(2,1),(3,1),(1,2),(2,2),(3,2),(1,3),(2,3),(3,3),(1,4),(2,4),(3,4),(2,5),(3,5),(3,6),(4,7),(5,7),(5,8);
/*!40000 ALTER TABLE `plan_product` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product`
--

DROP TABLE IF EXISTS `product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vertical_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_code` (`code`),
  KEY `fk_product_vertical` (`vertical_id`),
  CONSTRAINT `fk_product_vertical` FOREIGN KEY (`vertical_id`) REFERENCES `vertical` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product`
--

LOCK TABLES `product` WRITE;
/*!40000 ALTER TABLE `product` DISABLE KEYS */;
INSERT INTO `product` VALUES (1,'plexcare_CORE','plexcare — núcleo escritório',5),(2,'plexcare_AREA_PREVI','plexcare — módulo previdenciário',1),(3,'plexcare_AREA_TRABALHO','plexcare — módulo trabalhista',2),(4,'plexcare_AREA_TRIBUTARIO','plexcare — módulo tributário',3),(5,'plexcare_COPILOT','plexcare — Copilot IA',5),(6,'plexcare_QUES_IA','plexcare — Quesitos IA',5),(7,'DOCFOR_CLINICO','Docfor — clínico (agenda, acessos)',4),(8,'DOCFOR_HISTORICO','Docfor — histórico clínico básico',4);
/*!40000 ALTER TABLE `product` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `signature`
--

DROP TABLE IF EXISTS `signature`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `signature` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `plan_id` bigint unsigned NOT NULL,
  `account_id` bigint unsigned NOT NULL COMMENT 'db_plexcare_tenancy.account(id) — FK lógico entre BD',
  `account_customer_id` bigint unsigned NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_signature_account` (`account_id`,`account_customer_id`),
  KEY `fk_signature_plan` (`plan_id`),
  CONSTRAINT `fk_signature_plan` FOREIGN KEY (`plan_id`) REFERENCES `plan` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `signature`
--

LOCK TABLES `signature` WRITE;
/*!40000 ALTER TABLE `signature` DISABLE KEYS */;
/*!40000 ALTER TABLE `signature` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vertical`
--

DROP TABLE IF EXISTS `vertical`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vertical` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vertical_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertical`
--

LOCK TABLES `vertical` WRITE;
/*!40000 ALTER TABLE `vertical` DISABLE KEYS */;
INSERT INTO `vertical` VALUES (1,'PREVIDENCIARIO','Previdenciário'),(2,'TRABALHO','Trabalhista'),(3,'TRIBUTARIO','Tributário'),(4,'SAUDE','Saúde (Docfor)'),(5,'GESTAO_ESCRITORIO','Gestão de escritório (transversal)'),(6,'TESTE','teste'),(7,'TESTE_2','teste 2');
/*!40000 ALTER TABLE `vertical` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'db_plexcare_catalog'
--

--
-- Dumping routines for database 'db_plexcare_catalog'
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

-- Dump completed on 2026-06-04  1:50:02
