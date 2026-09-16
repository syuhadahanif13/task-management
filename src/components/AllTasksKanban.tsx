import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { TaskItem } from './TaskItem';
import { CheckSquare, Filter, Layers, LayoutGrid, List, Search, User, Calendar, AlertTriangle } from 'lucide-react';

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

  // Extract unique assignees
  const assignees = Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean)));

  const today = new Date().toISOString().split('T')[0];

  // Filtering
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

  const columns: Array<{ id: TaskStatus; label: string; sub: string; border: string; bg: string }> = [
    { id: 'To Do', label: 'To Do', sub: 'Belum Mulai', border: 'border-zinc-300 dark:border-zinc-700', bg: 'bg-zinc-50 dark:bg-zinc-900/60' },
    { id: 'In Progress', label: 'In Progress', sub: 'Sedang Dikerjakan', border: 'border-sky-300 dark:border-sky-800/80', bg: 'bg-sky-50/50 dark:bg-sky-950/20' },
    { id: 'Pending Approval', label: 'Pending Approval', sub: 'Menunggu Approve', border: 'border-amber-300 dark:border-amber-800/80', bg: 'bg-amber-50/50 dark:bg-amber-950/20' },
    { id: 'Blocked', label: 'Blocked', sub: 'Kendala / Tertunda', border: 'border-rose-300 dark:border-rose-800/80', bg: 'bg-rose-50/50 dark:bg-rose-950/20' },
    { id: 'Done', label: 'Done', sub: 'Selesai', border: 'border-emerald-300 dark:border-emerald-800/80', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20' },
  ];

  // Overdue count
  const overdueCount = tasks.filter((t) => t.status !== 'Done' && t.dueDate < today).length;
  const completedCount = tasks.filter((t) => t.status === 'Done').length;
  const totalCount = tasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Cross-Meeting Stats */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                Cross-Meeting Aggregation
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">•</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Relasi 1 Rapat ke Banyak Tugas</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              Semua Action Items & Tindak Lanjut
            </h2>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px] block">Total Tugas</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{totalCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
              <span className="text-emerald-700 dark:text-emerald-300 text-[11px] block">Tingkat Selesai</span>
              <span className="font-bold text-emerald-800 dark:text-emerald-200 text-sm">{completionRate}%</span>
            </div>
            {overdueCount > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
                <span className="text-rose-700 dark:text-rose-300 text-[11px] block flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Terlambat
                </span>
                <span className="font-bold text-rose-800 dark:text-rose-200 text-sm">{overdueCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari tugas atau rapat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            {/* Filter by Assignee */}
            <div className="flex items-center gap-1 text-xs">
              <User className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 ml-1" />
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <option value="all">Semua Penanggung Jawab ({assignees.length})</option>
                {assignees.map((a, idx) => (
                  <option key={idx} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Tampilan Papan Kanban"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Papan Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Tampilan Daftar Tabel"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Daftar List</span>
            </button>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-zinc-100/70 dark:bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col min-h-[500px] transition-colors"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{col.label}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                      ({col.sub})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Task Cards */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] pr-0.5">
                  {colTasks.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg bg-white/40 dark:bg-zinc-800/30">
                      Tidak ada tugas
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
      ) : (
        /* LIST VIEW */
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 transition-colors">
              <CheckSquare className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Tidak ada tugas yang cocok dengan filter.</p>
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
