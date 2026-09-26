import React, { useState, useEffect } from 'react';
import { Meeting } from '../types';
import {
  SUPABASE_SQL_MIGRATION,
  getSupabaseConfig,
  setSupabaseCredentials,
  clearSupabaseCredentials,
  testSupabaseConnection,
} from '../lib/supabase';
import {
  Database,
  X,
  Copy,
  Shield,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Save,
  Radio,
} from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];
  onConnectSuccess?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  meetings,
  onConnectSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'sql' | 'architecture' | 'env' | 'rls'>('connect');
  const [copied, setCopied] = useState<string | null>(null);

  // Form states
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tables?: { meetings: boolean; tasks: boolean };
  } | null>(null);
  const [currentConfig, setCurrentConfig] = useState(getSupabaseConfig());

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setCurrentConfig(cfg);
      setUrl(cfg.url || '');
      setAnonKey(cfg.anonKey || '');
      setTestResult(null);

      if (cfg.url && cfg.anonKey) {
        setIsTesting(true);
        testSupabaseConnection(cfg.url, cfg.anonKey).then((res) => {
          setTestResult(res);
          setIsTesting(false);
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalTasks = meetings.reduce((acc, m) => acc + (m.tasks?.length || 0), 0);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestConnection = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        success: false,
        message: 'Masukkan Project URL dan Anon Key terlebih dahulu.',
      });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(url, anonKey);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Gagal menghubungi Supabase.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!url.trim() || !anonKey.trim()) {
      alert('Harap isi Project URL dan Anon Key Supabase.');
      return;
    }

    try {
      setSupabaseCredentials(url, anonKey);
      const cfg = getSupabaseConfig();
      setCurrentConfig(cfg);
      setTestResult({
        success: true,
        message: 'Kredensial berhasil disimpan! Data akan segera disinkronkan.',
      });

      if (onConnectSuccess) {
        onConnectSuccess();
      }
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err?.message}`);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Apakah Anda yakin ingin menghapus konfigurasi Supabase dari browser ini?')) {
      clearSupabaseCredentials();
      setUrl('');
      setAnonKey('');
      setCurrentConfig(getSupabaseConfig());
      setTestResult(null);
      if (onConnectSuccess) {
        onConnectSuccess();
      }
    }
  };

  const envSample = `# Supabase Environment Configuration
# Salin ke file .env atau panel Settings > Secrets
VITE_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              currentConfig.isConfigured 
                ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-400' 
                : 'bg-amber-500/20 border border-amber-400/40 text-amber-400'
            }`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <span>Konfigurasi & Koneksi Supabase</span>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${
                  currentConfig.isConfigured
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                }`}>
                  {currentConfig.isConfigured ? 'Aktif Terkonfigurasi' : 'Belum Terhubung'}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Penyimpanan cloud PostgreSQL terpusat untuk Data Rapat dan Action Items
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between overflow-x-auto shrink-0">
          <div className="flex items-center gap-1 py-2">
            {[
              { id: 'connect', label: '1. Koneksi & Uji Status' },
              { id: 'sql', label: '2. Skrip SQL (DDL)' },
              { id: 'architecture', label: '3. Arsitektur Relasi' },
              { id: 'env', label: '4. Format .env' },
              { id: 'rls', label: '5. Keamanan RLS' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800'
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
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-md transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Dashboard</span>
          </a>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
          {/* TAB 1: CONNECT & TEST */}
          {activeTab === 'connect' && (
            <div className="space-y-6">
              {/* Connection Status Card */}
              <div className="p-4 rounded-xl border bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    Status Sumber Konfigurasi
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    Sumber: {currentConfig.source === 'env' ? 'Environment Variable (.env)' : currentConfig.source === 'localStorage' ? 'Browser Storage (Tersimpan Lokal)' : 'Belum Dikonfigurasi'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-400 block text-[11px] mb-0.5">Project URL:</span>
                    <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200 truncate block">
                      {currentConfig.url || '<Belum diatur>'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-400 block text-[11px] mb-0.5">Anon Key:</span>
                    <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200 truncate block">
                      {currentConfig.anonKey 
                        ? `${currentConfig.anonKey.slice(0, 12)}••••••••••••••••${currentConfig.anonKey.slice(-6)}` 
                        : '<Belum diatur>'}
                    </span>
                  </div>
                </div>

                {/* Test Result Message */}
                {testResult && (
                  <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    testResult.success 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-semibold">{testResult.message}</div>
                      {testResult.tables && (
                        <div className="flex gap-4 text-[11px] pt-1 font-mono">
                          <span className={testResult.tables.meetings ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            Tabel `meetings`: {testResult.tables.meetings ? '✓ Ditemukan' : '✗ Tidak Ditemukan'}
                          </span>
                          <span className={testResult.tables.tasks ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            Tabel `tasks`: {testResult.tables.tasks ? '✓ Ditemukan' : '✗ Tidak Ditemukan'}
                          </span>
                        </div>
                      )}
                      {!testResult.success && (
                        <div className="text-[11px] text-rose-700 dark:text-rose-300 pt-1">
                          Tip: Pastikan URL dan Anon Key sudah benar, dan skrip SQL pada tab "2. Skrip SQL (DDL)" telah dijalankan di SQL Editor dashboard Supabase Anda.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Input URL and Key */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Input Kredensial Supabase Langsung
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Anda dapat memasukkan kredensial Supabase di sini tanpa perlu rebuild aplikasi. Kredensial akan disimpan di browser Anda secara aman.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://xyzcompany.supabase.co"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Supabase Anon Public API Key
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={anonKey}
                      onChange={(e) => setAnonKey(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(url, anonKey)}
                      disabled={isTesting || !url || !anonKey}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                    </button>

                    <button
                      onClick={handleSave}
                      disabled={!url || !anonKey}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan & Sinkronkan</span>
                    </button>
                  </div>

                  {currentConfig.source === 'localStorage' && (
                    <button
                      onClick={handleDisconnect}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Kredensial Browser</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SQL DDL SCRIPT */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  Skrip DDL Siap Dijalankan di Supabase SQL Editor:
                </span>
                <button
                  onClick={() => copyToClipboard(SUPABASE_SQL_MIGRATION, 'sql')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg shadow-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied === 'sql' ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Skrip SQL'}</span>
                </button>
              </div>

              <pre className="p-4 bg-zinc-950 text-zinc-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed max-h-96 border border-zinc-800">
                {SUPABASE_SQL_MIGRATION}
              </pre>
            </div>
          )}

          {/* TAB 3: ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Alur Integrasi Supabase ke Sistem
                </h4>
                <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    <strong className="text-zinc-900 dark:text-zinc-200">Buat Proyek di Supabase:</strong> Masuk ke dashboard Supabase dan buat proyek baru (Region terdekat misal Singapore / <code>ap-southeast-1</code>).
                  </li>
                  <li>
                    <strong className="text-zinc-900 dark:text-zinc-200">Jalankan Skrip SQL Migration:</strong> Buka tab <strong>SQL Editor</strong> di dashboard Supabase Anda, salin skrip dari tab <em>"2. Skrip SQL (DDL)"</em> dan klik <strong>Run</strong>.
                  </li>
                  <li>
                    <strong className="text-zinc-900 dark:text-zinc-200">Ambil API Credentials:</strong> Masuk ke <strong>Project Settings ➔ API</strong>, lalu salin <code>Project URL</code> dan <code>anon public key</code>.
                  </li>
                  <li>
                    <strong className="text-zinc-900 dark:text-zinc-200">Konfigurasi & Uji:</strong> Masukkan kredensial di tab <em>"1. Koneksi & Uji Status"</em> atau masukkan ke file <code>.env</code>.
                  </li>
                </ol>
              </div>

              {/* ERD Structure */}
              <div className="p-5 bg-zinc-950 text-white rounded-xl border border-zinc-800">
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
├── status: TEXT                 <-- 4d. Status ('To Do' | 'In Progress' | 'Done' | 'Pending Approval')
└── created_at / updated_at: TIMESTAMPTZ`}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ENV CREDENTIALS */}
          {activeTab === 'env' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  Format Variabel Environment Supabase:
                </span>
                <button
                  onClick={() => copyToClipboard(envSample, 'env')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied === 'env' ? 'Tersalin!' : 'Salin Template .env'}</span>
                </button>
              </div>

              <pre className="p-4 bg-zinc-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-zinc-800">
                {envSample}
              </pre>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>Keamanan Kunci Rahasia:</span>
                </div>
                <p>
                  Gunakan <code>VITE_SUPABASE_ANON_KEY</code> untuk akses publik dari browser yang dilindungi RLS. Simpan <code>SUPABASE_SERVICE_ROLE_KEY</code> hanya di server-side untuk operasi administratif tanpa batasan RLS.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: RLS POLICIES */}
          {activeTab === 'rls' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Kebijakan Row Level Security (RLS)
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Supabase menggunakan sistem Postgres RLS untuk mengamankan data. Pada skrip SQL yang disediakan, RLS telah diaktifkan secara default untuk melindungi tabel <code>meetings</code> dan <code>tasks</code>.
                </p>
              </div>

              <div className="p-4 bg-zinc-950 text-zinc-200 rounded-xl font-mono space-y-2 border border-zinc-800">
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
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between shrink-0">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Arsitektur kompatibel 100% dengan PostgreSQL & Supabase Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

