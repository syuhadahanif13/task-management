import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { TaskItem } from './TaskItem';
import { CheckSquare, Filter, LayoutGrid, List, Search, User, AlertTriangle } from 'lucide-react';

interface AllTasksKanbanProps {
  tasks: Array<Task & { meetingTitle: string; meetingDate: string }>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onSelectMeeting: (meetingId: string) => void;
  onOpenSubmit?: (task: Task) => void;
  onOpenReview?: (task: Task) => void;
  currentUserRole?: 'admin' | 'user';
}

export const AllTasksKanban: React.FC<AllTasksKanbanProps> = ({
  tasks,
  onUpdateStatus,
  onEditTask,
  onDeleteTask,
  onSelectMeeting,
  onOpenSubmit,
  onOpenReview,
  currentUserRole = 'admin',
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const assignees = Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean)));

  const today = new Date().toISOString().split('T')[0];

  const filtered = tasks.filter((t) => {
    if (filterAssignee !== 'all' && t.assignee !== filterAssignee) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchAssignee = t.assignee.toLowerCase().includes(q);
      const matchMeeting = t.meetingTitle?.toLowerCase().includes(q);
      if (!matchTitle && !matchAssignee && !matchMeeting) return false;
    }
    return true;
  });

  const columns: Array<{ id: TaskStatus; label: string; color: string }> = [
    { id: 'To Do', label: 'To Do', color: 'bg-notion-sidebar text-notion-text-secondary' },
    { id: 'In Progress', label: 'In Progress', color: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
    { id: 'Pending Approval', label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
    { id: 'Blocked', label: 'Blocked', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
    { id: 'Done', label: 'Done', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  ];

  const overdueCount = tasks.filter((t) => t.status !== 'Done' && t.dueDate < today).length;
  const completedCount = tasks.filter((t) => t.status === 'Done').length;
  const totalCount = tasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Cross-Meeting Stats */}
      <div className="notion-card p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="notion-page-title text-2xl">All Tasks</h2>
            <p className="text-sm text-notion-text-secondary mt-1">
              Cross-meeting view of all action items.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="notion-badge bg-notion-sidebar text-notion-text-secondary">
              {totalCount} total
            </div>
            <div className="notion-badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {completionRate}% complete
            </div>
            {overdueCount > 0 && (
              <div className="notion-badge bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {overdueCount} overdue
              </div>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 pt-4 border-t border-notion-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-notion-text-secondary absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="notion-input pl-8"
              />
            </div>

            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-notion-text-secondary ml-1" />
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="notion-input"
              >
                <option value="all">All assignees</option>
                {assignees.map((a, idx) => (
                  <option key={idx} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-notion-sidebar p-0.5 rounded-lg border border-notion-border">
            <button
              onClick={() => setViewMode('kanban')}
              className={`notion-btn text-xs ${
                viewMode === 'kanban'
                  ? 'bg-notion-bg text-notion-text shadow-xs'
                  : 'text-notion-text-secondary hover:text-notion-text'
              }`}
              title="Kanban board"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`notion-btn text-xs ${
                viewMode === 'list'
                  ? 'bg-notion-bg text-notion-text shadow-xs'
                  : 'text-notion-text-secondary hover:text-notion-text'
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' ? (
        <div className="notion-kanban-board p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {columns.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.id);
              return (
                <div key={col.id} className="notion-kanban-column flex flex-col min-h-[400px]">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-notion-border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-notion-text">{col.label}</span>
                    </div>
                    <span className="notion-badge bg-notion-sidebar text-notion-text-secondary">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Column Task Cards */}
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {colTasks.length === 0 ? (
                      <div className="p-6 text-center text-xs text-notion-text-secondary border border-dashed border-notion-border rounded-lg">
                        No tasks
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onStatusChange={onUpdateStatus}
                          onEdit={onEditTask}
                          onDelete={onDeleteTask}
                          onOpenSubmit={currentUserRole === 'user' ? onOpenSubmit : undefined}
                          onOpenReview={currentUserRole === 'admin' ? onOpenReview : undefined}
                          showMeetingOrigin={true}
                          meetingTitle={task.meetingTitle}
                          meetingDate={task.meetingDate}
                          onSelectMeeting={onSelectMeeting}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="notion-card p-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <CheckSquare className="w-8 h-8 text-notion-text-secondary mx-auto mb-2 opacity-50" />
              <p className="text-xs text-notion-text-secondary">No tasks match the current filters.</p>
            </div>
          ) : (
            filtered.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onStatusChange={onUpdateStatus}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onOpenSubmit={currentUserRole === 'user' ? onOpenSubmit : undefined}
                onOpenReview={currentUserRole === 'admin' ? onOpenReview : undefined}
                showMeetingOrigin={true}
                meetingTitle={task.meetingTitle}
                meetingDate={task.meetingDate}
                onSelectMeeting={onSelectMeeting}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};