export const MYSQL_SQL_MIGRATION = `-- ==========================================================
-- MYSQL MIGRATION SCRIPT (InnoDB, utf8mb4)
-- Sistem Manajemen Tugas Berbasis Notula Rapat (1:N Architecture)
-- Core Modules:
-- 1. meetings (Rapat & Notula)
-- 2. tasks (Tindak Lanjut)
-- 3. divisions (Divisi Perusahaan)
-- 4. users (Pengguna & Hak Akses)
-- 5. task_submissions (Bukti Kerja & Lampiran)
-- ==========================================================

-- 1. Tabel Divisi (Divisions)
CREATE TABLE IF NOT EXISTS divisions (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabel Pengguna (Users)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(128) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    division_id VARCHAR(128) NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabel Induk Rapat: Meetings (Rapat & Notula)
CREATE TABLE IF NOT EXISTS meetings (
    id VARCHAR(128) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    meeting_date DATE NOT NULL,
    participants JSON NULL,
    meeting_notes LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabel Anak: Tasks (Action Items Tindak Lanjut - 1:N)
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(128) PRIMARY KEY,
    meeting_id VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    assignee VARCHAR(255) NOT NULL,
    assignees JSON NULL,
    due_date DATE NOT NULL,
    due_time VARCHAR(20) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'To Do',
    priority VARCHAR(20) DEFAULT 'Medium',
    description LONGTEXT NULL,
    tags JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_meeting_id (meeting_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabel Task Submissions (Bukti Penyelesaian Tugas & Approval)
CREATE TABLE IF NOT EXISTS task_submissions (
    id VARCHAR(128) PRIMARY KEY,
    task_id VARCHAR(128) NOT NULL,
    task_title VARCHAR(255) NULL,
    assignee VARCHAR(255) NOT NULL,
    notes LONGTEXT NULL,
    attachments LONGTEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255) NULL,
    reviewed_at TIMESTAMP NULL,
    review_note LONGTEXT NULL,
    INDEX idx_sub_task_id (task_id),
    INDEX idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
