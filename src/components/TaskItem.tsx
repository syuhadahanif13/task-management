import React from 'react';
import { Task, TaskStatus } from '../types';
import { CheckCircle2, Clock, AlertCircle, Trash2, Edit2, User, Calendar } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
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
  showMeetingOrigin = false,
  meetingTitle,
  meetingDate,
  onSelectMeeting,
}) => {
  const isDone = task.status === 'Done';
  const isBlocked = task.status === 'Blocked';
  const isInProgress = task.status === 'In Progress';

  // Check overdue
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isDone && task.dueDate < today;

  const statusColors: Record<TaskStatus, { badge: string; text: string; bg: string }> = {
    'To Do': {
      badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
      text: 'Belum Mulai',
      bg: 'hover:border-zinc-300'
    },
    'In Progress': {
      badge: 'bg-sky-50 text-sky-700 border-sky-200',
      text: 'Sedang Berjalan',
      bg: 'border-l-sky-500'
    },
    'Done': {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      text: 'Selesai',
      bg: 'opacity-75'
    },
    'Blocked': {
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      text: 'Tertunda / Kendala',
      bg: 'border-l-rose-500'
    }
  };

  return (
    <div
      id={`task-item-${task.id}`}
      className={`group p-3.5 bg-white rounded-lg border border-zinc-200 shadow-xs transition-all hover:shadow-sm ${
        isDone ? 'bg-zinc-50/70 border-zinc-200/80' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Checkbox / Quick Toggle */}
        <button
          id={`toggle-status-${task.id}`}
          onClick={() => onStatusChange(task.id, isDone ? 'In Progress' : 'Done')}
          className="mt-0.5 text-zinc-400 hover:text-emerald-600 transition-colors focus:outline-none shrink-0"
          title={isDone ? "Tandai belum selesai" : "Tandai selesai"}
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
          ) : (
            <div className="w-5 h-5 rounded-md border-2 border-zinc-300 hover:border-zinc-500 flex items-center justify-center transition-colors" />
          )}
        </button>

        {/* Task Core Data */}
        <div className="flex-1 min-w-0">
          {/* Originating Meeting link if requested */}
          {showMeetingOrigin && (meetingTitle || meetingDate) && (
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="font-medium text-zinc-400">Dari Rapat:</span>
              <button
                onClick={() => onSelectMeeting?.(task.meetingId)}
                className="text-zinc-700 hover:text-zinc-900 font-medium hover:underline truncate max-w-[200px]"
                title={meetingTitle}
              >
                {meetingTitle || 'Rapat'}
              </button>
              {meetingDate && <span className="text-zinc-400">({meetingDate})</span>}
            </div>
          )}

          {/* Action Item Title (Judul Tindakan) */}
          <h4
            className={`text-sm font-medium leading-snug break-words ${
              isDone ? 'line-through text-zinc-400' : 'text-zinc-900'
            }`}
          >
            {task.title}
          </h4>

          {/* Core Metadata Fields: Assignee (Peserta PIC) & Due Date (Tenggat) */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600">
            {/* Field: Assignee / Penanggung Jawab */}
            <div className="inline-flex items-center gap-1 text-zinc-700 font-medium">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span className="truncate max-w-[150px]">{task.assignee}</span>
            </div>

            {/* Field: Due Date / Tenggat Waktu */}
            <div
              className={`inline-flex items-center gap-1 font-mono ${
                isOverdue ? 'text-rose-600 font-semibold' : 'text-zinc-500'
              }`}
              title={isOverdue ? 'Melewati batas tenggat waktu!' : undefined}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{task.dueDate}</span>
              {isOverdue && (
                <span className="px-1 py-0.2 rounded text-[10px] bg-rose-100 text-rose-700 font-sans">
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
            className={`text-[11px] font-medium px-2 py-1 rounded-md border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-900 ${
              statusColors[task.status].badge
            }`}
          >
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
            <option value="Blocked">Blocked</option>
          </select>

          {/* Quick Actions (Edit / Delete) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pt-0.5">
            {onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100"
                title="Edit Tugas"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-1 text-zinc-400 hover:text-rose-600 rounded hover:bg-rose-50"
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
