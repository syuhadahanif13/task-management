-- ==========================================================
-- SUPABASE COMPLETE MIGRATION & DATA TRANSFER
-- Target Project: https://rzjsggqsdjkkplerxpgh.supabase.co
-- Generated: 2026-09-26
-- ==========================================================

-- 1. TABEL: meetings
CREATE TABLE IF NOT EXISTS public.meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    participants TEXT[] NOT NULL DEFAULT '{}',
    meeting_notes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABEL: tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assignee TEXT NOT NULL,
    assignees TEXT[] DEFAULT '{}',
    due_date DATE NOT NULL,
    due_time TEXT,
    status TEXT NOT NULL DEFAULT 'To Do',
    priority TEXT DEFAULT 'Medium',
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_task_status CHECK (status IN ('To Do', 'In Progress', 'Done', 'Pending Approval'))
);

-- 3. TABEL: divisions
CREATE TABLE IF NOT EXISTS public.divisions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABEL: users
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    division_id TEXT REFERENCES public.divisions(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_user_role CHECK (role IN ('admin', 'user'))
);

-- 5. TABEL: task_submissions
CREATE TABLE IF NOT EXISTS public.task_submissions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    assignee TEXT NOT NULL,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    CONSTRAINT chk_submission_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON public.tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON public.meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_divisions_name ON public.divisions(name);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON public.task_submissions(task_id);

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read on meetings" ON public.meetings;
DROP POLICY IF EXISTS "Allow public insert on meetings" ON public.meetings;
DROP POLICY IF EXISTS "Allow public update on meetings" ON public.meetings;
DROP POLICY IF EXISTS "Allow public delete on meetings" ON public.meetings;

DROP POLICY IF EXISTS "Allow public read on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public insert on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public update on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public delete on tasks" ON public.tasks;

DROP POLICY IF EXISTS "Allow public read on divisions" ON public.divisions;
DROP POLICY IF EXISTS "Allow public insert on divisions" ON public.divisions;
DROP POLICY IF EXISTS "Allow public update on divisions" ON public.divisions;
DROP POLICY IF EXISTS "Allow public delete on divisions" ON public.divisions;

DROP POLICY IF EXISTS "Allow public read on users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert on users" ON public.users;
DROP POLICY IF EXISTS "Allow public update on users" ON public.users;
DROP POLICY IF EXISTS "Allow public delete on users" ON public.users;

DROP POLICY IF EXISTS "Allow public read on task_submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Allow public insert on task_submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Allow public update on task_submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Allow public delete on task_submissions" ON public.task_submissions;

-- Create full read/write policies for public/anon & authenticated
CREATE POLICY "Allow public read on meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on meetings" ON public.meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on meetings" ON public.meetings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on meetings" ON public.meetings FOR DELETE USING (true);

CREATE POLICY "Allow public read on tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on tasks" ON public.tasks FOR DELETE USING (true);

CREATE POLICY "Allow public read on divisions" ON public.divisions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on divisions" ON public.divisions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on divisions" ON public.divisions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on divisions" ON public.divisions FOR DELETE USING (true);

CREATE POLICY "Allow public read on users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert on users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on users" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on users" ON public.users FOR DELETE USING (true);

CREATE POLICY "Allow public read on task_submissions" ON public.task_submissions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on task_submissions" ON public.task_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on task_submissions" ON public.task_submissions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on task_submissions" ON public.task_submissions FOR DELETE USING (true);

-- ==========================================================
-- 8. DATA MIGRATION: SEEDING EXISTING MEETINGS & TASKS
-- ==========================================================

-- A. Insert Parent Meeting
INSERT INTO public.meetings (id, title, meeting_date, participants, meeting_notes, created_at, updated_at)
VALUES (
    'meet-mu6pvjz1-bnli',
    'Rapat Koordinasi & Tindak Lanjut Task',
    '2026-09-15',
    ARRAY['Hanif', 'Sonia', 'rizki', 'ajeng', 'fikri', 'Dinda', 'Azka'],
    'Catatan notula rapat koordinasi pembahasan pembuatan Web Meeting, penambahan data CS, pembaruan logo Logam Mulia di WEB Emas Murni Asli, akun pemasar live streaming, integrasi review rating maps, beragam desain LM, dan endorsement podcast.',
    '2026-09-18T08:48:59.869Z',
    '2026-09-25T02:54:58.172Z'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    meeting_date = EXCLUDED.meeting_date,
    participants = EXCLUDED.participants,
    meeting_notes = EXCLUDED.meeting_notes,
    updated_at = EXCLUDED.updated_at;

-- B. Insert 7 Tasks
INSERT INTO public.tasks (id, meeting_id, title, assignee, assignees, due_date, status, priority, created_at, updated_at)
VALUES 
(
    'task-1-mu6pvjz3-6wsp',
    'meet-mu6pvjz1-bnli',
    'Membuat Web Meeting',
    'Hanif',
    ARRAY['Hanif'],
    '2026-09-15',
    'Done',
    'Medium',
    '2026-09-18T08:48:59.869Z',
    '2026-09-21T05:58:29.693Z'
),
(
    'task-2-mu6pvjz3-kxrp',
    'meet-mu6pvjz1-bnli',
    'Penambahan Data CS (No HP, Email) dan Notifikasi (jika CS blm melakukan Task dan evaluasi yang harus diselesaikan), Jika Cust Sudah download aplikasi beri notifikasi untuk segera registrasi,',
    'Sonia, rizki',
    ARRAY['Sonia', 'rizki'],
    '2026-09-21',
    'In Progress',
    'High',
    '2026-09-18T08:48:59.869Z',
    '2026-09-21T06:48:33.582Z'
),
(
    'task-mub1g9oj-ty18',
    'meet-mu6pvjz1-bnli',
    'Update Logo Logam Mulia di WEB Emas Murni Asli',
    'ajeng, Hanif',
    ARRAY['ajeng', 'Hanif'],
    '2026-09-28',
    'Done',
    'Medium',
    '2026-09-21T09:24:06.787Z',
    '2026-09-22T05:58:16.828Z'
),
(
    'task-mub1eyg2-rbd3',
    'meet-mu6pvjz1-bnli',
    'Akun REI dijadikan akun pemasar untuk keperluan Live Streaming',
    'ajeng, fikri',
    ARRAY['ajeng', 'fikri'],
    '2026-09-28',
    'Done',
    'Medium',
    '2026-09-21T09:23:05.570Z',
    '2026-09-23T05:39:41.656Z'
),
(
    'task-mub1j9a5-wxpx',
    'meet-mu6pvjz1-bnli',
    'Buat WEB untuk menjumlahkan semua review rating maps yang masuk',
    'Dinda, Hanif',
    ARRAY['Dinda', 'Hanif'],
    '2026-09-30',
    'Done',
    'Medium',
    '2026-09-21T09:26:26.237Z',
    '2026-09-23T06:10:29.902Z'
),
(
    'task-mub1hbea-um24',
    'meet-mu6pvjz1-bnli',
    'Design Logam Mulia Dibuat Beragam Design',
    'ajeng',
    ARRAY['ajeng'],
    '2026-09-28',
    'Done',
    'Medium',
    '2026-09-21T09:24:55.666Z',
    '2026-09-25T02:51:53.086Z'
),
(
    'task-mub25949-hgq1',
    'meet-mu6pvjz1-bnli',
    'Endorsement dengan tamu podcast yang sudah di undang dan yang akan datang (Konten UGC, Promosu LM)',
    'Azka',
    ARRAY['Azka'],
    '2026-09-22',
    'Done',
    'Medium',
    '2026-09-21T09:43:32.457Z',
    '2026-09-25T02:54:58.172Z'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    assignee = EXCLUDED.assignee,
    assignees = EXCLUDED.assignees,
    due_date = EXCLUDED.due_date,
    status = EXCLUDED.status,
    priority = EXCLUDED.priority,
    updated_at = EXCLUDED.updated_at;

-- C. Insert Default Divisions
INSERT INTO public.divisions (id, name, created_at, updated_at)
VALUES 
    ('div-it', 'IT & Systems', now(), now()),
    ('div-marketing', 'Marketing', now(), now()),
    ('div-ops', 'Operasional', now(), now()),
    ('div-finance', 'Keuangan', now(), now()),
    ('div-hrd', 'HRD & GA', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Selesai! Seluruh tabel dan data lama berhasil dipindahkan ke Supabase baru.
