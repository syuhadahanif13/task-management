import React from 'react';
import { Task, TaskStatus, TaskSubmission } from '../types';
import { CheckCircle2, Clock, AlertCircle, Trash2, Edit2, User, Calendar, Send, FileText } from 'lucide-react';

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
  const isBlocked = task.status === 'Blocked';
  const isInProgress = task.status === 'In Progress';
  const isPendingApproval = task.status === 'Pending Approval';

  // Check overdue
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isDone && !isPendingApproval && task.dueDate < today;

  const statusColors: Record<TaskStatus, { badge: string; text: string; bg: string }> = {
    'To Do': {
      badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
      text: 'Belum Mulai',
      bg: 'hover:border-zinc-300'
    },
    'In Progress': {
      badge: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      text: 'Sedang Berjalan',
      bg: 'border-l-sky-500'
    },
    'Done': {
      badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      text: 'Selesai',
      bg: 'opacity-75'
    },
    'Blocked': {
      badge: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      text: 'Tertunda / Kendala',
      bg: 'border-l-rose-500'
    },
    'Pending Approval': {
      badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      text: 'Menunggu Approve',
      bg: 'border-l-amber-500'
    }
  };

  return (
    <div
      id={`task-item-${task.id}`}
      className={`group p-3.5 rounded-lg border shadow-xs transition-all hover:shadow-sm ${
        isDone
          ? 'bg-zinc-50/70 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800/80'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Checkbox / Quick Toggle */}
        <button
          id={`toggle-status-${task.id}`}
          onClick={() => onStatusChange(task.id, isDone || isPendingApproval ? 'In Progress' : 'Done')}
          className="mt-0.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors focus:outline-none shrink-0"
          title={isDone || isPendingApproval ? "Tandai belum selesai" : "Tandai selesai"}
        >
          {(isDone || isPendingApproval) ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-emerald-50 dark:fill-emerald-950/40" />
          ) : (
            <div className="w-5 h-5 rounded-md border-2 border-zinc-300 dark:border-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-400 flex items-center justify-center transition-colors" />
          )}
        </button>

        {/* Task Core Data */}
        <div className="flex-1 min-w-0">
          {/* Originating Meeting link if requested */}
          {showMeetingOrigin && (meetingTitle || meetingDate) && (
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-400 dark:text-zinc-500">Dari Rapat:</span>
              <button
                onClick={() => onSelectMeeting?.(task.meetingId)}
                className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium hover:underline truncate max-w-[200px]"
                title={meetingTitle}
              >
                {meetingTitle || 'Rapat'}
              </button>
              {meetingDate && <span className="text-zinc-400 dark:text-zinc-500">({meetingDate})</span>}
            </div>
          )}

          {/* Action Item Title (Judul Tindakan) */}
          <h4
            className={`text-sm font-medium leading-snug break-words ${
              isDone || isPendingApproval ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'
            }`}
          >
            {task.title}
          </h4>

          {/* Core Metadata Fields: Assignee (Peserta PIC) & Due Date (Tenggat) */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            {/* Field: Assignee / Penanggung Jawab */}
            <div className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
              <User className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <span className="truncate max-w-[150px]">{task.assignee}</span>
            </div>

            {/* Field: Due Date / Tenggat Waktu */}
            <div
              className={`inline-flex items-center gap-1 font-mono ${
                isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400'
              }`}
              title={isOverdue ? 'Melewati batas tenggat waktu!' : undefined}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{task.dueDate}</span>
              {isOverdue && (
                <span className="px-1 py-0.2 rounded text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-sans">
                  Terlambat
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Dropdown & Action Controls */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <select
            id={`task-status-select-${task.id}`}
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            className={`text-[11px] font-medium px-2 py-1 rounded-md border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 dark:bg-zinc-800 ${
              statusColors[task.status].badge
            }`}
          >
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
            <option value="Blocked">Blocked</option>
          </select>

          {/* Quick Actions (Edit / Delete / Submit / Review) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pt-0.5">
            {onOpenSubmit && isInProgress && (
              <button
                onClick={() => onOpenSubmit(task)}
                className="p-1 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                title="Submit for Approval"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenReview && isPendingApproval && (
              <button
                onClick={() => onOpenReview(task)}
                className="p-1 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                title="Review Submission"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Edit Tugas"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Hapus Tugas"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
