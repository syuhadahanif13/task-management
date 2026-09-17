import React from 'react';
import { Task, TaskStatus } from '../types';
import { CheckCircle2, Circle, Trash2, Edit2, User, Calendar, Send, FileText, ChevronDown } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onOpenSubmit?: (task: Task) => void;
  onOpenReview?: (task: Task) => void;
  showMeetingOrigin?: boolean;
  meetingTitle?: string;
  meetingDate?: string;
  onSelectMeeting?: (meetingId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  onOpenSubmit,
  onOpenReview,
  showMeetingOrigin = false,
  meetingTitle,
  meetingDate,
  onSelectMeeting,
}) => {
  const isDone = task.status === 'Done';
  const isInProgress = task.status === 'In Progress';
  const isPendingApproval = task.status === 'Pending Approval';

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isDone && !isPendingApproval && task.dueDate && task.dueDate < today;

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
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
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
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
              title="Review Submission"
            >
              <FileText className="w-3.5 h-3.5" />
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
            if (isDone || isPendingApproval) {
              onStatusChange(task.id, 'In Progress');
            } else if (onOpenSubmit) {
              // Regular user: submitting work opens approval modal
              onOpenSubmit(task);
            } else {
              onStatusChange(task.id, 'Done');
            }
          }}
          className="mt-0.5 text-gray-400 hover:text-emerald-500 transition-colors shrink-0"
          title={isDone || isPendingApproval ? "Tandai belum selesai" : (onOpenSubmit ? "Kirim untuk persetujuan" : "Tandai selesai")}
        >
          {(isDone || isPendingApproval) ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
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
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* ─── 3. FOOTER ROW: Assignee, Due Date, and Status Selector ─── */}
      <div className="pt-2.5 border-t border-gray-100 dark:border-zinc-700/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-wrap min-w-0 text-xs text-gray-500 dark:text-zinc-400">
          <div className="flex items-center gap-1 shrink-0">
            <User className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
            <span className="truncate max-w-[90px] font-medium">{task.assignee}</span>
          </div>

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