-- MySQL dump 10.13  Distrib 9.6.0, for macos26.2 (arm64)
--
-- Host: plexcare-db-dev-do-user-16586437-0.j.db.ondigitalocean.com    Database: db_plexcare_care
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
-- Current Database: `db_plexcare_care`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `db_plexcare_care` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `db_plexcare_care`;

--
-- Table structure for table `appointment`
--

DROP TABLE IF EXISTS `appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `starts_at` datetime(6) NOT NULL,
  `ends_at` datetime(6) NOT NULL,
  `status` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `slot_duration_minutes` int NOT NULL,
  `buffer_minutes` int NOT NULL DEFAULT '0',
  `doctor_patient_access_id` bigint unsigned NOT NULL,
  `availability_week_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_appointment_dpa` (`doctor_patient_access_id`),
  KEY `fk_appointment_availability_week` (`availability_week_id`),
  CONSTRAINT `fk_appointment_availability_week` FOREIGN KEY (`availability_week_id`) REFERENCES `availability_week` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_appointment_dpa` FOREIGN KEY (`doctor_patient_access_id`) REFERENCES `doctor_patient_access` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment`
--

LOCK TABLES `appointment` WRITE;
/*!40000 ALTER TABLE `appointment` DISABLE KEYS */;
/*!40000 ALTER TABLE `appointment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `area_of_expertise`
--

DROP TABLE IF EXISTS `area_of_expertise`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `area_of_expertise` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `show_services` tinyint(1) NOT NULL DEFAULT '1',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_area_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `area_of_expertise`
--

LOCK TABLES `area_of_expertise` WRITE;
/*!40000 ALTER TABLE `area_of_expertise` DISABLE KEYS */;
INSERT INTO `area_of_expertise` VALUES (1,'Previdenciário',0,1,'2026-05-26 07:39:26.440','2026-05-26 07:39:26.440');
/*!40000 ALTER TABLE `area_of_expertise` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `availability`
--

DROP TABLE IF EXISTS `availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `availability` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `date_start` datetime(6) NOT NULL,
  `date_finish` datetime(6) NOT NULL,
  `doctor_specialty_id` bigint unsigned NOT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_doctor_period` (`doctor_specialty_id`,`date_start`,`date_finish`,`deleted_at`),
  KEY `fk_availability_doctor_specialty` (`doctor_specialty_id`),
  CONSTRAINT `fk_availability_doctor_specialty` FOREIGN KEY (`doctor_specialty_id`) REFERENCES `doctor_specialty` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `availability`
--

LOCK TABLES `availability` WRITE;
/*!40000 ALTER TABLE `availability` DISABLE KEYS */;
/*!40000 ALTER TABLE `availability` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `availability_week`
--

DROP TABLE IF EXISTS `availability_week`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `availability_week` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `availability_id` bigint unsigned NOT NULL,
  `week_day` tinyint unsigned NOT NULL COMMENT '0=sun … 6=sat',
  `start_hour` time NOT NULL,
  `end_hour` time NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_availability_day_start` (`availability_id`,`week_day`,`start_hour`),
  KEY `fk_availability_week_availability` (`availability_id`),
  CONSTRAINT `fk_availability_week_availability` FOREIGN KEY (`availability_id`) REFERENCES `availability` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `availability_week`
--

LOCK TABLES `availability_week` WRITE;
/*!40000 ALTER TABLE `availability_week` DISABLE KEYS */;
/*!40000 ALTER TABLE `availability_week` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `benefit_type`
--

DROP TABLE IF EXISTS `benefit_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `benefit_type` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `area_of_expertise_id` bigint unsigned NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_benefit_name_area` (`name`,`area_of_expertise_id`),
  KEY `ix_benefit_area` (`area_of_expertise_id`),
  CONSTRAINT `fk_benefit_area` FOREIGN KEY (`area_of_expertise_id`) REFERENCES `area_of_expertise` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `benefit_type`
--

LOCK TABLES `benefit_type` WRITE;
/*!40000 ALTER TABLE `benefit_type` DISABLE KEYS */;
INSERT INTO `benefit_type` VALUES (1,'Auxílio por Incapacidade Temporária (B31)',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728'),(2,'Aposentadoria por Incapacidade Permanente (B32)',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728'),(3,'Benefício por Incapacidade por Tempo Indeterminado',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728'),(4,'Auxílio-Acidente (B36)',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728'),(5,'BPC/LOAS',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728'),(6,'Aposentadoria por tempo de contribuição ao deficiente',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728'),(7,'Quitação de financiamento habitacional',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728'),(8,'Isenção de Imposto de Renda',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728'),(9,'Outro',1,1,'2026-05-26 07:39:26.728','2026-05-26 07:39:26.728');
/*!40000 ALTER TABLE `benefit_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cdc_audit_log`
--

DROP TABLE IF EXISTS `cdc_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cdc_audit_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source_gtid` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'GTID do MySQL (ou binlog_file:pos quando sem GTID)',
  `source_table` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `op` char(1) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'c=create r=read(snapshot) u=update d=delete',
  `key_affected` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Redis key escrita pelo translator',
  `payload_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SHA-256 hex do payload (para deduplicação extra)',
  `latency_ms` int unsigned DEFAULT NULL COMMENT 'now() - source.ts_ms (drift CDC)',
  `processed_at` bigint unsigned NOT NULL COMMENT 'unix epoch ms',
  `stream_entry_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'XADD id no Redis Stream (ts-seq)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cdc_audit_unique` (`source_gtid`,`source_table`,`op`,`key_affected`),
  KEY `ix_cdc_audit_processed_at` (`processed_at`),
  KEY `ix_cdc_audit_source_table` (`source_table`,`processed_at`),
  KEY `ix_cdc_audit_gtid` (`source_gtid`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cdc_audit_log`
--

LOCK TABLES `cdc_audit_log` WRITE;
/*!40000 ALTER TABLE `cdc_audit_log` DISABLE KEYS */;
INSERT INTO `cdc_audit_log` VALUES (1,'binlog.008208:197','specialty','r','schedule:specialty:catalog','e2f01c72cc00a1050bb68f0346f6e3f92aeb96809537c8081a76a4304d21da21',1655,1779873475655,'1779873475640-0'),(2,'binlog.008208:197','specialty','r','schedule:specialty:1','117257b905ce0db4e12ea2a4000e247a10181cf59c25deb8a91015a8f791e2c3',1655,1779873475655,'1779873475640-0'),(3,'binlog.008208:197','doctor','r','schedule:doctor:12','d5d63957a27624a627eaee83a5141e37a0d00758a266d773d9beb22b8c7b9db6',1679,1779873475679,'1779873475640-0'),(4,'binlog.008208:197','doctor','r','schedule:doctor:18','2305c5a6a5534373ec4ac9a5eedb9fc4b5b83408eabdb8f074c469dc508346af',1685,1779873475685,'1779873475640-1'),(5,'binlog.008208:197','doctor','r','schedule:doctor:20','7496341127bf4483574e9c1060b17095c8235763e3ca45d5d154dc508002cc3b',1692,1779873475692,'1779873475640-2'),(7,'binlog.008208:197','specialty','r','schedule:specialty:2','22fe482e90791ce5ae69a405f005b7f754dbb4a648ed88942ff7354227497e35',1698,1779873475698,'1779873475640-1'),(9,'binlog.008208:197','specialty','r','schedule:specialty:4','756cb57ac844b66b5ff134a0add65ac34fd77ad661d65108ac97ba66cbcde6f0',1727,1779873475727,'1779873475640-2'),(10,'binlog.008208:197','doctor_specialty','r','schedule:specialty:1:doctors','9203e5fd24d59c29fca4cfd999e4a1dda3b5114c3bd89fbf79b73399e5b5dd4f',740,1779873475740,'1779873475640-0'),(11,'binlog.008208:197','doctor_specialty','r','schedule:doctor:18:specialties','1e27472ef6599e20299fd137a08427e02a50ff2e8ff23d792c9ab1b764efdb07',740,1779873475740,'1779873475640-0'),(12,'binlog.008208:197','doctor_specialty','r','schedule:doctor_specialty:9','c24c4d38a7f4eb4d99a17a39aec75d34f7a94302c2a7cc1fcbed4aacb65ac344',740,1779873475740,'1779873475640-0'),(14,'binlog.008208:197','doctor_specialty','r','schedule:doctor:20:specialties','a961505db5ec730fa0462f579243f97a73f3257bc8f97cbea0d0566b768a4bfa',757,1779873475757,'1779873475640-1'),(15,'binlog.008208:197','doctor_specialty','r','schedule:doctor_specialty:10','5bf54cfed8c72679e8761d23d56425a3eb04ba3c6dca3c2166fa4bd372a81254',757,1779873475757,'1779873475640-1'),(17,'binlog.008208:197','doctor_specialty','r','schedule:doctor:12:specialties','d13e2d9830be9f90d190ffb2885484e2fdafe9e3ff7b014f0f66f7bf25ee6fbe',771,1779873475771,'1779873475640-2'),(18,'binlog.008208:197','doctor_specialty','r','schedule:doctor_specialty:15','242ca7766d517adfe91f17f0e927aa3c099e0e19365afe607bb24b9202abce91',771,1779873475771,'1779873475640-2'),(19,'135bf322-435f-11f1-b384-76f5416d1102:8877','specialty','c','schedule:specialty:catalog','ca3792cbcdd47c367528e24ee1244058c0d3e3e4d1c96cc8521587ea9d7593eb',179,1779873483871,'1779873483864-0'),(20,'135bf322-435f-11f1-b384-76f5416d1102:8877','specialty','c','schedule:specialty:6','daf7811f4f3435036e0bf953a50e691fcd929a55a1b21f6a1225e7039fc5208e',179,1779873483871,'1779873483864-0'),(21,'135bf322-435f-11f1-b384-76f5416d1102:8880','specialty','d','schedule:specialty:catalog','1ddb4c194a13094e9ea0a37e95cee974885f1f78da6595b660066f00228715c0',140,1779873513940,'1779873513933-0'),(22,'135bf322-435f-11f1-b384-76f5416d1102:8880','specialty','d','schedule:specialty:6','b63311f103c96986249bb45d0d8ed7fc2e4713527f614aaab569596684799448',140,1779873513940,'1779873513933-0'),(23,'135bf322-435f-11f1-b384-76f5416d1102:8883','specialty','c','schedule:specialty:catalog','c55bac41164467cb0c05cef0f02e94cb2e3ee8b4c53c95a0973b1a6c6cdcd006',24,1779873814604,'1779873814593-0'),(24,'135bf322-435f-11f1-b384-76f5416d1102:8883','specialty','c','schedule:specialty:7','15626a307bd297fa8e6633e7a9f519cb9f2c21a249773f82b9ccc34aa808a3ad',24,1779873814604,'1779873814593-0'),(25,'135bf322-435f-11f1-b384-76f5416d1102:8886','specialty','d','schedule:specialty:catalog','2333bf4bdd8ec3d86d508a6672869825d89e9c8dd2db7481482265b2e860dd86',22,1779873815616,'1779873815612-0'),(26,'135bf322-435f-11f1-b384-76f5416d1102:8886','specialty','d','schedule:specialty:7','3b1121f9009d6424252bae30055975dee52682f0a403b923c36c8e26782ceb0d',22,1779873815616,'1779873815612-0'),(27,'135bf322-435f-11f1-b384-76f5416d1102:8889','specialty','u','schedule:specialty:catalog','e2f01c72cc00a1050bb68f0346f6e3f92aeb96809537c8081a76a4304d21da21',45,1779873965945,'1779873965941-0'),(28,'135bf322-435f-11f1-b384-76f5416d1102:8889','specialty','u','schedule:specialty:1','d20f3811feb546ff95324e644b29b4bccf62e9a7ab25a60acb2ff5fd034854bd',45,1779873965945,'1779873965941-0'),(30,'135bf322-435f-11f1-b384-76f5416d1102:8889','specialty','u','schedule:specialty:2','b52760ef7ee309506cc61a3300eb3734184124a3a9b831529a554ceec3573890',60,1779873965960,'1779873965941-1'),(32,'135bf322-435f-11f1-b384-76f5416d1102:8889','specialty','u','schedule:specialty:4','8394f2ab68db33e9d4a8802551891cb557a8722b6cb8dcc5a7fee46e983b77ce',96,1779873965996,'1779873965943-0'),(33,'135bf322-435f-11f1-b384-76f5416d1102:8890','specialty','u','schedule:specialty:catalog','e2f01c72cc00a1050bb68f0346f6e3f92aeb96809537c8081a76a4304d21da21',528,1779873966459,'1779873966456-0'),(34,'135bf322-435f-11f1-b384-76f5416d1102:8890','specialty','u','schedule:specialty:1','d20f3811feb546ff95324e644b29b4bccf62e9a7ab25a60acb2ff5fd034854bd',528,1779873966459,'1779873966456-0'),(36,'135bf322-435f-11f1-b384-76f5416d1102:8890','specialty','u','schedule:specialty:2','b52760ef7ee309506cc61a3300eb3734184124a3a9b831529a554ceec3573890',541,1779873966472,'1779873966456-1'),(38,'135bf322-435f-11f1-b384-76f5416d1102:8890','specialty','u','schedule:specialty:4','8394f2ab68db33e9d4a8802551891cb557a8722b6cb8dcc5a7fee46e983b77ce',550,1779873966481,'1779873966458-0');
/*!40000 ALTER TABLE `cdc_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor`
--

DROP TABLE IF EXISTS `doctor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL,
  `crm` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `crm_uf` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mobile_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `activated` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_doctor_crm_uf` (`crm`,`crm_uf`),
  UNIQUE KEY `UQ_doctor_customer_id` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor`
--

LOCK TABLES `doctor` WRITE;
/*!40000 ALTER TABLE `doctor` DISABLE KEYS */;
INSERT INTO `doctor` VALUES (12,2,'1','SP','11999998888',1),(18,9,'123456','SP','11999998888',1),(20,11,'12345','SP','11999998888',1);
/*!40000 ALTER TABLE `doctor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_patient_access`
--

DROP TABLE IF EXISTS `doctor_patient_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_patient_access` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `client_id` bigint unsigned NOT NULL COMMENT 'db_plexcare_tenancy.client(id)',
  `doctor_id` bigint unsigned NOT NULL,
  `patient_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_dpa_client` (`client_id`),
  KEY `ix_dpa_doctor` (`doctor_id`),
  KEY `ix_dpa_patient` (`patient_id`),
  CONSTRAINT `fk_dpa_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dpa_patient` FOREIGN KEY (`patient_id`) REFERENCES `patient` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_patient_access`
--

LOCK TABLES `doctor_patient_access` WRITE;
/*!40000 ALTER TABLE `doctor_patient_access` DISABLE KEYS */;
/*!40000 ALTER TABLE `doctor_patient_access` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_specialty`
--

DROP TABLE IF EXISTS `doctor_specialty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_specialty` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `minimum_age` int unsigned DEFAULT NULL,
  `rqe` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `buffer_minutes` int unsigned NOT NULL,
  `slot_duration_minutes` int unsigned NOT NULL,
  `doctor_id` bigint unsigned NOT NULL,
  `specialty_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_doctor_specialty_unique` (`doctor_id`,`specialty_id`),
  KEY `FK_doctor_specialty_specialty` (`specialty_id`),
  CONSTRAINT `FK_doctor_specialty_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_doctor_specialty_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialty` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_specialty`
--

LOCK TABLES `doctor_specialty` WRITE;
/*!40000 ALTER TABLE `doctor_specialty` DISABLE KEYS */;
INSERT INTO `doctor_specialty` VALUES (9,5,'12345',10,30,18,1),(10,5,'12345',10,30,20,1),(15,5,'12345',10,30,12,1);
/*!40000 ALTER TABLE `doctor_specialty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_specialty_practice_area`
--

DROP TABLE IF EXISTS `doctor_specialty_practice_area`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_specialty_practice_area` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `practice_area_id` bigint unsigned NOT NULL,
  `doctor_specialty_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_practice_area_doctor_specialty` (`practice_area_id`,`doctor_specialty_id`),
  KEY `FK_practice_area_doctor_specialty` (`doctor_specialty_id`),
  CONSTRAINT `FK_practice_area_doctor_specialty` FOREIGN KEY (`doctor_specialty_id`) REFERENCES `doctor_specialty` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_specialty_practice_area`
--

LOCK TABLES `doctor_specialty_practice_area` WRITE;
/*!40000 ALTER TABLE `doctor_specialty_practice_area` DISABLE KEYS */;
INSERT INTO `doctor_specialty_practice_area` VALUES (17,10,9),(19,10,10),(18,20,9),(20,20,10),(29,30,15);
/*!40000 ALTER TABLE `doctor_specialty_practice_area` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `indication`
--

DROP TABLE IF EXISTS `indication`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `indication` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL COMMENT 'FK lógico: party.customer.id',
  `area_of_expertise_id` bigint unsigned NOT NULL,
  `benefit_type_id` bigint unsigned NOT NULL,
  `profession` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'campo livre',
  `case_context` text COLLATE utf8mb4_unicode_ci COMMENT 'fatos sobre o cliente',
  `status` enum('draft','scheduled','completed','cancelled','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `created_by_idp_user_id` bigint unsigned DEFAULT NULL COMMENT 'FK lógico: tenancy.idp_user.id (quem criou)',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_indication_customer` (`customer_id`),
  KEY `fk_indication_area` (`area_of_expertise_id`),
  KEY `fk_indication_benefit` (`benefit_type_id`),
  KEY `ix_indication_status` (`status`),
  CONSTRAINT `fk_indication_area` FOREIGN KEY (`area_of_expertise_id`) REFERENCES `area_of_expertise` (`id`),
  CONSTRAINT `fk_indication_benefit` FOREIGN KEY (`benefit_type_id`) REFERENCES `benefit_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `indication`
--

LOCK TABLES `indication` WRITE;
/*!40000 ALTER TABLE `indication` DISABLE KEYS */;
INSERT INTO `indication` VALUES (1,1,1,1,'Motorista de caminhão','TESTE — Smoke deploy schedule-api Fase 4. Cliente sofreu acidente de trabalho em 2024, possui laudos do INSS, busca B31.','archived',NULL,'2026-05-26 15:17:44.204','2026-05-26 15:18:03.000'),(2,2,1,1,'Pedreiro','TESTE — Validação fluxo frontend Fase 5','draft',NULL,'2026-05-26 15:27:30.508','2026-05-26 15:27:30.508'),(3,2,1,2,'teste','teste','draft',NULL,'2026-05-27 00:09:22.945','2026-05-27 00:09:22.945'),(4,2,1,6,'teste','teste','draft',NULL,'2026-05-27 05:13:18.018','2026-05-27 05:13:18.018'),(5,2,1,6,'teste','teste','draft',NULL,'2026-05-27 14:25:11.384','2026-05-27 14:25:11.384'),(6,2,1,6,'teste','teste','draft',NULL,'2026-05-27 14:25:53.953','2026-05-27 14:25:53.953');
/*!40000 ALTER TABLE `indication` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medical_document`
--

DROP TABLE IF EXISTS `medical_document`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medical_document` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL COMMENT 'FK lógico para db_plexcare_party.customer(id)',
  `indication_id` bigint unsigned DEFAULT NULL COMMENT 'FK lógico para db_plexcare_care.indication (criada na fase 4)',
  `file_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'case-summary-documents | partial-questions-documents | medical-report | etc.',
  `storage_key` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'chave no DO Spaces',
  `storage_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL pública (CDN) — cacheada aqui pra evitar regerar',
  `file_name` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'nome original enviado pelo usuário',
  `mime_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint unsigned NOT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_medical_doc_customer` (`customer_id`,`is_deleted`),
  KEY `ix_medical_doc_indication` (`indication_id`,`is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medical_document`
--

LOCK TABLES `medical_document` WRITE;
/*!40000 ALTER TABLE `medical_document` DISABLE KEYS */;
/*!40000 ALTER TABLE `medical_document` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `timestamp` bigint NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient`
--

DROP TABLE IF EXISTS `patient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL COMMENT 'party id (P2)',
  PRIMARY KEY (`id`),
  KEY `ix_patient_party` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient`
--

LOCK TABLES `patient` WRITE;
/*!40000 ALTER TABLE `patient` DISABLE KEYS */;
/*!40000 ALTER TABLE `patient` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `specialty`
--

DROP TABLE IF EXISTS `specialty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `specialty` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `descriptions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `activated` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_specialty_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `specialty`
--

LOCK TABLES `specialty` WRITE;
/*!40000 ALTER TABLE `specialty` DISABLE KEYS */;
INSERT INTO `specialty` VALUES (1,'Cardiologia','Especialidade voltada ao coração.',1),(2,'Oftalmologia','Especialidade voltada aos olhos',1),(4,'Cardiologia 3','Especialidade voltada ao coração',0);
/*!40000 ALTER TABLE `specialty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'db_plexcare_care'
--

--
-- Dumping routines for database 'db_plexcare_care'
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

-- Dump completed on 2026-06-04  1:49:45
