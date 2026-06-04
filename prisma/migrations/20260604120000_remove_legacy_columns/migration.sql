-- Drop legacy columns superseded by relationship tables
ALTER TABLE `activity_logs` DROP FOREIGN KEY `activity_logs_user_id_fkey`;
ALTER TABLE `activity_logs` DROP COLUMN `action`;
ALTER TABLE `activity_logs` DROP COLUMN `description`;
ALTER TABLE `activity_logs` DROP COLUMN `user_id`;

DROP INDEX `projects_status_idx` ON `projects`;
ALTER TABLE `projects` DROP COLUMN `status`;
ALTER TABLE `projects` DROP COLUMN `type`;

DROP INDEX `tasks_status_idx` ON `tasks`;
ALTER TABLE `tasks` DROP COLUMN `status`;
