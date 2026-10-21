-- ==========================================================
-- SKEMA DATABASE MYSQL & DATA SEED
-- Sistem Manajemen Tugas Berbasis Notula Rapat
-- Siap di-import langsung melalui phpMyAdmin / MySQL CLI
-- ==========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tabel: meetings (Rapat & Notula)
CREATE TABLE IF NOT EXISTS `meetings` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `meeting_date` DATE NOT NULL,
  `participants` JSON NOT NULL,
  `meeting_notes` MEDIUMTEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_meeting_date` (`meeting_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel: tasks (Tindak Lanjut / Action Items)
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` VARCHAR(64) NOT NULL,
  `meeting_id` VARCHAR(64) NOT NULL,
  `title` TEXT NOT NULL,
  `assignee` VARCHAR(150) NOT NULL,
  `assignees` JSON DEFAULT NULL,
  `due_date` DATE NOT NULL,
  `due_time` VARCHAR(20) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'To Do',
  `priority` VARCHAR(20) DEFAULT 'Medium',
  `description` MEDIUMTEXT DEFAULT NULL,
  `tags` JSON DEFAULT NULL,
  `github_repo` VARCHAR(255) DEFAULT NULL,
  `github_branch` VARCHAR(255) DEFAULT NULL,
  `github_pr_url` VARCHAR(255) DEFAULT NULL,
  `github_issue_url` VARCHAR(500) DEFAULT NULL,
  `github_project_url` VARCHAR(500) DEFAULT NULL,
  `github_metadata` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tasks_meeting_id` (`meeting_id`),
  INDEX `idx_tasks_status` (`status`),
  INDEX `idx_tasks_due_date` (`due_date`),
  CONSTRAINT `fk_tasks_meeting` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel: divisions (Divisi Perusahaan)
CREATE TABLE IF NOT EXISTS `divisions` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_division_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel: users (Pengguna & Akses)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `division_id` VARCHAR(64) DEFAULT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'user',
  `github_id` VARCHAR(100) DEFAULT NULL,
  `github_username` VARCHAR(100) DEFAULT NULL,
  `github_avatar_url` VARCHAR(255) DEFAULT NULL,
  `github_access_token` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`),
  CONSTRAINT `fk_users_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel: task_submissions (Bukti Kerja & Lampiran)
CREATE TABLE IF NOT EXISTS `task_submissions` (
  `id` VARCHAR(64) NOT NULL,
  `task_id` VARCHAR(64) NOT NULL,
  `assignee` VARCHAR(150) NOT NULL,
  `notes` MEDIUMTEXT DEFAULT NULL,
  `attachments` LONGTEXT DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` VARCHAR(100) DEFAULT NULL,
  `reviewed_at` DATETIME DEFAULT NULL,
  `review_note` MEDIUMTEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_submissions_task_id` (`task_id`),
  CONSTRAINT `fk_submissions_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================================
-- SEED DATA: RAPAT, TUGAS, & DIVISI DARI DATABASE LAMA
-- ==========================================================

-- A. Rapat Induk
INSERT INTO `meetings` (`id`, `title`, `meeting_date`, `participants`, `meeting_notes`, `created_at`, `updated_at`)
VALUES (
  'meet-mu6pvjz1-bnli',
  'Rapat Koordinasi & Tindak Lanjut Task',
  '2026-09-15',
  '["Hanif", "Sonia", "rizki", "ajeng", "fikri", "Dinda", "Azka"]',
  'Catatan notula rapat koordinasi pembahasan pembuatan Web Meeting, penambahan data CS, pembaruan logo Logam Mulia di WEB Emas Murni Asli, akun pemasar live streaming, integrasi review rating maps, beragam desain LM, dan endorsement podcast.',
  '2026-09-18 15:48:59',
  '2026-09-25 09:54:58'
) ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `meeting_notes` = VALUES(`meeting_notes`);

-- B. 7 Action Items (Tugas)
INSERT INTO `tasks` (`id`, `meeting_id`, `title`, `assignee`, `assignees`, `due_date`, `status`, `priority`, `created_at`, `updated_at`)
VALUES
(
  'task-1-mu6pvjz3-6wsp',
  'meet-mu6pvjz1-bnli',
  'Membuat Web Meeting',
  'Hanif',
  '["Hanif"]',
  '2026-09-15',
  'Done',
  'Medium',
  '2026-09-18 15:48:59',
  '2026-09-21 12:58:29'
),
(
  'task-2-mu6pvjz3-kxrp',
  'meet-mu6pvjz1-bnli',
  'Penambahan Data CS (No HP, Email) dan Notifikasi (jika CS blm melakukan Task dan evaluasi yang harus diselesaikan), Jika Cust Sudah download aplikasi beri notifikasi untuk segera registrasi,',
  'Sonia, rizki',
  '["Sonia", "rizki"]',
  '2026-09-21',
  'In Progress',
  'High',
  '2026-09-18 15:48:59',
  '2026-09-21 13:48:33'
),
(
  'task-mub1g9oj-ty18',
  'meet-mu6pvjz1-bnli',
  'Update Logo Logam Mulia di WEB Emas Murni Asli',
  'ajeng, Hanif',
  '["ajeng", "Hanif"]',
  '2026-09-28',
  'Done',
  'Medium',
  '2026-09-21 16:24:06',
  '2026-09-22 12:58:16'
),
(
  'task-mub1eyg2-rbd3',
  'meet-mu6pvjz1-bnli',
  'Akun REI dijadikan akun pemasar untuk keperluan Live Streaming',
  'ajeng, fikri',
  '["ajeng", "fikri"]',
  '2026-09-28',
  'Done',
  'Medium',
  '2026-09-21 16:23:05',
  '2026-09-23 12:39:41'
),
(
  'task-mub1j9a5-wxpx',
  'meet-mu6pvjz1-bnli',
  'Buat WEB untuk menjumlahkan semua review rating maps yang masuk',
  'Dinda, Hanif',
  '["Dinda", "Hanif"]',
  '2026-09-30',
  'Done',
  'Medium',
  '2026-09-21 16:26:26',
  '2026-09-23 13:10:29'
),
(
  'task-mub1hbea-um24',
  'meet-mu6pvjz1-bnli',
  'Design Logam Mulia Dibuat Beragam Design',
  'ajeng',
  '["ajeng"]',
  '2026-09-28',
  'Done',
  'Medium',
  '2026-09-21 16:24:55',
  '2026-09-25 09:51:53'
),
(
  'task-mub25949-hgq1',
  'meet-mu6pvjz1-bnli',
  'Endorsement dengan tamu podcast yang sudah di undang dan yang akan datang (Konten UGC, Promosu LM)',
  'Azka',
  '["Azka"]',
  '2026-09-22',
  'Done',
  'Medium',
  '2026-09-21 16:43:32',
  '2026-09-25 09:54:58'
) ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status` = VALUES(`status`), `assignee` = VALUES(`assignee`);

-- C. Divisi Default
INSERT INTO `divisions` (`id`, `name`)
VALUES
  ('div-it', 'IT & Systems'),
  ('div-marketing', 'Marketing'),
  ('div-ops', 'Operasional'),
  ('div-finance', 'Keuangan'),
  ('div-hrd', 'HRD & GA')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 6. Tabel: git_projects (Project Git / Repositori GitHub untuk Tim IT)
CREATE TABLE IF NOT EXISTS `git_projects` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `repo` VARCHAR(255) NOT NULL,
  `url` VARCHAR(500) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_git_project_repo` (`repo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- D. Seed Git Projects Awal
INSERT INTO `git_projects` (`id`, `name`, `repo`, `url`, `description`)
VALUES
  ('gp-task-mgmt', 'Task Management System', 'syuhadahanif13/task-management', 'https://github.com/syuhadahanif13/task-management', 'Sistem Manajemen Notula & Tugas'),
  ('gp-raja-kerupuk', 'Raja Kerupuk', 'muhalhanifiyyah-max/raja-kerupuk', 'https://github.com/muhalhanifiyyah-max/raja-kerupuk', 'Aplikasi Penjualan Raja Kerupuk')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `url` = VALUES(`url`);

