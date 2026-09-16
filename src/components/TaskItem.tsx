import React from 'react';
import { Task, TaskStatus, TaskSubmission } from '../types';
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
  const isBlocked = task.status === 'Blocked';
  const isInProgress = task.status === 'In Progress';
  const isPendingApproval = task.status === 'Pending Approval';

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isDone && !isPendingApproval && task.dueDate < today;

  const statusColors: Record<TaskStatus, { bg: string; text: string }> = {
    'To Do': { bg: 'bg-notion-sidebar', text: 'text-notion-text-secondary' },
    'In Progress': { bg: 'bg-blue-50', text: 'text-blue-700' },
    'Done': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    'Blocked': { bg: 'bg-rose-50', text: 'text-rose-700' },
    'Pending Approval': { bg: 'bg-amber-50', text: 'text-amber-700' }
  };

  return (
    <div className="notion-card notion-card-hover p-4">
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onStatusChange(task.id, isDone || isPendingApproval ? 'In Progress' : 'Done')}
          className="mt-0.5 text-notion-text-secondary hover:text-notion-accent transition-colors"
          title={isDone || isPendingApproval ? "Tandai belum selesai" : "Tandai selesai"}
        >
          {(isDone || isPendingApproval) ? (
            <CheckCircle2 className="h-5 w-5 text-notion-success" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {showMeetingOrigin && (meetingTitle || meetingDate) && (
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-notion-text-secondary">
              <span>Dari Rapat:</span>
              <button
                onClick={() => onSelectMeeting?.(task.meetingId)}
                className="font-medium hover:underline truncate max-w-[200px] text-notion-accent"
                title={meetingTitle}
              >
                {meetingTitle || 'Rapat'}
              </button>
              {meetingDate && <span>({meetingDate})</span>}
            </div>
          )}

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
            <option value="Done">Done</option>
            <option value="Blocked">Blocked</option>
            <option value="Pending Approval">Pending Approval</option>
          </select>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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