-- CreateTable
CREATE TABLE `performance_periods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_periods_status_idx`(`status`),
    INDEX `performance_periods_start_date_end_date_idx`(`start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_updates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `project_id` INTEGER NOT NULL,
    `task_id` INTEGER NULL,
    `update_text` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `blockers` TEXT NULL,
    `evidence_url` VARCHAR(191) NULL,
    `update_date` VARCHAR(191) NOT NULL,
    `submitted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_updates_user_id_update_date_idx`(`user_id`, `update_date`),
    INDEX `daily_updates_project_id_update_date_idx`(`project_id`, `update_date`),
    INDEX `daily_updates_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `period_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role_snapshot` VARCHAR(191) NOT NULL,
    `updates_count` INTEGER NOT NULL DEFAULT 0,
    `projects_count` INTEGER NOT NULL DEFAULT 0,
    `active_days` INTEGER NOT NULL DEFAULT 0,
    `expected_working_days` INTEGER NOT NULL DEFAULT 0,
    `regularity_score` DOUBLE NOT NULL DEFAULT 0,
    `quality_score` DOUBLE NOT NULL DEFAULT 0,
    `speed_score` DOUBLE NOT NULL DEFAULT 0,
    `communication_score` DOUBLE NOT NULL DEFAULT 0,
    `update_quality_score` DOUBLE NOT NULL DEFAULT 0,
    `complexity_score` DOUBLE NOT NULL DEFAULT 0,
    `final_score` DOUBLE NOT NULL DEFAULT 0,
    `rating` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_reviews_user_id_idx`(`user_id`),
    INDEX `performance_reviews_period_id_idx`(`period_id`),
    INDEX `performance_reviews_final_score_idx`(`final_score`),
    UNIQUE INDEX `performance_reviews_period_id_user_id_key`(`period_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `review_id` INTEGER NOT NULL,
    `strengths` TEXT NOT NULL,
    `improvement_points` TEXT NOT NULL,
    `manager_notes` TEXT NULL,
    `action_plan` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `performance_feedback_review_id_key`(`review_id`),
    INDEX `performance_feedback_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `performance_periods` ADD CONSTRAINT `performance_periods_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_updates` ADD CONSTRAINT `daily_updates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_updates` ADD CONSTRAINT `daily_updates_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_updates` ADD CONSTRAINT `daily_updates_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `performance_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_feedback` ADD CONSTRAINT `performance_feedback_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `performance_reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_feedback` ADD CONSTRAINT `performance_feedback_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
