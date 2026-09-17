/**
 * Supabase Architecture & Client Provider
 * 
 * Konfigurasi arsitektur Supabase untuk sistem manajemen rapat & tindak lanjut (1:N):
 * 1. Mendukung koneksi client-side (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * 2. Mendukung koneksi server-side (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)
 * 3. Menyediakan helper query tersinkronisasi untuk 4 data inti (Meeting Date, Participants, Notes, Tasks)
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  // Cek env client (VITE_) atau runtime window config
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const procEnv = typeof process !== 'undefined' ? process.env : undefined;

  const supabaseUrl = metaEnv?.VITE_SUPABASE_URL ||
                      procEnv?.VITE_SUPABASE_URL ||
                      procEnv?.SUPABASE_URL ||
                      (typeof window !== 'undefined' && (window as any).__SUPABASE_URL__);

  const supabaseAnonKey = metaEnv?.VITE_SUPABASE_ANON_KEY ||
                          procEnv?.VITE_SUPABASE_ANON_KEY ||
                          procEnv?.SUPABASE_ANON_KEY ||
                          (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY__);

  if (supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseClient;
}

export const SUPABASE_SQL_MIGRATION = `-- ==========================================================
-- SUPABASE MIGRATION SCRIPT (POSTGRESQL)
-- Sistem Manajemen Tugas Berbasis Notula Rapat (1:N Architecture)
-- 4 Core Data Fields:
-- 1. meeting_date (Tanggal Rapat)
-- 2. participants (Peserta)
-- 3. meeting_notes (Catatan Notula)
-- 4. tasks (Tindak Lanjut: title, assignee, due_date, status)
-- ==========================================================

-- 1. Tabel Parent: Meetings (Rapat & Notula)
CREATE TABLE IF NOT EXISTS public.meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    meeting_date DATE NOT NULL,                         -- Core Field 1: Tanggal Rapat
    participants TEXT[] NOT NULL DEFAULT '{}',          -- Core Field 2: Peserta
    meeting_notes TEXT NOT NULL,                        -- Core Field 3: Catatan Notula
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabel Children: Tasks (Action Items Tindak Lanjut - 1:N)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE, -- 1:N CASCADE
    title TEXT NOT NULL,                                -- Core Field 4a: Judul Tindakan
    assignee TEXT NOT NULL,                             -- Core Field 4b: Penanggung Jawab
    due_date DATE NOT NULL,                             -- Core Field 4c: Tenggat Waktu
    status TEXT NOT NULL DEFAULT 'To Do',               -- Core Field 4d: Status
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_task_status CHECK (status IN ('To Do', 'In Progress', 'Done', 'Pending Approval'))
);

-- 3. Indexes untuk performa kueri relasional tinggi
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON public.tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON public.meetings(meeting_date DESC);

-- 4. Row Level Security (RLS) Supabase Policies
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Izinkan akses baca (read) & tulis (write) untuk klien terotentikasi dan anon publik
CREATE POLICY "Allow public read on meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on meetings" ON public.meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on meetings" ON public.meetings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on meetings" ON public.meetings FOR DELETE USING (true);

CREATE POLICY "Allow public read on tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on tasks" ON public.tasks FOR DELETE USING (true);
`;
