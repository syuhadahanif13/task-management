import React from 'react';
import { Task, TaskStatus } from '../types';
import { extractTaskDescription } from '../utils/submissionUtils';
import { CheckCircle2, Circle, Trash2, Edit2, User, Calendar, Send, FileText, ChevronDown, Paperclip, Clock } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onOpenSubmit?: (task: Task) => void;
  onOpenReview?: (task: Task) => void;
  onViewProof?: (task: Task) => void;
  showMeetingOrigin?: boolean;
  meetingTitle?: string;
  meetingDate?: string;
  onSelectMeeting?: (meetingId: string) => void;
  onOpenGitHubDev?: (task: Task) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  onOpenSubmit,
  onOpenReview,
  onViewProof,
  showMeetingOrigin = false,
  meetingTitle,
  meetingDate,
  onSelectMeeting,
  onOpenGitHubDev,
}) => {
  const isDone = task.status === 'Done';
  const isInProgress = task.status === 'In Progress';
  const isPendingApproval = task.status === 'Pending Approval';

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isDone && !isPendingApproval && task.dueDate && task.dueDate < today;

  const isConnectedToGitHub = Boolean(
    task.githubRepo ||
    task.githubIssueUrl ||
    task.githubProjectUrl ||
    task.githubBranch ||
    task.githubPrUrl ||
    task.githubMetadata?.repo ||
    task.githubMetadata?.issue ||
    task.githubMetadata?.project ||
    (task.githubMetadata?.pullRequests && task.githubMetadata.pullRequests.length > 0) ||
    (task.githubMetadata?.commits && task.githubMetadata.commits.length > 0) ||
    (task.githubMetadata?.branches && task.githubMetadata.branches.length > 0)
  );

  const statusColors: Record<TaskStatus, { bg: string; text: string }> = {
    'To Do': {
      bg: 'bg-zinc-100 dark:bg-zinc-700/60',
      text: 'text-zinc-700 dark:text-zinc-300'
    },
    'In Progress': {
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      text: 'text-sky-700 dark:text-sky-300'
    },
    'Done': {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300'
    },
    'Pending Approval': {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300'
    }
  };

  const getPriorityBadge = () => {
    if (!task.priority) return null;
    if (task.priority === 'High') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/40 shrink-0 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          High
        </span>
      );
    }
    if (task.priority === 'Low') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/40 shrink-0 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Low
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/40 shrink-0 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Medium
      </span>
    );
  };

  const fmtDate = (d?: string) => {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800/90 rounded-[22px] p-4 shadow-2xs border border-gray-200/70 dark:border-zinc-700/60 hover:shadow-md transition-all group flex flex-col justify-between gap-3 w-full">
      {/* ─── 1. TOP ROW: Origin Badge, Priority, and Action Buttons ─── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {getPriorityBadge()}

          {isPendingApproval && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 inline-flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Menunggu Review
            </span>
          )}

          {showMeetingOrigin && (
            (!task.meetingId || task.meetingId === 'general-tasks') ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 shrink-0 whitespace-nowrap">
                Tugas Mandiri
              </span>
            ) : (meetingTitle || meetingDate) ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  task.meetingId && onSelectMeeting?.(task.meetingId);
                }}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:underline truncate max-w-[130px] shrink-0"
                title={meetingTitle}
              >
                {meetingTitle || 'Rapat'}
              </button>
            ) : null
          )}

          {task.tags && task.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 shrink-0 whitespace-nowrap">
              {tag}
            </span>
          ))}

          {/* GitHub Issue Badge */}
          {onOpenGitHubDev && task.githubMetadata?.issue && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGitHubDev(task);
              }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 transition shadow-2xs cursor-pointer active:scale-95 ${
                task.githubMetadata.issue.state === 'closed'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50'
              }`}
              title={`GitHub Issue #${task.githubMetadata.issue.number} (${task.githubMetadata.issue.state})`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${task.githubMetadata.issue.state === 'closed' ? 'bg-purple-500' : 'bg-emerald-500'}`}></span>
              <span>#{task.githubMetadata.issue.number}</span>
            </button>
          )}

          {/* GitHub Project Badge */}
          {onOpenGitHubDev && task.githubMetadata?.project && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGitHubDev(task);
              }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 inline-flex items-center gap-1 shrink-0 transition shadow-2xs cursor-pointer active:scale-95"
              title={`GitHub Project: ${task.githubMetadata.project.title}`}
            >
              <span className="truncate max-w-[70px]">{task.githubMetadata.project.title}</span>
            </button>
          )}

          {/* Jira-style GitHub Dev Tracking Badge - Only shown when connected to GitHub */}
          {onOpenGitHubDev && isConnectedToGitHub && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGitHubDev(task);
              }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white dark:bg-white dark:text-black hover:opacity-90 inline-flex items-center gap-1 shrink-0 transition shadow-2xs cursor-pointer active:scale-95"
              title="Buka GitHub Project & Dev Tracking"
            >
              <svg className="w-2.5 h-2.5 fill-current shrink-0" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              {task.githubMetadata?.pullRequests && task.githubMetadata.pullRequests.length > 0 ? (
                <span>{task.githubMetadata.pullRequests.length} PR</span>
              ) : task.githubMetadata?.commits && task.githubMetadata.commits.length > 0 ? (
                <span>{task.githubMetadata.commits.length} Commit</span>
              ) : task.githubBranch ? (
                <span className="truncate max-w-[80px]">{task.githubBranch}</span>
              ) : (
                <span className="truncate max-w-[90px]">{task.githubRepo ? task.githubRepo.split('/')[1] || task.githubRepo : 'GitHub'}</span>
              )}
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {onOpenGitHubDev && isConnectedToGitHub && (
            <button
              type="button"
              onClick={() => onOpenGitHubDev(task)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700/60 transition-colors"
              title="GitHub Dev Tracking (Jira)"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </button>
          )}
          {onViewProof && (isPendingApproval || isDone) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewProof(task);
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
              title="Lihat Bukti Kerja / Lampiran"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          )}
          {onOpenSubmit && isInProgress && (
            <button
              type="button"
              onClick={() => onOpenSubmit(task)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
              title="Submit for Approval"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
          {onOpenReview && isPendingApproval && (
            <button
              type="button"
              onClick={() => onOpenReview(task)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-400 hover:bg-amber-500 shadow-xs transition-all active:scale-95"
              title="Tinjau & Setujui Submission"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Tinjau</span>
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700/60 transition-colors"
              title="Edit Tugas"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Hapus Tugas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. MAIN CONTENT: Checkbox & Full-Width Title ─── */}
      <div className="flex items-start gap-2.5 my-0.5">
        <button
          type="button"
          onClick={() => {
            if (isDone) {
              onStatusChange(task.id, 'In Progress');
            } else if (isPendingApproval) {
              if (onOpenReview) {
                onOpenReview(task);
              } else if (onViewProof) {
                onViewProof(task);
              }
            } else if (onOpenSubmit) {
              // Regular user: submitting work opens approval modal
              onOpenSubmit(task);
            } else {
              onStatusChange(task.id, 'Done');
            }
          }}
          className="mt-0.5 text-gray-400 hover:text-emerald-500 transition-colors shrink-0"
          title={
            isDone
              ? 'Tandai belum selesai'
              : isPendingApproval
              ? (onOpenReview ? 'Tinjau hasil kerja (Pending Approval)' : 'Menunggu review admin')
              : onOpenSubmit
              ? 'Kirim untuk persetujuan'
              : 'Tandai selesai'
          }
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : isPendingApproval ? (
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
          ) : (
            <Circle className="w-5 h-5 stroke-[1.75]" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-bold leading-snug break-words ${isDone ? 'line-through text-gray-400 dark:text-zinc-500' : 'text-gray-900 dark:text-white'}`}>
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 mt-1">
              {extractTaskDescription(task.description)}
            </p>
          )}
        </div>
      </div>

      {/* ─── 3. FOOTER ROW: Assignee, Due Date, and Status Selector ─── */}
      <div className="pt-2.5 border-t border-gray-100 dark:border-zinc-700/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-wrap min-w-0 text-xs text-gray-500 dark:text-zinc-400">
          {(() => {
            const assigneesList = (task.assignees && task.assignees.length > 0)
              ? task.assignees
              : (task.assignee ? task.assignee.split(',').map((s) => s.trim()).filter(Boolean) : []);

            if (assigneesList.length <= 1) {
              return (
                <div className="flex items-center gap-1 shrink-0" title={assigneesList[0] || 'Unassigned'}>
                  <User className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
                  <span className="truncate max-w-[110px] font-medium">{assigneesList[0] || 'Unassigned'}</span>
                </div>
              );
            }

            return (
              <div className="flex items-center gap-1.5 shrink-0" title={`PIC: ${assigneesList.join(', ')}`}>
                <div className="flex items-center -space-x-1.5 overflow-hidden">
                  {assigneesList.slice(0, 3).map((name, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 border border-white dark:border-zinc-800 flex items-center justify-center text-[9px] font-bold text-white shadow-2xs"
                      title={name}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="truncate max-w-[120px] font-medium text-[11px] text-gray-700 dark:text-zinc-300">
                  {assigneesList.slice(0, 2).join(', ')}{assigneesList.length > 2 ? ` +${assigneesList.length - 2}` : ''}
                </span>
              </div>
            );
          })()}

          <div className={`flex items-center gap-1 shrink-0 whitespace-nowrap font-mono text-[11px] ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}`}>
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{fmtDate(task.dueDate)}</span>
            {isOverdue && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 whitespace-nowrap">
                Terlambat
              </span>
            )}
          </div>
        </div>

        {/* Status Dropdown Pill */}
        <div className="relative shrink-0">
          <select
            value={task.status}
            onChange={(e) => {
              const newStatus = e.target.value as TaskStatus;
              if (newStatus === 'Pending Approval' && onOpenSubmit) {
                onOpenSubmit(task);
              } else {
                onStatusChange(task.id, newStatus);
              }
            }}
            className={`text-xs font-semibold pl-2.5 pr-6 py-1 rounded-full border border-gray-200/80 dark:border-zinc-700 cursor-pointer appearance-none transition-colors shadow-2xs ${statusColors[task.status].bg} ${statusColors[task.status].text}`}
          >
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Approval">In Review</option>
            <option value="Done">Done</option>
          </select>
          <ChevronDown className="w-3 h-3 text-gray-400 dark:text-zinc-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>
    </div>
  );
};