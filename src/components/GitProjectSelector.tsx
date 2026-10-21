import React, { useState, useEffect } from 'react';
import { GitProject } from '../types';
import { api } from '../api/client';
import { FolderGit2, Plus, Check, X, AlertCircle, ExternalLink } from 'lucide-react';

interface GitProjectSelectorProps {
  value?: string; // repo string e.g. "muhalhanifiyyah-max/raja-kerupuk"
  onChange: (repo: string) => void;
  label?: string;
  helperText?: string;
  className?: string;
}

export const GitProjectSelector: React.FC<GitProjectSelectorProps> = ({
  value = '',
  onChange,
  label = 'Project Git (Khusus Tim IT)',
  helperText = 'Pilih atau tambahkan repositori GitHub yang terhubung dengan task ini.',
  className = '',
}) => {
  const [projects, setProjects] = useState<GitProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRepo, setNewRepo] = useState('');
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGitProjects();
      setProjects(data);
    } catch (err: any) {
      console.warn('Gagal memuat git projects:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

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
      await loadProjects();
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

  const selectedProj = projects.find((p) => p.repo.toLowerCase() === (value || '').toLowerCase());

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <FolderGit2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>{label}</span>
        </label>
        <button
          type="button"
          onClick={() => {
            setIsAddingNew(!isAddingNew);
            setErrorMsg('');
          }}
          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>{isAddingNew ? 'Batal' : '+ Add Project Git'}</span>
        </button>
      </div>

      {helperText && !isAddingNew && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{helperText}</p>
      )}

      {/* Select Existing Project */}
      {!isAddingNew ? (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isLoading}
            className="notion-input text-xs w-full cursor-pointer bg-white dark:bg-zinc-900 pr-8 font-medium"
          >
            <option value="">-- (Tidak terhubung ke Project Git) --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.repo}>
                {p.name} ({p.repo})
              </option>
            ))}
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
        /* Form Add New Git Project */
        <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              Tambah Project Git Baru
            </span>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-2 text-[11px] bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 mb-0.5">
                Nama Project (contoh: Raja Kerupuk, Task Management, API Server):
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
                Repositori GitHub (owner/repo atau URL lengkap):
              </label>
              <input
                type="text"
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                placeholder="contoh: muhalhanifiyyah-max/raja-kerupuk"
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
              className="notion-btn notion-btn-primary text-xs px-3 py-1 flex items-center gap-1"
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
