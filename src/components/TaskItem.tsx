import React from 'react';
import { Task, TaskStatus } from '../types';
import { CheckCircle2, Circle, Trash2, Edit2, User, Calendar, Send, FileText } from 'lucide-react';

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
  const isOverdue = !isDone && !isPendingApproval && task.dueDate < today;

  const statusColors: Record<TaskStatus, { bg: string; text: string }> = {
    'To Do': { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-700 dark:text-zinc-300' },
    'In Progress': { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300' },
    'Done': { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300' },
    'Pending Approval': { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300' }
  };

  return (
    <div className="bg-white dark:bg-zinc-800/90 rounded-[22px] p-4 shadow-sm border border-gray-200/60 dark:border-zinc-700/60 hover:shadow-md transition-all group">
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onStatusChange(task.id, isDone || isPendingApproval ? 'In Progress' : 'Done')}
          className="mt-0.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors shrink-0"
          title={isDone || isPendingApproval ? "Tandai belum selesai" : "Tandai selesai"}
        >
          {(isDone || isPendingApproval) ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 stroke-[1.5]" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {showMeetingOrigin && (
            (!task.meetingId || task.meetingId === 'general-tasks') ? (
              <div className="mb-1 flex items-center gap-1.5 text-[11px] text-notion-text-secondary">
                <span className="notion-badge bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium">
                  Tugas Mandiri
                </span>
              </div>
            ) : (meetingTitle || meetingDate) ? (
              <div className="mb-1 flex items-center gap-1.5 text-[11px] text-notion-text-secondary">
                <span>Dari Rapat:</span>
                <button
                  onClick={() => task.meetingId && onSelectMeeting?.(task.meetingId)}
                  className="font-medium hover:underline truncate max-w-[200px] text-notion-accent"
                  title={meetingTitle}
                >
                  {meetingTitle || 'Rapat'}
                </button>
                {meetingDate && <span>({meetingDate})</span>}
              </div>
            ) : null
          )}

          <div className="flex items-center gap-2 flex-wrap mb-1">
            {task.priority && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                task.priority === 'High' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' :
                task.priority === 'Low' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' :
                'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
              }`}>
                <span className={`w-1 h-1 rounded-full ${
                  task.priority === 'High' ? 'bg-rose-500' : task.priority === 'Low' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                {task.priority}
              </span>
            )}
            {task.tags && task.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                {tag}
              </span>
            ))}
          </div>

          <h4 className={`text-sm font-medium leading-snug ${isDone || isPendingApproval ? 'line-through text-notion-text-secondary' : 'text-notion-text'}`}>
            {task.title}
          </h4>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-notion-text-secondary">
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span className="truncate max-w-[150px]">{task.assignee}</span>
            </div>

            <div className={`flex items-center gap-1 font-mono ${isOverdue ? 'text-notion-danger font-semibold' : ''}`}>
              <Calendar className="h-3.5 w-3.5" />
              <span>{task.dueDate}</span>
              {isOverdue && (
                <span className="notion-badge bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  Terlambat
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            className={`notion-badge cursor-pointer border-none ${statusColors[task.status].bg} ${statusColors[task.status].text}`}
          >
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Done">Done</option>
          </select>

          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {onOpenSubmit && isInProgress && (
              <button
                onClick={() => onOpenSubmit(task)}
                className="rounded-md p-1 text-notion-text-secondary hover:text-amber-600 hover:bg-amber-50"
                title="Submit for Approval"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
            {onOpenReview && isPendingApproval && (
              <button
                onClick={() => onOpenReview(task)}
                className="rounded-md p-1 text-notion-text-secondary hover:text-amber-600 hover:bg-amber-50"
                title="Review Submission"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="rounded-md p-1 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
                title="Edit Tugas"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(task.id)}
                className="rounded-md p-1 text-notion-text-secondary hover:text-notion-danger hover:bg-rose-50"
                title="Hapus Tugas"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};