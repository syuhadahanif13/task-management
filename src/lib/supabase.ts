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
let isFetchingServerConfig = false;

export function getSupabaseConfig(): {
  url: string | null;
  anonKey: string | null;
  isConfigured: boolean;
  source: 'env' | 'localStorage' | 'window' | 'none';
} {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const procEnv = typeof process !== 'undefined' ? process.env : undefined;

  const envUrl = metaEnv?.VITE_SUPABASE_URL || procEnv?.VITE_SUPABASE_URL || procEnv?.SUPABASE_URL;
  const envKey = metaEnv?.VITE_SUPABASE_ANON_KEY || procEnv?.VITE_SUPABASE_ANON_KEY || procEnv?.SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey, isConfigured: true, source: 'env' };
  }

  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_url') : null;
  const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_anon_key') : null;

  if (localUrl && localKey) {
    return { url: localUrl, anonKey: localKey, isConfigured: true, source: 'localStorage' };
  }

  const winUrl = typeof window !== 'undefined' ? (window as any).__SUPABASE_URL__ : null;
  const winKey = typeof window !== 'undefined' ? (window as any).__SUPABASE_ANON_KEY__ : null;

  if (winUrl && winKey) {
    return { url: winUrl, anonKey: winKey, isConfigured: true, source: 'window' };
  }

  return { url: null, anonKey: null, isConfigured: false, source: 'none' };
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const config = getSupabaseConfig();
  if (config.url && config.anonKey) {
    try {
      supabaseClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (err) {
      console.warn('Failed to create Supabase client:', err);
    }
  }

  return supabaseClient;
}

export function setSupabaseCredentials(url: string, anonKey: string): SupabaseClient | null {
  const trimmedUrl = url.trim().replace(/\/$/, '');
  const trimmedKey = anonKey.trim();

  if (!trimmedUrl || !trimmedKey) {
    clearSupabaseCredentials();
    return null;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('supabase_url', trimmedUrl);
      localStorage.setItem('supabase_anon_key', trimmedKey);
    }
    supabaseClient = createClient(trimmedUrl, trimmedKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabaseConfigUpdated', { detail: { url: trimmedUrl } }));
    }

    return supabaseClient;
  } catch (err) {
    console.error('Error creating Supabase client with provided credentials:', err);
    throw err;
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
  }
  supabaseClient = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabaseConfigUpdated', { detail: { url: null } }));
  }
}

/**
 * Asynchronously initialize Supabase from backend /api/supabase/config if client env was missing
 */
export async function initSupabaseClient(): Promise<SupabaseClient | null> {
  const existing = getSupabaseClient();
  if (existing) return existing;

  if (isFetchingServerConfig) return null;
  isFetchingServerConfig = true;

  try {
    const res = await fetch('/api/supabase/config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.supabaseUrl && data.supabaseAnonKey) {
        return setSupabaseCredentials(data.supabaseUrl, data.supabaseAnonKey);
      }
    }
  } catch (err) {
    console.warn('Could not auto-fetch Supabase configuration from server:', err);
  } finally {
    isFetchingServerConfig = false;
  }

  return null;
}

export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ success: boolean; message: string; tables: { meetings: boolean; tasks: boolean } }> {
  try {
    let client: SupabaseClient | null = null;
    if (customUrl && customKey) {
      client = createClient(customUrl.trim().replace(/\/$/, ''), customKey.trim());
    } else {
      client = getSupabaseClient();
    }

    if (!client) {
      return {
        success: false,
        message: 'Klien Supabase belum dikonfigurasi. Masukkan URL dan Kunci Anon.',
        tables: { meetings: false, tasks: false },
      };
    }

    // Test meetings table
    const [meetingsRes, tasksRes] = await Promise.all([
      client.from('meetings').select('count', { count: 'exact', head: true }),
      client.from('tasks').select('count', { count: 'exact', head: true }),
    ]);

    const meetingsOk = !meetingsRes.error;
    const tasksOk = !tasksRes.error;

    if (meetingsOk && tasksOk) {
      return {
        success: true,
        message: `Koneksi berhasil! Ditemukan tabel meetings dan tasks.`,
        tables: { meetings: true, tasks: true },
      };
    }

    if (meetingsOk && !tasksOk) {
      return {
        success: true,
        message: `Koneksi berhasil terhubung, namun tabel 'tasks' belum ditemukan. Jalankan skrip SQL migrasi.`,
        tables: { meetings: true, tasks: false },
      };
    }

    if (!meetingsOk && tasksOk) {
      return {
        success: true,
        message: `Koneksi berhasil terhubung, namun tabel 'meetings' belum ditemukan. Jalankan skrip SQL migrasi.`,
        tables: { meetings: false, tasks: true },
      };
    }

    return {
      success: false,
      message: `Gagal mengakses tabel Supabase: ${meetingsRes.error?.message || tasksRes.error?.message || 'Akses ditolak (RLS) atau tabel belum dibuat.'}`,
      tables: { meetings: false, tasks: false },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error koneksi: ${err?.message || 'Tidak dapat terhubung ke server Supabase.'}`,
      tables: { meetings: false, tasks: false },
    };
  }
}

export const SUPABASE_SQL_MIGRATION = `-- ==========================================================
-- SUPABASE MIGRATION SCRIPT (POSTGRESQL)
-- Sistem Manajemen Tugas Berbasis Notula Rapat (1:N Architecture)
-- Core Modules:
-- 1. meetings (Rapat & Notula)
-- 2. tasks (Tindak Lanjut)
-- 3. divisions (Divisi Perusahaan)
-- 4. users (Pengguna & Hak Akses)
-- 5. task_submissions (Bukti Kerja & Lampiran)
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
    priority TEXT DEFAULT 'Medium',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_task_status CHECK (status IN ('To Do', 'In Progress', 'Done', 'Pending Approval'))
);

-- Pastikan constraint status pada tabel tasks yang sudah ada diperbarui mendukung 'Pending Approval'
DO $$ 
BEGIN
    ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS chk_task_status;
    ALTER TABLE public.tasks ADD CONSTRAINT chk_task_status CHECK (status IN ('To Do', 'In Progress', 'Done', 'Pending Approval'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Tabel Divisions (Divisi Organisasi)
CREATE TABLE IF NOT EXISTS public.divisions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Tabel Users (Pengguna Akun & Peran)
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

-- 5. Tabel Task Submissions (Bukti Penyelesaian Tugas)
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

-- 6. Indexes untuk performa kueri relasional tinggi
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON public.tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON public.meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_divisions_name ON public.divisions(name);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON public.task_submissions(task_id);

-- 7. Row Level Security (RLS) Supabase Policies
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

-- Izinkan akses baca (read) & tulis (write) untuk klien terotentikasi dan anon publik
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
`;
