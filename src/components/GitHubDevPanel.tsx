import React, { useState, useEffect } from 'react';
import { Task, GitHubTaskMetadata, GitHubIssue, GitHubProjectRef } from '../types';
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
  LayoutGrid,
  CircleDot,
  CheckCircle2,
  ArrowUpRight,
  Layers,
  HelpCircle,
  Unlink,
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
  const [activeTab, setActiveTab] = useState<'project' | 'dev'>('project');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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
    issue?: GitHubIssue | null;
    project?: GitHubProjectRef | null;
    githubIssueUrl?: string | null;
    githubProjectUrl?: string | null;
    counts: { branches: number; commits: number; pullRequests: number };
    lastSyncedAt?: string;
  } | null>(null);

  // GitHub Projects list
  const [availableProjects, setAvailableProjects] = useState<Array<{
    id: string;
    number: number;
    title: string;
    url: string;
    owner: string;
    description?: string;
  }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [customProjectUrl, setCustomProjectUrl] = useState('');
  const [isLinkingProject, setIsLinkingProject] = useState(false);

  // Issues states
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isUpdatingIssueStatus, setIsUpdatingIssueStatus] = useState(false);
  const [manualIssueInput, setManualIssueInput] = useState('');
  const [isLinkingIssue, setIsLinkingIssue] = useState(false);

  // Manual link inputs (Dev tab)
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

      // Fetch projects list in parallel if token is available
      if (data.hasToken) {
        api.getGitHubProjects(data.repo, currentUser?.id)
          .then((pRes) => {
            if (pRes.projects && pRes.projects.length > 0) {
              setAvailableProjects(pRes.projects);
            }
          })
          .catch(() => {});
      }
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
      setManualIssueInput('');
      setCustomProjectUrl('');
      setSelectedProjectId('');
      setSuccessMsg('');
    }
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. Create GitHub Issue
  const handleCreateIssue = async () => {
    if (!task) return;
    setIsCreatingIssue(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const chosenProject = availableProjects.find((p) => p.id === selectedProjectId);
      const res = await api.createGitHubIssue({
        taskId: task.id,
        repo: devData?.repo,
        projectId: selectedProjectId || (devData?.project?.id ? String(devData.project.id) : undefined),
        projectTitle: chosenProject?.title || devData?.project?.title,
        projectUrl: chosenProject?.url || devData?.project?.url,
        userId: currentUser?.id,
      });

      setSuccessMsg(`Issue #${res.issue.number} berhasil dibuat di GitHub!`);
      if (res.task && onTaskUpdated) {
        onTaskUpdated(res.task);
      }
      await loadDevInfo(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat issue di GitHub');
    } finally {
      setIsCreatingIssue(false);
    }
  };

  // 2. Link Existing Issue Manually
  const handleLinkIssueManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIssueInput.trim()) return;

    setIsLinkingIssue(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.linkGitHubItem({
        taskId: task.id,
        url: manualIssueInput.trim(),
        repo: devData?.repo,
        userId: currentUser?.id,
      });

      setSuccessMsg('Issue GitHub berhasil dihubungkan!');
      if (res.task && onTaskUpdated) {
        onTaskUpdated(res.task);
      }
      setManualIssueInput('');
      await loadDevInfo(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menautkan issue GitHub');
    } finally {
      setIsLinkingIssue(false);
    }
  };

  // 3. Update / Close / Reopen Issue
  const handleUpdateIssueState = async (state: 'open' | 'closed', syncTaskDone = false) => {
    if (!task) return;
    setIsUpdatingIssueStatus(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.updateGitHubIssueStatus({
        taskId: task.id,
        state,
        syncTaskDone,
        userId: currentUser?.id,
      });

      setSuccessMsg(`Status Issue berhasil diubah menjadi ${state.toUpperCase()}`);
      if (res.task && onTaskUpdated) {
        onTaskUpdated(res.task);
      }
      await loadDevInfo(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah status issue');
    } finally {
      setIsUpdatingIssueStatus(false);
    }
  };

  // 4. Link Project (selected or custom URL)
  const handleLinkProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = availableProjects.find((p) => p.id === selectedProjectId);
    const targetUrl = customProjectUrl.trim() || chosen?.url;

    if (!targetUrl) return;

    setIsLinkingProject(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.linkGitHubProject({
        taskId: task.id,
        projectUrl: targetUrl,
        projectTitle: chosen?.title || (targetUrl.includes('/projects/') ? `Project #${targetUrl.split('/projects/')[1]}` : 'GitHub Project'),
        projectId: chosen?.id,
      });

      setSuccessMsg('Task berhasil dihubungkan ke GitHub Project!');
      if (res.task && onTaskUpdated) {
        onTaskUpdated(res.task);
      }
      setCustomProjectUrl('');
      setSelectedProjectId('');
      await loadDevInfo(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menautkan GitHub Project');
    } finally {
      setIsLinkingProject(false);
    }
  };

  // 5. Unlink item
  const handleUnlink = async (itemType: 'pr' | 'commit' | 'branch' | 'issue' | 'project', itemId?: string | number) => {
    try {
      const res = await api.unlinkGitHubItem({
        taskId: task.id,
        itemType,
        itemId,
      });
      if (res.task && onTaskUpdated) {
        onTaskUpdated(res.task);
      }
      await loadDevInfo(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus tautan');
    }
  };

  // 6. Manual PR or Branch Link
  const handleLinkManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInputUrl.trim() && !linkInputBranch.trim()) return;

    setIsLinking(true);
    setErrorMsg('');
    setSuccessMsg('');
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

  const taskKey = devData?.taskKey || `REI-${task.id.slice(-4)}`;
  const repoName = devData?.repo || task.githubRepo || 'syuhadahanif13/task-management';
  const issueData = devData?.issue || task.githubMetadata?.issue;
  const projectData = devData?.project || task.githubMetadata?.project;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
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
                  Integrasi GitHub (Project & Dev)
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[340px] sm:max-w-md">
                {task.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadDevInfo(false)}
              disabled={isLoading || isSyncing}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Refresh status dari GitHub"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing || isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 px-5 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('project')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'project'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900 rounded-t-lg shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>GitHub Project & Issue</span>
            {issueData && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                issueData.state === 'closed'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}>
                #{issueData.number}
              </span>
            )}
            {projectData && !issueData && (
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dev')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'dev'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900 rounded-t-lg shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Development (Branch & Commit)</span>
            {devData && (devData.counts.commits > 0 || devData.counts.pullRequests > 0) && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200">
                {devData.counts.commits + devData.counts.pullRequests}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Repo Info Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Repository:</span>
              <a
                href={`https://github.com/${repoName}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {repoName}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              {devData?.hasToken ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  GitHub API Terkoneksi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <Lock className="w-3 h-3" />
                  Mode Token Terbatas
                </span>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: GITHUB PROJECT & ISSUE                                    */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'project' && (
            <div className="space-y-6">
              
              {/* 1. SECTION: GITHUB PROJECT */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>GitHub Project (Board / Table)</span>
                  </h4>
                  {projectData && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                      Terkoneksi
                    </span>
                  )}
                </div>

                {projectData ? (
                  <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {projectData.title || 'GitHub Project'}
                        </h5>
                      </div>
                      <a
                        href={projectData.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 truncate block mt-0.5 hover:underline"
                      >
                        {projectData.url}
                      </a>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={projectData.url}
                        target="_blank"
                        rel="noreferrer"
                        className="notion-btn notion-btn-primary text-xs flex items-center gap-1.5"
                      >
                        <span>Buka Project</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleUnlink('project')}
                        className="p-2 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        title="Lepas tautan Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Hubungkan task ini ke <strong>GitHub Projects</strong> (Board / Roadmap) agar tim IT dapat memantau pergerakan kartu di GitHub.
                    </p>

                    <form onSubmit={handleLinkProjectSubmit} className="space-y-2.5">
                      {availableProjects.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                            Pilih Project GitHub yang Tersedia:
                          </label>
                          <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="notion-input text-xs w-full"
                          >
                            <option value="">-- Pilih Project GitHub --</option>
                            {availableProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title} (#{p.number} - {p.owner})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                          {availableProjects.length > 0 ? 'Atau masukkan URL Project GitHub manual:' : 'Masukkan URL Project GitHub:'}
                        </label>
                        <input
                          type="url"
                          value={customProjectUrl}
                          onChange={(e) => setCustomProjectUrl(e.target.value)}
                          placeholder="https://github.com/users/username/projects/1 atau orgs"
                          className="notion-input text-xs w-full"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLinkingProject || (!selectedProjectId && !customProjectUrl.trim())}
                        className="notion-btn notion-btn-primary text-xs w-full justify-center"
                      >
                        {isLinkingProject ? 'Menghubungkan...' : 'Hubungkan ke GitHub Project'}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* 2. SECTION: GITHUB ISSUE */}
              <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <CircleDot className="w-4 h-4 text-emerald-600" />
                    <span>GitHub Issue</span>
                  </h4>
                  {issueData && (
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      issueData.state === 'closed'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {issueData.state === 'closed' ? 'Closed (Selesai)' : 'Open (Aktif)'}
                    </span>
                  )}
                </div>

                {issueData ? (
                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-zinc-500">
                            #{issueData.number}
                          </span>
                          <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {issueData.title}
                          </h5>
                        </div>

                        {issueData.labels && issueData.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {issueData.labels.map((lbl: string) => (
                              <span key={lbl} className="text-[10px] px-2 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                {lbl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={issueData.url}
                          target="_blank"
                          rel="noreferrer"
                          className="notion-btn notion-btn-secondary text-xs flex items-center gap-1"
                        >
                          <span>Buka</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleUnlink('issue')}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          title="Lepas tautan issue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Issue Actions */}
                    <div className="pt-2 border-t border-zinc-100 dark:divide-zinc-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {issueData.state === 'open' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateIssueState('closed', true)}
                            disabled={isUpdatingIssueStatus}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-900/60 transition cursor-pointer"
                          >
                            {isUpdatingIssueStatus ? 'Memproses...' : '✓ Selesaikan Issue (Close)'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateIssueState('open', false)}
                            disabled={isUpdatingIssueStatus}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                          >
                            {isUpdatingIssueStatus ? 'Memproses...' : '↺ Buka Kembali Issue (Reopen)'}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUpdateIssueState('closed', true)}
                        disabled={isUpdatingIssueStatus || task.status === 'Done'}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Tandai Task Selesai (Sync)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Big Action: 1-Click Create Issue */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/80 to-purple-50/60 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-800/50 space-y-3">
                      <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>Buat Issue Otomatis di GitHub</span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Otomatis membuat Issue di repository <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{repoName}</code> lengkap dengan detail deskripsi, PIC, due date, dan langsung menautkannya ke task ini.
                        {projectData ? ' Issue juga akan otomatis dimasukkan ke dalam Project Board yang terhubung.' : ''}
                      </p>

                      <button
                        type="button"
                        onClick={handleCreateIssue}
                        disabled={isCreatingIssue}
                        className="notion-btn notion-btn-primary text-xs w-full justify-center py-2.5 shadow-sm"
                      >
                        {isCreatingIssue ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>{isCreatingIssue ? 'Membuat Issue di GitHub...' : '⚡ Buat Issue di GitHub Sekarang'}</span>
                      </button>
                    </div>

                    {/* Manual Link Existing Issue */}
                    <form onSubmit={handleLinkIssueManual} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        Atau tautkan Issue yang sudah ada:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualIssueInput}
                          onChange={(e) => setManualIssueInput(e.target.value)}
                          placeholder="Nomor issue (misal: #5) atau URL issue"
                          className="notion-input text-xs flex-1"
                        />
                        <button
                          type="submit"
                          disabled={isLinkingIssue || !manualIssueInput.trim()}
                          className="notion-btn notion-btn-secondary text-xs px-3 shrink-0"
                        >
                          {isLinkingIssue ? 'Tautkan...' : 'Tautkan'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: DEVELOPMENT (BRANCH & COMMIT)                             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'dev' && (
            <div className="space-y-5">
              {/* Quick Branch & Commit Helpers (Jira Convention) */}
              <div className="space-y-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Format Standar Git (Jira Convention)</span>
                </h4>

                {/* 1. Branch Name */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Nama Branch Rekomendasi:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(devData?.recommendedBranchName || `feature/${taskKey}`, 'branch')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'branch' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'branch' ? 'Tersalin' : 'Salin Nama Branch'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200 select-all overflow-x-auto">
                    {devData?.recommendedBranchName || `feature/${taskKey}-task`}
                  </div>
                </div>

                {/* 2. Git Checkout Command */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Perintah Git Terminal:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(devData?.recommendedGitCommand || `git checkout -b feature/${taskKey}`, 'cmd')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cmd' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'cmd' ? 'Tersalin' : 'Salin Command'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-xs select-all overflow-x-auto">
                    {devData?.recommendedGitCommand || `git checkout -b feature/${taskKey}`}
                  </div>
                </div>

                {/* 3. Commit Message */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Format Pesan Commit:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(devData?.recommendedCommitMsg || `feat(${taskKey}): update #${taskKey}`, 'commitMsg')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'commitMsg' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'commitMsg' ? 'Tersalin' : 'Salin Format'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200 select-all overflow-x-auto">
                    {devData?.recommendedCommitMsg || `feat(${taskKey}): implement task #${taskKey}`}
                  </div>
                </div>
              </div>

              {/* Connected Pull Requests */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <GitPullRequest className="w-3.5 h-3.5 text-purple-600" />
                  <span>Pull Requests Terhubung ({devData?.pullRequests?.length || 0})</span>
                </h4>

                {devData?.pullRequests && devData.pullRequests.length > 0 ? (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                    {devData.pullRequests.map((pr) => {
                      const stateColors = {
                        open: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
                        merged: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
                        closed: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
                      };
                      return (
                        <div key={pr.number} className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${stateColors[pr.state]}`}>
                                {pr.state}
                              </span>
                              <span className="text-xs font-mono font-bold text-zinc-500">#{pr.number}</span>
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {pr.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1">
                              <span>Oleh: {pr.author}</span>
                              {pr.branch && <span>Branch: {pr.branch}</span>}
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

              {/* Connected Commits */}
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

              {/* Manual Linker (PR / Branch) */}
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
          )}

        </div>
      </div>
    </div>
  );
};
