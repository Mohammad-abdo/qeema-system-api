-- AlterTable
ALTER TABLE `work_shifts` ADD COLUMN `paused_at` DATETIME(3) NULL,
    ADD COLUMN `paused_seconds_total` INTEGER NOT NULL DEFAULT 0;
