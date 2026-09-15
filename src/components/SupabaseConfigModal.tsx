import React, { useState } from 'react';
import { Meeting } from '../types';
import { SUPABASE_SQL_MIGRATION } from '../lib/supabase';
import {
  Database,
  X,
  Code,
  CheckCircle,
  Copy,
  Download,
  Terminal,
  Key,
  Shield,
  ExternalLink,
  Zap,
  Server
} from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  meetings,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'sql' | 'env' | 'rls'>('architecture');
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalTasks = meetings.reduce((acc, m) => acc + (m.tasks?.length || 0), 0);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const envSample = `# Supabase Environment Configuration
# Salin ke file .env atau panel Settings > Secrets
VITE_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <span>Arsitektur Supabase (PostgreSQL 1:N)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-400/30">
                  Ready for SQL Editor
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Skema tabel relasional lengkap untuk 4 data inti rapat & action items
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 py-2">
            {[
              { id: 'architecture', label: '1. Panduan Arsitektur' },
              { id: 'sql', label: '2. Skrip SQL Supabase (DDL)' },
              { id: 'env', label: '3. Konfigurasi Kunci API & Env' },
              { id: 'rls', label: '4. Keamanan & Kebijakan RLS' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Supabase Dashboard</span>
          </a>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-600" />
                  Alur Integrasi Supabase ke Sistem
                </h4>
                <ol className="text-xs text-zinc-600 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    <strong className="text-zinc-900">Buat Proyek di Supabase:</strong> Masuk ke dashboard Supabase dan buat proyek baru (pilih Region terdekat, misal Singapore / <code>ap-southeast-1</code>).
                  </li>
                  <li>
                    <strong className="text-zinc-900">Jalankan Skrip SQL Migration:</strong> Buka tab <strong>SQL Editor</strong> di dashboard Supabase Anda, salin skrip dari tab <em>"2. Skrip SQL Supabase"</em> dan klik <strong>Run</strong>.
                  </li>
                  <li>
                    <strong className="text-zinc-900">Ambil API Credentials:</strong> Masuk ke <strong>Project Settings ➔ API</strong>, lalu salin <code>Project URL</code> dan <code>anon public key</code>.
                  </li>
                  <li>
                    <strong className="text-zinc-900">Konfigurasi Environment:</strong> Masukkan variabel ke file <code>.env</code> atau panel Settings agar aplikasi terhubung otomatis.
                  </li>
                </ol>
              </div>

              {/* ERD Structure */}
              <div className="p-5 bg-zinc-900 text-white rounded-xl">
                <span className="text-xs font-mono text-zinc-400 block mb-2">
                  Relasi Tabel Supabase PostgreSQL:
                </span>
                <div className="font-mono text-xs text-zinc-300 leading-relaxed bg-black/40 p-4 rounded-lg overflow-x-auto">
{`public.meetings (1 Parent)
├── id: TEXT PRIMARY KEY
├── meeting_date: DATE           <-- 1. Tanggal Rapat
├── participants: TEXT[]         <-- 2. Peserta
├── meeting_notes: TEXT          <-- 3. Catatan Notula
└── created_at / updated_at: TIMESTAMPTZ

       │ (Relasi 1:N One-to-Many - ON DELETE CASCADE)
       ▼
public.tasks (N Children)
├── id: TEXT PRIMARY KEY
├── meeting_id: TEXT             <-- FOREIGN KEY REFERENCES public.meetings(id)
├── title: TEXT                  <-- 4a. Judul Tindakan
├── assignee: TEXT               <-- 4b. Penanggung Jawab
├── due_date: DATE               <-- 4c. Tenggat Waktu
├── status: TEXT                 <-- 4d. Status ('To Do' | 'In Progress' | 'Done' | 'Blocked')
└── created_at / updated_at: TIMESTAMPTZ`}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SQL DDL SCRIPT */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-mono">
                  Siap di-run langsung di Supabase SQL Editor:
                </span>
                <button
                  onClick={() => copyToClipboard(SUPABASE_SQL_MIGRATION, 'sql')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied === 'sql' ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Skrip SQL'}</span>
                </button>
              </div>

              <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed max-h-96">
                {SUPABASE_SQL_MIGRATION}
              </pre>
            </div>
          )}

          {/* TAB 3: ENV CREDENTIALS */}
          {activeTab === 'env' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-mono">
                  Format Variabel Environment Supabase:
                </span>
                <button
                  onClick={() => copyToClipboard(envSample, 'env')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-lg"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied === 'env' ? 'Tersalin!' : 'Salin Template .env'}</span>
                </button>
              </div>

              <pre className="p-4 bg-zinc-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
                {envSample}
              </pre>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-700" />
                  <span>Keamanan Kunci Rahasia:</span>
                </div>
                <p>
                  Gunakan <code>VITE_SUPABASE_ANON_KEY</code> untuk akses publik dari browser yang dilindungi RLS. Simpan <code>SUPABASE_SERVICE_ROLE_KEY</code> hanya di server-side untuk operasi administratif tanpa batasan RLS.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: RLS POLICIES */}
          {activeTab === 'rls' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <h4 className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Kebijakan Row Level Security (RLS)
                </h4>
                <p className="text-zinc-600 leading-relaxed">
                  Supabase menggunakan sistem Postgres RLS untuk mengamankan data. Pada skrip SQL yang disediakan, RLS telah diaktifkan secara default untuk melindungi tabel <code>meetings</code> dan <code>tasks</code>.
                </p>
              </div>

              <div className="p-4 bg-zinc-900 text-zinc-200 rounded-xl font-mono space-y-2">
                <div className="text-zinc-400">// Contoh Pengaturan RLS per Pengguna (Jika menggunakan Supabase Auth):</div>
                <div className="text-emerald-400 leading-relaxed">
{`-- Batasi akses hanya untuk pemilik meeting
CREATE POLICY "Users can manage own meetings" 
ON public.meetings 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-zinc-500">
            Arsitektur kompatibel 100% dengan PostgreSQL & Supabase Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
