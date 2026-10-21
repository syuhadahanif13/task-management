import React, { useState, useEffect } from 'react';
import { Task, GitHubTaskMetadata } from '../types';
import { api } from '../api/client';
import {
  X,
  GitBranch,
  GitPullRequest,
  GitCommit,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  FolderGit2,
  Lock,
  Sparkles,
} from 'lucide-react';

interface GitHubDevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  currentUser?: { id?: string; username: string; role?: string; githubUsername?: string | null; githubAccessToken?: string | null } | null;
  onTaskUpdated?: (updatedTask: Task) => void;
}

export const GitHubDevPanel: React.FC<GitHubDevPanelProps> = ({
  isOpen,
  onClose,
  task,
  currentUser,
  onTaskUpdated,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dev Data from API
  const [devData, setDevData] = useState<{
    taskKey: string;
    repo: string;
    hasToken: boolean;
    recommendedBranchName: string;
    recommendedGitCommand: string;
    recommendedCommitMsg: string;
    branches: Array<{ name: string; url?: string; lastCommit?: string }>;
    commits: Array<{ id: string; message: string; author: string; authorAvatar?: string; url: string; timestamp?: string }>;
    pullRequests: Array<{ number: number; title: string; url: string; state: 'open' | 'closed' | 'merged'; author: string; authorAvatar?: string; branch?: string; mergedAt?: string }>;
    counts: { branches: number; commits: number; pullRequests: number };
    lastSyncedAt?: string;
  } | null>(null);

  // Manual link inputs
  const [linkInputUrl, setLinkInputUrl] = useState('');
  const [linkInputBranch, setLinkInputBranch] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadDevInfo = async (silent = false) => {
    if (!task) return;
    if (!silent) setIsLoading(true);
    else setIsSyncing(true);
    setErrorMsg('');

    try {
      const data = await api.getTaskGitHubDev(task.id, task.githubRepo, currentUser?.id);
      setDevData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat integrasi GitHub');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isOpen && task) {
      loadDevInfo();
      setLinkInputUrl('');
      setLinkInputBranch('');
    }
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLinkManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInputUrl.trim() && !linkInputBranch.trim()) return;

    setIsLinking(true);
    setErrorMsg('');
    try {
      const res = await api.linkGitHubItem({
        taskId: task.id,
        url: linkInputUrl.trim() || undefined,
        branch: linkInputBranch.trim() || undefined,
        userId: currentUser?.id,
      });

      if (res.task && onTaskUpdated) {
        onTaskUpdated(res.task);
      }
      setLinkInputUrl('');
      setLinkInputBranch('');
      await loadDevInfo(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menautkan item GitHub');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (itemType: 'pr' | 'commit' | 'branch', itemId: string | number) => {
    try {
      await api.unlinkGitHubItem({
        taskId: task.id,
        itemType,
        itemId,
      });
      await loadDevInfo(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus tautan');
    }
  };

  const taskKey = devData?.taskKey || `REI-${task.id.slice(-4)}`;
  const repoName = devData?.repo || task.githubRepo || 'syuhadahanif13/task-management';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0 shadow-xs">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  {taskKey}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                  GitHub Development (Jira Tracking)
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[340px] sm:max-w-md">
                {task.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDevInfo(true)}
              disabled={isSyncing || isLoading}
              className={`p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition-colors ${isSyncing ? 'animate-spin text-indigo-600' : ''}`}
              title="Sinkronkan dengan GitHub"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Repo Link Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-500 dark:text-zinc-400">Repository:</span>
              <a
                href={`https://github.com/${repoName}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 truncate"
              >
                <span>{repoName}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {currentUser?.githubUsername ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  @{currentUser.githubUsername}
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3" />
                  Token Umum
                </span>
              )}
            </div>
          </div>

          {/* Jira-Style 3 Summary Stat Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 sm:p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Branches</p>
                <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {devData?.counts.branches || 0}
                </p>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <GitPullRequest className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Pull Requests</p>
                <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {devData?.counts.pullRequests || 0}
                </p>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <GitCommit className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Commits</p>
                <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {devData?.counts.commits || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Jira Branch & Git Command Helper */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-sky-950/10 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Jira Quick Git Actions
                </h3>
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                Auto-generated convention
              </span>
            </div>

            {/* Git checkout command */}
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                Perintah Buat Branch Baru:
              </p>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-xs overflow-x-auto gap-2">
                <span className="text-emerald-400 select-all truncate">
                  {devData?.recommendedGitCommand || `git checkout -b feature/${taskKey}-${slugify(task.title)}`}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(devData?.recommendedGitCommand || '', 'branch-cmd')}
                  className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition flex items-center gap-1 text-[11px] shrink-0"
                >
                  {copiedKey === 'branch-cmd' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Commit message template */}
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                Format Pesan Commit (Auto-link ke Task):
              </p>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-xs overflow-x-auto gap-2">
                <span className="text-amber-300 select-all truncate">
                  {devData?.recommendedCommitMsg || `feat(${taskKey}): ${task.title.slice(0, 40)} #${taskKey}`}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(devData?.recommendedCommitMsg || '', 'commit-msg')}
                  className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition flex items-center gap-1 text-[11px] shrink-0"
                >
                  {copiedKey === 'commit-msg' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Connected Pull Requests */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <GitPullRequest className="w-3.5 h-3.5 text-purple-600" />
              <span>Pull Requests Terhubung ({devData?.pullRequests?.length || 0})</span>
            </h4>

            {devData?.pullRequests && devData.pullRequests.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                {devData.pullRequests.map((pr) => {
                  const isMerged = pr.state === 'merged';
                  const isOpen = pr.state === 'open';

                  return (
                    <div key={pr.number} className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                          isMerged
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : isOpen
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {isMerged ? 'Merged' : isOpen ? 'Open' : 'Closed'}
                        </span>
                        <div className="min-w-0">
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate block"
                          >
                            #{pr.number} {pr.title}
                          </a>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            oleh <span className="font-medium text-zinc-700 dark:text-zinc-300">@{pr.author}</span>
                            {pr.branch && <span> • branch: <code className="font-mono">{pr.branch}</code></span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-zinc-400 hover:text-indigo-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          title="Buka di GitHub"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleUnlink('pr', pr.number)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          title="Hapus tautan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                Belum ada Pull Request yang terhubung. Buat PR dengan judul atau branch mencantumkan ID task <code className="font-mono">#{taskKey}</code>.
              </p>
            )}
          </div>

          {/* Section 3: Connected Commits */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <GitCommit className="w-3.5 h-3.5 text-emerald-600" />
              <span>Commits Terhubung ({devData?.commits?.length || 0})</span>
            </h4>

            {devData?.commits && devData.commits.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                {devData.commits.map((c) => (
                  <div key={c.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                    <div className="min-w-0 flex items-center gap-2">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                      >
                        {c.id}
                      </a>
                      <span className="text-xs text-zinc-800 dark:text-zinc-200 truncate">
                        {c.message}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10px] text-zinc-400">
                      <span>{c.author}</span>
                      <button
                        type="button"
                        onClick={() => handleUnlink('commit', c.id)}
                        className="p-1 text-zinc-400 hover:text-rose-600 rounded transition"
                        title="Hapus tautan commit"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                Belum ada commit terdeteksi. Sertakan <code className="font-mono">#{taskKey}</code> pada pesan commit Anda.
              </p>
            )}
          </div>

          {/* Section 4: Manual Linker */}
          <form onSubmit={handleLinkManual} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tautkan PR atau Branch Secara Manual</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="url"
                value={linkInputUrl}
                onChange={(e) => setLinkInputUrl(e.target.value)}
                placeholder="https://github.com/.../pull/12"
                className="notion-input text-xs"
              />
              <input
                type="text"
                value={linkInputBranch}
                onChange={(e) => setLinkInputBranch(e.target.value)}
                placeholder="Nama branch (misal: feature/api-sync)"
                className="notion-input text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isLinking || (!linkInputUrl.trim() && !linkInputBranch.trim())}
              className="notion-btn notion-btn-primary text-xs w-full justify-center"
            >
              {isLinking ? 'Menautkan...' : 'Tautkan ke Task Ini'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 35);
}
