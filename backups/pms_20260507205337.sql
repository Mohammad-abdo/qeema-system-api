-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: pms
-- ------------------------------------------------------
-- Server version	8.0.46

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
-- Current Database: `pms`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `pms` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `pms`;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('6050fa8f-3e27-44e1-a33d-dc5fcafb3fac','16c1ae5e24fe1f97d0662d1084467a9481576f54bac6ec6519cb04c56b764c9a','2026-05-07 17:50:54.205','20260502120000_work_shift_pause',NULL,NULL,'2026-05-07 17:50:54.169',1),('8fadec23-9102-4f80-8fae-341801e4cdc1','bf684228258d112b8bcae89ffd263bd381f17540c3b899567c14061a0d15adc2','2026-05-07 17:50:54.167','20260428133500_add_work_shifts',NULL,NULL,'2026-05-07 17:50:54.118',1),('c9761c03-9dc8-4209-a5e3-6ef046e75652','b528143755e429710e1c4b893a12c7ee1c9415936f73de1b26ff674a45910022','2026-05-07 17:50:54.116','20260411173848_',NULL,NULL,'2026-05-07 17:50:48.815',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `_taskassignees`
--

DROP TABLE IF EXISTS `_taskassignees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_taskassignees` (
  `A` int NOT NULL,
  `B` int NOT NULL,
  UNIQUE KEY `_TaskAssignees_AB_unique` (`A`,`B`),
  KEY `_TaskAssignees_B_index` (`B`),
  CONSTRAINT `_TaskAssignees_A_fkey` FOREIGN KEY (`A`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_TaskAssignees_B_fkey` FOREIGN KEY (`B`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_taskassignees`
--

LOCK TABLES `_taskassignees` WRITE;
/*!40000 ALTER TABLE `_taskassignees` DISABLE KEYS */;
/*!40000 ALTER TABLE `_taskassignees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action_type` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_category` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_summary` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_details` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performed_by_user_id` int DEFAULT NULL,
  `affected_user_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `entity_type` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `ip_address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `action` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `activity_logs_created_at_idx` (`created_at`),
  KEY `activity_logs_performed_by_user_id_idx` (`performed_by_user_id`),
  KEY `activity_logs_project_id_idx` (`project_id`),
  KEY `activity_logs_action_category_idx` (`action_category`),
  KEY `activity_logs_entity_type_entity_id_idx` (`entity_type`,`entity_id`),
  KEY `activity_logs_affected_user_id_fkey` (`affected_user_id`),
  KEY `activity_logs_user_id_fkey` (`user_id`),
  CONSTRAINT `activity_logs_affected_user_id_fkey` FOREIGN KEY (`affected_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `activity_logs_performed_by_user_id_fkey` FOREIGN KEY (`performed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `activity_logs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `activity_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `uploaded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `task_id` int DEFAULT NULL,
  `uploaded_by_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `attachments_uploaded_by_id_fkey` (`uploaded_by_id`),
  KEY `attachments_task_id_fkey` (`task_id`),
  CONSTRAINT `attachments_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `attachments_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attachments`
--

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `automation_rules`
--

DROP TABLE IF EXISTS `automation_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `automation_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trigger_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trigger_condition` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_config` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_by_id` int NOT NULL,
  `team_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `automation_rules_team_id_fkey` (`team_id`),
  KEY `automation_rules_created_by_id_fkey` (`created_by_id`),
  CONSTRAINT `automation_rules_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `automation_rules_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `automation_rules`
--

LOCK TABLES `automation_rules` WRITE;
/*!40000 ALTER TABLE `automation_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `automation_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comment_mentions`
--

DROP TABLE IF EXISTS `comment_mentions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comment_mentions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `comment_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `comment_mentions_comment_id_user_id_key` (`comment_id`,`user_id`),
  KEY `comment_mentions_user_id_idx` (`user_id`),
  KEY `comment_mentions_comment_id_idx` (`comment_id`),
  CONSTRAINT `comment_mentions_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `comment_mentions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comment_mentions`
--

LOCK TABLES `comment_mentions` WRITE;
/*!40000 ALTER TABLE `comment_mentions` DISABLE KEYS */;
/*!40000 ALTER TABLE `comment_mentions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `content` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `task_id` int DEFAULT NULL,
  `subtask_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `comments_user_id_fkey` (`user_id`),
  KEY `comments_subtask_id_fkey` (`subtask_id`),
  KEY `comments_task_id_fkey` (`task_id`),
  CONSTRAINT `comments_subtask_id_fkey` FOREIGN KEY (`subtask_id`) REFERENCES `subtasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `comments_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliverables`
--

DROP TABLE IF EXISTS `deliverables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliverables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acceptance_criteria` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `deliverables_project_id_fkey` (`project_id`),
  CONSTRAINT `deliverables_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliverables`
--

LOCK TABLES `deliverables` WRITE;
/*!40000 ALTER TABLE `deliverables` DISABLE KEYS */;
/*!40000 ALTER TABLE `deliverables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `forecast_snapshots`
--

DROP TABLE IF EXISTS `forecast_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `forecast_snapshots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `predicted_date` datetime(3) NOT NULL,
  `risk_level` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `confidence` double NOT NULL,
  `explanation` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `forecast_snapshots_entity_type_entity_id_idx` (`entity_type`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forecast_snapshots`
--

LOCK TABLES `forecast_snapshots` WRITE;
/*!40000 ALTER TABLE `forecast_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `forecast_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `labels`
--

DROP TABLE IF EXISTS `labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `labels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `labels_name_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `labels`
--

LOCK TABLES `labels` WRITE;
/*!40000 ALTER TABLE `labels` DISABLE KEYS */;
INSERT INTO `labels` VALUES (1,'Testing','#10b981','Testing and QA','2026-05-07 17:51:24.618'),(2,'Bug','#ef4444','Bug fixes and issues','2026-05-07 17:51:24.618'),(3,'Urgent','#dc2626','Urgent tasks','2026-05-07 17:51:24.618'),(4,'Feature','#3b82f6','New features and enhancements','2026-05-07 17:51:24.618'),(5,'Refactoring','#f59e0b','Code refactoring and improvements','2026-05-07 17:51:24.618'),(6,'Documentation','#8b5cf6','Documentation updates','2026-05-07 17:51:24.618');
/*!40000 ALTER TABLE `labels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `link_url` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_idx` (`user_id`),
  KEY `notifications_created_at_idx` (`created_at`),
  KEY `notifications_is_read_idx` (`is_read`),
  KEY `notifications_user_id_is_read_idx` (`user_id`,`is_read`),
  CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `module` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_key_key` (`key`),
  KEY `permissions_module_idx` (`module`),
  KEY `permissions_category_idx` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'user.create','Create','Permission to create','user',NULL,'2026-05-07 17:51:24.207'),(2,'user.read','Read','Permission to read','user',NULL,'2026-05-07 17:51:24.212'),(3,'user.update','Update','Permission to update','user',NULL,'2026-05-07 17:51:24.215'),(4,'user.delete','Delete','Permission to delete','user',NULL,'2026-05-07 17:51:24.218'),(5,'user.assign_role','Assign Role','Permission to assign role','user',NULL,'2026-05-07 17:51:24.222'),(6,'user.activate','Activate','Permission to activate','user',NULL,'2026-05-07 17:51:24.225'),(7,'user.deactivate','Deactivate','Permission to deactivate','user',NULL,'2026-05-07 17:51:24.228'),(8,'team.create','Create','Permission to create','team',NULL,'2026-05-07 17:51:24.231'),(9,'team.read','Read','Permission to read','team',NULL,'2026-05-07 17:51:24.234'),(10,'team.update','Update','Permission to update','team',NULL,'2026-05-07 17:51:24.237'),(11,'team.delete','Delete','Permission to delete','team',NULL,'2026-05-07 17:51:24.239'),(12,'team.add_member','Add Member','Permission to add member','team',NULL,'2026-05-07 17:51:24.243'),(13,'team.remove_member','Remove Member','Permission to remove member','team',NULL,'2026-05-07 17:51:24.245'),(14,'team.assign_project','Assign Project','Permission to assign project','team',NULL,'2026-05-07 17:51:24.250'),(15,'team.remove_project','Remove Project','Permission to remove project','team',NULL,'2026-05-07 17:51:24.253'),(16,'project.create','Create','Permission to create','project',NULL,'2026-05-07 17:51:24.256'),(17,'project.read','Read','Permission to read','project',NULL,'2026-05-07 17:51:24.260'),(18,'project.update','Update','Permission to update','project',NULL,'2026-05-07 17:51:24.262'),(19,'project.delete','Delete','Permission to delete','project',NULL,'2026-05-07 17:51:24.265'),(20,'project.viewAll','ViewAll','Permission to viewAll','project',NULL,'2026-05-07 17:51:24.267'),(21,'project.assign_team','Assign Team','Permission to assign team','project',NULL,'2026-05-07 17:51:24.270'),(22,'project.remove_team','Remove Team','Permission to remove team','project',NULL,'2026-05-07 17:51:24.272'),(23,'project.manage_settings','Manage Settings','Permission to manage settings','project',NULL,'2026-05-07 17:51:24.275'),(24,'task.create','Create','Permission to create','task',NULL,'2026-05-07 17:51:24.278'),(25,'task.read','Read','Permission to read','task',NULL,'2026-05-07 17:51:24.280'),(26,'task.update','Update','Permission to update','task',NULL,'2026-05-07 17:51:24.283'),(27,'task.delete','Delete','Permission to delete','task',NULL,'2026-05-07 17:51:24.285'),(28,'task.assign','Assign','Permission to assign','task',NULL,'2026-05-07 17:51:24.287'),(29,'task.change_status','Change Status','Permission to change status','task',NULL,'2026-05-07 17:51:24.290'),(30,'task.change_priority','Change Priority','Permission to change priority','task',NULL,'2026-05-07 17:51:24.292'),(31,'dependency.create','Create','Permission to create','dependency',NULL,'2026-05-07 17:51:24.295'),(32,'dependency.read','Read','Permission to read','dependency',NULL,'2026-05-07 17:51:24.297'),(33,'dependency.update','Update','Permission to update','dependency',NULL,'2026-05-07 17:51:24.300'),(34,'dependency.delete','Delete','Permission to delete','dependency',NULL,'2026-05-07 17:51:24.303'),(35,'dependency.manual_unblock','Manual Unblock','Permission to manual unblock','dependency',NULL,'2026-05-07 17:51:24.306'),(36,'today_task.assign','Task Assignment','Access Task Assignment (Today\'s focus) page and assign tasks to users','today_task',NULL,'2026-05-07 17:51:24.309'),(37,'today_task.remove','Remove','Permission to remove','today_task',NULL,'2026-05-07 17:51:24.312'),(38,'today_task.reorder','Reorder','Permission to reorder','today_task',NULL,'2026-05-07 17:51:24.315'),(39,'today_task.view_all','View All','Permission to view all','today_task',NULL,'2026-05-07 17:51:24.318'),(40,'settings.global.read','Global.Read','Permission to global.read','settings','global','2026-05-07 17:51:24.320'),(41,'settings.global.edit','Global.Edit','Permission to global.edit','settings','global','2026-05-07 17:51:24.322'),(42,'settings.project.read','Project.Read','Permission to project.read','settings','project','2026-05-07 17:51:24.325'),(43,'settings.project.edit','Project.Edit','Permission to project.edit','settings','project','2026-05-07 17:51:24.328'),(44,'settings.user.read','User.Read','Permission to user.read','settings','user','2026-05-07 17:51:24.330'),(45,'settings.user.edit','User.Edit','Permission to user.edit','settings','user','2026-05-07 17:51:24.333'),(46,'notification.view','View','Permission to view','notification',NULL,'2026-05-07 17:51:24.336'),(47,'notification.manage','Manage','Permission to manage','notification',NULL,'2026-05-07 17:51:24.340'),(48,'notification.configure','Configure','Permission to configure','notification',NULL,'2026-05-07 17:51:24.344'),(49,'log.view','View','Permission to view','log',NULL,'2026-05-07 17:51:24.347'),(50,'log.export','Export','Permission to export','log',NULL,'2026-05-07 17:51:24.352'),(51,'log.view_details','View Details','Permission to view details','log',NULL,'2026-05-07 17:51:24.358'),(52,'role.create','Create','Permission to create','role',NULL,'2026-05-07 17:51:24.364'),(53,'role.read','Read','Permission to read','role',NULL,'2026-05-07 17:51:24.368'),(54,'role.update','Update','Permission to update','role',NULL,'2026-05-07 17:51:24.371'),(55,'role.delete','Delete','Permission to delete','role',NULL,'2026-05-07 17:51:24.373'),(56,'role.assign','Assign','Permission to assign','role',NULL,'2026-05-07 17:51:24.376'),(57,'role.manage_permissions','Manage Permissions','Permission to manage permissions','role',NULL,'2026-05-07 17:51:24.379'),(58,'report.view','View','Permission to view','report',NULL,'2026-05-07 17:51:24.382'),(59,'report.export','Export','Permission to export','report',NULL,'2026-05-07 17:51:24.384'),(60,'report.generate','Generate','Permission to generate','report',NULL,'2026-05-07 17:51:24.387'),(61,'focus.shift.daily.view','Daily Shift Sheet','Access daily shift sheet report for users','focus','shift','2026-05-07 17:51:24.389'),(62,'focus.shift.edit','Edit Shift Sheet','Edit daily shift records for users','focus','shift','2026-05-07 17:51:24.392');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productivity_snapshots`
--

DROP TABLE IF EXISTS `productivity_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productivity_snapshots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `period` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` datetime(3) NOT NULL,
  `end_date` datetime(3) NOT NULL,
  `score` double NOT NULL,
  `breakdown` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `productivity_snapshots_entity_type_entity_id_period_idx` (`entity_type`,`entity_id`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productivity_snapshots`
--

LOCK TABLES `productivity_snapshots` WRITE;
/*!40000 ALTER TABLE `productivity_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `productivity_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_notification_preferences`
--

DROP TABLE IF EXISTS `project_notification_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_notification_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `sound_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `task_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `dependency_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `today_task_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `project_admin_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_notification_preferences_project_id_user_id_key` (`project_id`,`user_id`),
  KEY `project_notification_preferences_project_id_user_id_idx` (`project_id`,`user_id`),
  KEY `project_notification_preferences_user_id_fkey` (`user_id`),
  CONSTRAINT `project_notification_preferences_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_notification_preferences_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_notification_preferences`
--

LOCK TABLES `project_notification_preferences` WRITE;
/*!40000 ALTER TABLE `project_notification_preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_notification_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_notifications`
--

DROP TABLE IF EXISTS `project_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int DEFAULT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `sound_required` tinyint(1) NOT NULL DEFAULT '0',
  `is_urgent` tinyint(1) NOT NULL DEFAULT '0',
  `requires_acknowledgment` tinyint(1) NOT NULL DEFAULT '0',
  `acknowledged_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `project_notifications_project_id_user_id_is_read_idx` (`project_id`,`user_id`,`is_read`),
  KEY `project_notifications_project_id_user_id_is_urgent_requires__idx` (`project_id`,`user_id`,`is_urgent`,`requires_acknowledgment`),
  KEY `project_notifications_entity_type_entity_id_idx` (`entity_type`,`entity_id`),
  KEY `project_notifications_created_at_idx` (`created_at`),
  KEY `project_notifications_user_id_fkey` (`user_id`),
  CONSTRAINT `project_notifications_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_notifications`
--

LOCK TABLES `project_notifications` WRITE;
/*!40000 ALTER TABLE `project_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_phases`
--

DROP TABLE IF EXISTS `project_phases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_phases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sequence_order` int NOT NULL,
  `start_date` datetime(3) DEFAULT NULL,
  `end_date` datetime(3) DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `project_phases_project_id_fkey` (`project_id`),
  CONSTRAINT `project_phases_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_phases`
--

LOCK TABLES `project_phases` WRITE;
/*!40000 ALTER TABLE `project_phases` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_phases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_settings`
--

DROP TABLE IF EXISTS `project_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` datetime(3) NOT NULL,
  `updated_by` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_settings_project_id_key_key` (`project_id`,`key`),
  KEY `project_settings_project_id_category_idx` (`project_id`,`category`),
  KEY `project_settings_updated_by_fkey` (`updated_by`),
  CONSTRAINT `project_settings_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_settings`
--

LOCK TABLES `project_settings` WRITE;
/*!40000 ALTER TABLE `project_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_settings_change_logs`
--

DROP TABLE IF EXISTS `project_settings_change_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_settings_change_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `setting_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by` int NOT NULL,
  `setting_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `project_settings_change_logs_project_id_setting_key_idx` (`project_id`,`setting_key`),
  KEY `project_settings_change_logs_created_at_idx` (`created_at`),
  KEY `project_settings_change_logs_setting_id_fkey` (`setting_id`),
  KEY `project_settings_change_logs_changed_by_fkey` (`changed_by`),
  CONSTRAINT `project_settings_change_logs_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `project_settings_change_logs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_settings_change_logs_setting_id_fkey` FOREIGN KEY (`setting_id`) REFERENCES `project_settings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_settings_change_logs`
--

LOCK TABLES `project_settings_change_logs` WRITE;
/*!40000 ALTER TABLE `project_settings_change_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_settings_change_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_statuses`
--

DROP TABLE IF EXISTS `project_statuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_statuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#6b7280',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_final` tinyint(1) NOT NULL DEFAULT '0',
  `is_urgent` tinyint(1) NOT NULL DEFAULT '0',
  `order_index` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_statuses_name_key` (`name`),
  KEY `project_statuses_is_active_idx` (`is_active`),
  KEY `project_statuses_order_index_idx` (`order_index`),
  KEY `project_statuses_is_default_idx` (`is_default`),
  KEY `project_statuses_is_urgent_idx` (`is_urgent`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_statuses`
--

LOCK TABLES `project_statuses` WRITE;
/*!40000 ALTER TABLE `project_statuses` DISABLE KEYS */;
INSERT INTO `project_statuses` VALUES (1,'Planning','#6b7280',1,0,0,1,1,'2026-05-07 17:51:24.186','2026-05-07 17:51:24.186'),(2,'On Hold','#f59e0b',0,0,0,3,1,'2026-05-07 17:51:24.186','2026-05-07 17:51:24.186'),(3,'Urgent','#ef4444',0,0,1,4,1,'2026-05-07 17:51:24.186','2026-05-07 17:51:24.186'),(4,'In Progress','#3b82f6',0,0,0,2,1,'2026-05-07 17:51:24.186','2026-05-07 17:51:24.186'),(5,'Completed','#10b981',0,1,0,5,1,'2026-05-07 17:51:24.186','2026-05-07 17:51:24.186'),(6,'Cancelled','#6b7280',0,1,0,6,1,'2026-05-07 17:51:24.186','2026-05-07 17:51:24.186');
/*!40000 ALTER TABLE `project_statuses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_teams`
--

DROP TABLE IF EXISTS `project_teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_teams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `team_id` int NOT NULL,
  `assigned_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_teams_project_id_team_id_key` (`project_id`,`team_id`),
  KEY `project_teams_project_id_idx` (`project_id`),
  KEY `project_teams_team_id_idx` (`team_id`),
  CONSTRAINT `project_teams_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_teams_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_teams`
--

LOCK TABLES `project_teams` WRITE;
/*!40000 ALTER TABLE `project_teams` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_types`
--

DROP TABLE IF EXISTS `project_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `display_order` int NOT NULL DEFAULT '0',
  `color` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `project_types_is_active_idx` (`is_active`),
  KEY `project_types_display_order_idx` (`display_order`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_types`
--

LOCK TABLES `project_types` WRITE;
/*!40000 ALTER TABLE `project_types` DISABLE KEYS */;
INSERT INTO `project_types` VALUES (1,'Web Development','Web application development projects',1,1,'#3b82f6','globe','2026-05-07 17:51:24.168','2026-05-07 17:51:24.168'),(2,'Backend API','Backend and API development projects',1,3,'#8b5cf6','server','2026-05-07 17:51:24.168','2026-05-07 17:51:24.168'),(3,'Mobile Development','Mobile application development projects',1,2,'#10b981','smartphone','2026-05-07 17:51:24.168','2026-05-07 17:51:24.168'),(4,'UI/UX Design','Design and user experience projects',1,4,'#f59e0b','palette','2026-05-07 17:51:24.168','2026-05-07 17:51:24.168');
/*!40000 ALTER TABLE `project_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_users`
--

DROP TABLE IF EXISTS `project_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `allocation_percentage` int NOT NULL DEFAULT '100',
  `joined_at` datetime(3) NOT NULL,
  `left_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_users_project_id_user_id_joined_at_key` (`project_id`,`user_id`,`joined_at`),
  CONSTRAINT `project_users_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_users`
--

LOCK TABLES `project_users` WRITE;
/*!40000 ALTER TABLE `project_users` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_type_id` int DEFAULT NULL,
  `project_status_id` int DEFAULT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scope_text` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `priority` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `urgent_reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `urgent_marked_at` datetime(3) DEFAULT NULL,
  `urgent_marked_by_id` int DEFAULT NULL,
  `start_date` datetime(3) DEFAULT NULL,
  `end_date` datetime(3) DEFAULT NULL,
  `project_manager_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_created_at_idx` (`created_at`),
  KEY `projects_status_idx` (`status`),
  KEY `projects_project_status_id_idx` (`project_status_id`),
  KEY `projects_project_type_id_idx` (`project_type_id`),
  KEY `projects_project_manager_id_idx` (`project_manager_id`),
  KEY `projects_created_by_idx` (`created_by`),
  KEY `projects_priority_idx` (`priority`),
  KEY `projects_urgent_marked_by_id_fkey` (`urgent_marked_by_id`),
  CONSTRAINT `projects_project_manager_id_fkey` FOREIGN KEY (`project_manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `projects_project_status_id_fkey` FOREIGN KEY (`project_status_id`) REFERENCES `project_statuses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `projects_project_type_id_fkey` FOREIGN KEY (`project_type_id`) REFERENCES `project_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `projects_urgent_marked_by_id_fkey` FOREIGN KEY (`urgent_marked_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_permissions_role_id_permission_id_key` (`role_id`,`permission_id`),
  KEY `role_permissions_role_id_idx` (`role_id`),
  KEY `role_permissions_permission_id_idx` (`permission_id`),
  CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,1,1,'2026-05-07 17:51:24.410'),(2,1,2,'2026-05-07 17:51:24.415'),(3,1,3,'2026-05-07 17:51:24.418'),(4,1,4,'2026-05-07 17:51:24.422'),(5,1,5,'2026-05-07 17:51:24.424'),(6,1,6,'2026-05-07 17:51:24.427'),(7,1,7,'2026-05-07 17:51:24.430'),(8,1,8,'2026-05-07 17:51:24.433'),(9,1,9,'2026-05-07 17:51:24.435'),(10,1,10,'2026-05-07 17:51:24.438'),(11,1,11,'2026-05-07 17:51:24.441'),(12,1,12,'2026-05-07 17:51:24.445'),(13,1,13,'2026-05-07 17:51:24.448'),(14,1,14,'2026-05-07 17:51:24.451'),(15,1,15,'2026-05-07 17:51:24.455'),(16,1,16,'2026-05-07 17:51:24.458'),(17,1,17,'2026-05-07 17:51:24.461'),(18,1,18,'2026-05-07 17:51:24.463'),(19,1,19,'2026-05-07 17:51:24.465'),(20,1,20,'2026-05-07 17:51:24.468'),(21,1,21,'2026-05-07 17:51:24.470'),(22,1,22,'2026-05-07 17:51:24.472'),(23,1,23,'2026-05-07 17:51:24.475'),(24,1,24,'2026-05-07 17:51:24.477'),(25,1,25,'2026-05-07 17:51:24.479'),(26,1,26,'2026-05-07 17:51:24.482'),(27,1,27,'2026-05-07 17:51:24.485'),(28,1,28,'2026-05-07 17:51:24.488'),(29,1,29,'2026-05-07 17:51:24.490'),(30,1,30,'2026-05-07 17:51:24.493'),(31,1,31,'2026-05-07 17:51:24.496'),(32,1,32,'2026-05-07 17:51:24.499'),(33,1,33,'2026-05-07 17:51:24.502'),(34,1,34,'2026-05-07 17:51:24.505'),(35,1,35,'2026-05-07 17:51:24.509'),(36,1,36,'2026-05-07 17:51:24.512'),(37,1,37,'2026-05-07 17:51:24.515'),(38,1,38,'2026-05-07 17:51:24.517'),(39,1,39,'2026-05-07 17:51:24.520'),(40,1,40,'2026-05-07 17:51:24.523'),(41,1,41,'2026-05-07 17:51:24.526'),(42,1,42,'2026-05-07 17:51:24.529'),(43,1,43,'2026-05-07 17:51:24.534'),(44,1,44,'2026-05-07 17:51:24.538'),(45,1,45,'2026-05-07 17:51:24.541'),(46,1,46,'2026-05-07 17:51:24.545'),(47,1,47,'2026-05-07 17:51:24.550'),(48,1,48,'2026-05-07 17:51:24.554'),(49,1,49,'2026-05-07 17:51:24.557'),(50,1,50,'2026-05-07 17:51:24.560'),(51,1,51,'2026-05-07 17:51:24.563'),(52,1,52,'2026-05-07 17:51:24.566'),(53,1,53,'2026-05-07 17:51:24.568'),(54,1,54,'2026-05-07 17:51:24.570'),(55,1,55,'2026-05-07 17:51:24.573'),(56,1,56,'2026-05-07 17:51:24.575'),(57,1,57,'2026-05-07 17:51:24.578'),(58,1,58,'2026-05-07 17:51:24.580'),(59,1,59,'2026-05-07 17:51:24.582'),(60,1,60,'2026-05-07 17:51:24.585'),(61,1,61,'2026-05-07 17:51:24.588'),(62,1,62,'2026-05-07 17:51:24.590'),(63,3,36,'2026-05-07 17:51:24.594'),(64,3,37,'2026-05-07 17:51:24.597'),(65,3,38,'2026-05-07 17:51:24.600'),(66,3,39,'2026-05-07 17:51:24.604'),(67,2,61,'2026-05-07 17:51:24.609'),(68,2,62,'2026-05-07 17:51:24.612'),(69,4,40,'2026-05-07 17:51:24.615');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_system_role` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin','System Administrator with full access',1,'2026-05-07 17:51:24.395','2026-05-07 17:51:24.395'),(2,'project_manager','Project Manager',1,'2026-05-07 17:51:24.399','2026-05-07 17:51:24.399'),(3,'team_lead','Team Lead',1,'2026-05-07 17:51:24.402','2026-05-07 17:51:24.402'),(4,'developer','Developer',1,'2026-05-07 17:51:24.405','2026-05-07 17:51:24.405'),(5,'viewer','Read-only access',1,'2026-05-07 17:51:24.407','2026-05-07 17:51:24.407');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scope_history`
--

DROP TABLE IF EXISTS `scope_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scope_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `scope_text` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `change_reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `scope_history_project_id_fkey` (`project_id`),
  CONSTRAINT `scope_history_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scope_history`
--

LOCK TABLES `scope_history` WRITE;
/*!40000 ALTER TABLE `scope_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `scope_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings_change_logs`
--

DROP TABLE IF EXISTS `settings_change_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings_change_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int NOT NULL,
  `setting_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `settings_change_logs_setting_id_fkey` (`setting_id`),
  KEY `settings_change_logs_user_id_fkey` (`user_id`),
  CONSTRAINT `settings_change_logs_setting_id_fkey` FOREIGN KEY (`setting_id`) REFERENCES `system_settings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `settings_change_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings_change_logs`
--

LOCK TABLES `settings_change_logs` WRITE;
/*!40000 ALTER TABLE `settings_change_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `settings_change_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stats_snapshots`
--

DROP TABLE IF EXISTS `stats_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_snapshots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int DEFAULT NULL,
  `metric_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` double NOT NULL,
  `date` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `stats_snapshots_entity_type_entity_id_metric_key_date_idx` (`entity_type`,`entity_id`,`metric_key`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stats_snapshots`
--

LOCK TABLES `stats_snapshots` WRITE;
/*!40000 ALTER TABLE `stats_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `stats_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subtask_dependencies`
--

DROP TABLE IF EXISTS `subtask_dependencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subtask_dependencies` (
  `subtask_id` int NOT NULL,
  `depends_on_subtask_id` int NOT NULL,
  `dependency_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'finish_to_start',
  `created_by_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`subtask_id`,`depends_on_subtask_id`),
  KEY `subtask_dependencies_depends_on_subtask_id_fkey` (`depends_on_subtask_id`),
  CONSTRAINT `subtask_dependencies_depends_on_subtask_id_fkey` FOREIGN KEY (`depends_on_subtask_id`) REFERENCES `subtasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `subtask_dependencies_subtask_id_fkey` FOREIGN KEY (`subtask_id`) REFERENCES `subtasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subtask_dependencies`
--

LOCK TABLES `subtask_dependencies` WRITE;
/*!40000 ALTER TABLE `subtask_dependencies` DISABLE KEYS */;
/*!40000 ALTER TABLE `subtask_dependencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subtasks`
--

DROP TABLE IF EXISTS `subtasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subtasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `priority` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `start_date` datetime(3) DEFAULT NULL,
  `due_date` datetime(3) DEFAULT NULL,
  `estimated_hours` double NOT NULL DEFAULT '0',
  `actual_hours` double NOT NULL DEFAULT '0',
  `parent_task_id` int NOT NULL,
  `assigned_to_id` int DEFAULT NULL,
  `team_id` int DEFAULT NULL,
  `created_by_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `subtasks_created_by_id_fkey` (`created_by_id`),
  KEY `subtasks_team_id_fkey` (`team_id`),
  KEY `subtasks_assigned_to_id_fkey` (`assigned_to_id`),
  KEY `subtasks_parent_task_id_fkey` (`parent_task_id`),
  CONSTRAINT `subtasks_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `subtasks_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `subtasks_parent_task_id_fkey` FOREIGN KEY (`parent_task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `subtasks_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subtasks`
--

LOCK TABLES `subtasks` WRITE;
/*!40000 ALTER TABLE `subtasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `subtasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL,
  `updated_by` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_settings_key_key` (`key`),
  KEY `system_settings_updated_by_fkey` (`updated_by`),
  CONSTRAINT `system_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_dependencies`
--

DROP TABLE IF EXISTS `task_dependencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_dependencies` (
  `task_id` int NOT NULL,
  `depends_on_task_id` int NOT NULL,
  `dependency_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'finish_to_start',
  `created_by_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`task_id`,`depends_on_task_id`),
  KEY `task_dependencies_task_id_idx` (`task_id`),
  KEY `task_dependencies_depends_on_task_id_idx` (`depends_on_task_id`),
  CONSTRAINT `task_dependencies_depends_on_task_id_fkey` FOREIGN KEY (`depends_on_task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `task_dependencies_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_dependencies`
--

LOCK TABLES `task_dependencies` WRITE;
/*!40000 ALTER TABLE `task_dependencies` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_dependencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_labels`
--

DROP TABLE IF EXISTS `task_labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_labels` (
  `task_id` int NOT NULL,
  `label_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`task_id`,`label_id`),
  KEY `task_labels_label_id_fkey` (`label_id`),
  CONSTRAINT `task_labels_label_id_fkey` FOREIGN KEY (`label_id`) REFERENCES `labels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `task_labels_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_labels`
--

LOCK TABLES `task_labels` WRITE;
/*!40000 ALTER TABLE `task_labels` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_labels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_statuses`
--

DROP TABLE IF EXISTS `task_statuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_statuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#6b7280',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_final` tinyint(1) NOT NULL DEFAULT '0',
  `is_blocking` tinyint(1) NOT NULL DEFAULT '0',
  `order_index` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_statuses_name_key` (`name`),
  KEY `task_statuses_is_active_idx` (`is_active`),
  KEY `task_statuses_order_index_idx` (`order_index`),
  KEY `task_statuses_is_default_idx` (`is_default`),
  KEY `task_statuses_is_blocking_idx` (`is_blocking`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_statuses`
--

LOCK TABLES `task_statuses` WRITE;
/*!40000 ALTER TABLE `task_statuses` DISABLE KEYS */;
INSERT INTO `task_statuses` VALUES (1,'Cancelled','#6b7280',0,1,0,6,1,'2026-05-07 17:51:24.202','2026-05-07 17:51:24.202'),(2,'Completed','#10b981',0,1,0,5,1,'2026-05-07 17:51:24.202','2026-05-07 17:51:24.202'),(3,'In Review','#f59e0b',0,0,0,3,1,'2026-05-07 17:51:24.202','2026-05-07 17:51:24.202'),(4,'Pending','#6b7280',1,0,0,1,1,'2026-05-07 17:51:24.202','2026-05-07 17:51:24.202'),(5,'Blocked','#ef4444',0,0,1,4,1,'2026-05-07 17:51:24.202','2026-05-07 17:51:24.202'),(6,'In Progress','#3b82f6',0,0,0,2,1,'2026-05-07 17:51:24.202','2026-05-07 17:51:24.202');
/*!40000 ALTER TABLE `task_statuses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `task_status_id` int DEFAULT NULL,
  `priority` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `due_date` datetime(3) DEFAULT NULL,
  `planned_date` datetime(3) DEFAULT NULL,
  `estimated_hours` double NOT NULL DEFAULT '0',
  `actual_hours` double NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `project_id` int NOT NULL,
  `team_id` int DEFAULT NULL,
  `created_by_id` int DEFAULT NULL,
  `deliverable_id` int DEFAULT NULL,
  `started_at` datetime(3) DEFAULT NULL,
  `completed_at` datetime(3) DEFAULT NULL,
  `rollover_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `tasks_task_status_id_idx` (`task_status_id`),
  KEY `tasks_project_id_idx` (`project_id`),
  KEY `tasks_priority_idx` (`priority`),
  KEY `tasks_status_idx` (`status`),
  KEY `tasks_due_date_idx` (`due_date`),
  KEY `tasks_created_at_idx` (`created_at`),
  KEY `tasks_created_by_id_idx` (`created_by_id`),
  KEY `tasks_team_id_idx` (`team_id`),
  KEY `tasks_project_id_task_status_id_idx` (`project_id`,`task_status_id`),
  KEY `tasks_project_id_priority_idx` (`project_id`,`priority`),
  KEY `tasks_deliverable_id_fkey` (`deliverable_id`),
  CONSTRAINT `tasks_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tasks_deliverable_id_fkey` FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tasks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tasks_task_status_id_fkey` FOREIGN KEY (`task_status_id`) REFERENCES `task_statuses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tasks_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `team_members`
--

DROP TABLE IF EXISTS `team_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `team_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member',
  `joined_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `team_members_team_id_user_id_key` (`team_id`,`user_id`),
  KEY `team_members_team_id_idx` (`team_id`),
  KEY `team_members_user_id_idx` (`user_id`),
  CONSTRAINT `team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `team_members`
--

LOCK TABLES `team_members` WRITE;
/*!40000 ALTER TABLE `team_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `team_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `team_lead_id` int DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `teams_team_lead_id_fkey` (`team_lead_id`),
  CONSTRAINT `teams_team_lead_id_fkey` FOREIGN KEY (`team_lead_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teams`
--

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
/*!40000 ALTER TABLE `teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `time_logs`
--

DROP TABLE IF EXISTS `time_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `time_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `hours_logged` double NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `log_date` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `user_id` int NOT NULL,
  `task_id` int DEFAULT NULL,
  `subtask_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `time_logs_subtask_id_fkey` (`subtask_id`),
  KEY `time_logs_task_id_fkey` (`task_id`),
  KEY `time_logs_user_id_fkey` (`user_id`),
  CONSTRAINT `time_logs_subtask_id_fkey` FOREIGN KEY (`subtask_id`) REFERENCES `subtasks` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `time_logs_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `time_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `time_logs`
--

LOCK TABLES `time_logs` WRITE;
/*!40000 ALTER TABLE `time_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `time_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `urgent_project_acknowledgements`
--

DROP TABLE IF EXISTS `urgent_project_acknowledgements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `urgent_project_acknowledgements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `acknowledged_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `urgent_project_acknowledgements_project_id_user_id_key` (`project_id`,`user_id`),
  KEY `urgent_project_acknowledgements_project_id_idx` (`project_id`),
  KEY `urgent_project_acknowledgements_user_id_idx` (`user_id`),
  CONSTRAINT `urgent_project_acknowledgements_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `urgent_project_acknowledgements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `urgent_project_acknowledgements`
--

LOCK TABLES `urgent_project_acknowledgements` WRITE;
/*!40000 ALTER TABLE `urgent_project_acknowledgements` DISABLE KEYS */;
/*!40000 ALTER TABLE `urgent_project_acknowledgements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  `scope_type` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scope_id` int DEFAULT NULL,
  `assigned_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `assigned_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_roles_user_id_role_id_scope_type_scope_id_key` (`user_id`,`role_id`,`scope_type`,`scope_id`),
  KEY `user_roles_user_id_idx` (`user_id`),
  KEY `user_roles_role_id_idx` (`role_id`),
  KEY `user_roles_scope_type_scope_id_idx` (`scope_type`,`scope_id`),
  KEY `user_roles_assigned_by_fkey` (`assigned_by`),
  CONSTRAINT `user_roles_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1,1,'global',NULL,'2026-05-07 17:51:24.697',NULL);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_settings`
--

DROP TABLE IF EXISTS `user_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `updated_by` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_settings_user_id_key_key` (`user_id`,`key`),
  KEY `user_settings_user_id_category_idx` (`user_id`,`category`),
  KEY `user_settings_updated_by_fkey` (`updated_by`),
  CONSTRAINT `user_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_settings`
--

LOCK TABLES `user_settings` WRITE;
/*!40000 ALTER TABLE `user_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_settings_change_logs`
--

DROP TABLE IF EXISTS `user_settings_change_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_settings_change_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `setting_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by` int NOT NULL,
  `setting_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `user_settings_change_logs_user_id_setting_key_idx` (`user_id`,`setting_key`),
  KEY `user_settings_change_logs_created_at_idx` (`created_at`),
  KEY `user_settings_change_logs_setting_id_fkey` (`setting_id`),
  KEY `user_settings_change_logs_changed_by_fkey` (`changed_by`),
  CONSTRAINT `user_settings_change_logs_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `user_settings_change_logs_setting_id_fkey` FOREIGN KEY (`setting_id`) REFERENCES `user_settings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_settings_change_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_settings_change_logs`
--

LOCK TABLES `user_settings_change_logs` WRITE;
/*!40000 ALTER TABLE `user_settings_change_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_settings_change_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'developer',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `team_id` int DEFAULT NULL,
  `avatar_url` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_key` (`username`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_role_idx` (`role`),
  KEY `users_is_active_idx` (`is_active`),
  KEY `users_team_id_idx` (`team_id`),
  KEY `users_created_at_idx` (`created_at`),
  CONSTRAINT `users_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin@qeematech.net','$2b$10$Tx.iregfBhp3ag2zFMuK9ujbNk9h31/BTOXnInByGugmZKaJBeCqm','admin',1,'2026-05-07 17:51:24.688',NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_shifts`
--

DROP TABLE IF EXISTS `work_shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `shift_date` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_at` datetime(3) NOT NULL,
  `end_at` datetime(3) DEFAULT NULL,
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `paused_at` datetime(3) DEFAULT NULL,
  `paused_seconds_total` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `work_shifts_user_id_shift_date_key` (`user_id`,`shift_date`),
  KEY `work_shifts_shift_date_idx` (`shift_date`),
  KEY `work_shifts_user_id_shift_date_idx` (`user_id`,`shift_date`),
  CONSTRAINT `work_shifts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_shifts`
--

LOCK TABLES `work_shifts` WRITE;
/*!40000 ALTER TABLE `work_shifts` DISABLE KEYS */;
/*!40000 ALTER TABLE `work_shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'pms'
--

--
-- Dumping routines for database 'pms'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-07 20:53:37
