import React, { useState, useEffect } from 'react';
import { GitProject, GitHubConnectedRepo, isUserLoggedInWithGitHub } from '../types';
import { api } from '../api/client';
import { FolderGit2, Plus, Check, X, AlertCircle, ExternalLink, RefreshCw, Github, CheckCircle2 } from 'lucide-react';

interface GitProjectSelectorProps {
  value?: string; // repo string e.g. "syuhadahanif13/task-management"
  onChange: (repo: string) => void;
  currentUser?: { id?: string; username: string; role?: string; githubUsername?: string | null; githubId?: string | null } | null;
  label?: string;
  helperText?: string;
  className?: string;
}

export const GitProjectSelector: React.FC<GitProjectSelectorProps> = ({
  value = '',
  onChange,
  currentUser,
  label = 'Project Git (Khusus Tim IT)',
  helperText = 'Pilih dari repositori akun GitHub yang terhubung atau tambahkan project Git.',
  className = '',
}) => {
  // Hanya berlaku untuk akun yang login dengan GitHub
  const isGitHubUser = isUserLoggedInWithGitHub(currentUser);

  const [savedProjects, setSavedProjects] = useState<GitProject[]>([]);
  const [githubRepos, setGithubRepos] = useState<GitHubConnectedRepo[]>([]);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [connectedUsername, setConnectedUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRepo, setNewRepo] = useState('');
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Resolve current active user ID from props or sessionStorage
  const activeUserId = currentUser?.id || (() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('currentUser');
        if (raw) return JSON.parse(raw)?.id;
      }
    } catch {}
    return undefined;
  })();

  if (!isGitHubUser) {
    return null;
  }

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Fetch saved projects from MySQL database
      const pPromise = api.getGitProjects().catch(() => [] as GitProject[]);
      
      // 2. Fetch connected GitHub account repositories
      const ghPromise = api.getGitHubRepos(activeUserId).catch(() => ({
        connected: false,
        username: undefined,
        repos: [] as GitHubConnectedRepo[],
      }));

      const [pData, ghData] = await Promise.all([pPromise, ghPromise]);

      setSavedProjects(pData || []);
      if (ghData && ghData.connected) {
        setIsGitHubConnected(true);
        setConnectedUsername(ghData.username || '');
        setGithubRepos(ghData.repos || []);
      } else {
        setIsGitHubConnected(false);
      }
    } catch (err: any) {
      console.warn('Gagal memuat daftar project Git:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeUserId]);

  // Sync all GitHub repositories into MySQL database
  const handleSyncAllRepos = async () => {
    setIsSyncingAll(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.syncGitHubRepos(activeUserId);
      setSuccessMsg(`Berhasil sinkronisasi ${res.addedCount} repositori baru ke database!`);
      await loadData(true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyinkronkan repositori GitHub');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Add new custom Git project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newRepo.trim()) {
      setErrorMsg('Nama project dan repositori GitHub wajib diisi.');
      return;
    }

    setIsSavingNew(true);
    setErrorMsg('');
    try {
      const res = await api.createGitProject({
        name: newName.trim(),
        repo: newRepo.trim(),
      });
      await loadData(true);
      onChange(res.project.repo);
      setNewName('');
      setNewRepo('');
      setIsAddingNew(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan project Git.');
    } finally {
      setIsSavingNew(false);
    }
  };

  // Filter saved projects to not duplicate those already in githubRepos
  const ghRepoSet = new Set(githubRepos.map((r) => r.fullName.toLowerCase()));
  const extraSavedProjects = savedProjects.filter(
    (p) => !ghRepoSet.has(p.repo.toLowerCase())
  );

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Header Label and Action Buttons */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <FolderGit2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>{label}</span>
        </label>

        <div className="flex items-center gap-2">
          {isGitHubConnected && (
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isLoading}
              title="Refresh repositori GitHub"
              className="text-[11px] font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsAddingNew(!isAddingNew);
              setErrorMsg('');
            }}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{isAddingNew ? 'Batal' : '+ Add Manual'}</span>
          </button>
        </div>
      </div>

      {/* GitHub Account Connection Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] py-1 px-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800">
        {isGitHubConnected ? (
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <Github className="w-3 h-3 shrink-0" />
            <span className="truncate">
              Terkoneksi: <strong>@{connectedUsername}</strong> ({githubRepos.length} repositori)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            <Github className="w-3 h-3 shrink-0" />
            <span>Akun GitHub belum terhubung.</span>
            <a
              href="/api/auth/github"
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline ml-1"
            >
              Hubungkan Akun
            </a>
          </div>
        )}

        {isGitHubConnected && githubRepos.length > 0 && (
          <button
            type="button"
            onClick={handleSyncAllRepos}
            disabled={isSyncingAll}
            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer shrink-0 ml-auto"
          >
            {isSyncingAll ? 'Menyinkronkan...' : '📥 Sinkron Semua ke Database'}
          </button>
        )}
      </div>

      {helperText && !isAddingNew && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{helperText}</p>
      )}

      {successMsg && (
        <div className="p-2 text-[11px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2 text-[11px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Select Existing or Connected Project */}
      {!isAddingNew ? (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => {
              const selectedVal = e.target.value;
              onChange(selectedVal);

              // Auto-register to database if chosen from connected GitHub repos and not yet in saved projects
              if (selectedVal) {
                const foundGh = githubRepos.find(
                  (r) => r.fullName.toLowerCase() === selectedVal.toLowerCase()
                );
                const isAlreadySaved = savedProjects.some(
                  (p) => p.repo.toLowerCase() === selectedVal.toLowerCase()
                );
                if (foundGh && !isAlreadySaved) {
                  api.createGitProject({
                    name: foundGh.name,
                    repo: foundGh.fullName,
                    url: foundGh.url,
                    description: foundGh.description,
                  }).then(() => loadData(true)).catch(() => {});
                }
              }
            }}
            disabled={isLoading}
            className="notion-input text-xs w-full cursor-pointer bg-white dark:bg-zinc-900 pr-8 font-medium"
          >
            <option value="">-- (Tidak terhubung ke Project Git) --</option>

            {/* Repositories from Connected GitHub Account */}
            {githubRepos.length > 0 && (
              <optgroup label={`✨ Repositori Akun GitHub (@${connectedUsername || 'Terhubung'})`}>
                {githubRepos.map((gr) => (
                  <option key={`gh-${gr.id}`} value={gr.fullName}>
                    {gr.name} {gr.private ? '🔒' : ''} ({gr.fullName})
                  </option>
                ))}
              </optgroup>
            )}

            {/* Manually Registered / Extra Database Projects */}
            {extraSavedProjects.length > 0 && (
              <optgroup label="📁 Project Git Tersimpan Lainnya">
                {extraSavedProjects.map((p) => (
                  <option key={`saved-${p.id}`} value={p.repo}>
                    {p.name} ({p.repo})
                  </option>
                ))}
              </optgroup>
            )}

            {/* If neither connected repos nor saved projects exist */}
            {githubRepos.length === 0 && savedProjects.length === 0 && (
              <option disabled value="empty">
                Belum ada repositori. Klik '+ Add Manual' atau Hubungkan Akun.
              </option>
            )}
          </select>

          {value && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="truncate">
                Repo aktif: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{value}</strong>
              </span>
              <a
                href={`https://github.com/${value}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 ml-2 shrink-0"
              >
                <span>Buka</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      ) : (
        /* Form Add New Git Project Manually */
        <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              Tambah Project Git Manual
            </span>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 mb-0.5">
                Nama Project (contoh: Raja Kerupuk, Dashboard Mitra, Task Management):
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama Project"
                className="notion-input text-xs w-full"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 mb-0.5">
                Repositori GitHub (format owner/repo atau URL lengkap):
              </label>
              <input
                type="text"
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                placeholder="contoh: syuhadahanif13/dasbor-mitra-raja-emas-indonesia"
                className="notion-input text-xs w-full font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="notion-btn notion-btn-secondary text-xs px-2.5 py-1"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={isSavingNew || !newName.trim() || !newRepo.trim()}
              className="notion-btn notion-btn-primary text-xs px-3 py-1 flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>{isSavingNew ? 'Menyimpan...' : 'Simpan & Pilih'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
