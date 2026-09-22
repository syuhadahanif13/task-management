import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority } from '../types';
import { TaskItem } from './TaskItem';
import {
  CheckSquare,
  LayoutGrid,
  List,
  Search,
  User,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface AllTasksKanbanProps {
  tasks: Array<Task & { meetingTitle: string; meetingDate: string }>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onSelectMeeting: (meetingId: string) => void;
  onOpenSubmit?: (task: Task) => void;
  onOpenReview?: (task: Task) => void;
  onOpenAddTask?: () => void;
  onOpenMeetings?: () => void;
  currentUserRole?: 'admin' | 'user';
  currentUser?: { username: string; role?: string; divisionId?: string } | null;
}

export const AllTasksKanban: React.FC<AllTasksKanbanProps> = ({
  tasks,
  onUpdateStatus,
  onEditTask,
  onDeleteTask,
  onSelectMeeting,
  onOpenSubmit,
  onOpenReview,
  onOpenAddTask,
  onOpenMeetings,
  currentUserRole = 'admin',
  currentUser,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  const assignees = Array.from(
    new Set(
      tasks.flatMap((t) =>
        t.assignees && t.assignees.length > 0
          ? t.assignees
          : (t.assignee ? t.assignee.split(',').map((s) => s.trim()).filter(Boolean) : [])
      )
    )
  ).sort();
  const today = new Date().toISOString().split('T')[0];

  const filtered = tasks.filter((t) => {
    if (filterAssignee !== 'all') {
      const taskAssignees = t.assignees && t.assignees.length > 0
        ? t.assignees
        : (t.assignee ? t.assignee.split(',').map((s) => s.trim()).filter(Boolean) : []);
      if (!taskAssignees.includes(filterAssignee)) return false;
    }
    if (selectedStatusFilter !== 'all' && t.status !== selectedStatusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchAssignee = t.assignee.toLowerCase().includes(q);
      const matchMeeting = t.meetingTitle?.toLowerCase().includes(q);
      if (!matchTitle && !matchAssignee && !matchMeeting) return false;
    }
    return true;
  });

  const columns: Array<{ id: TaskStatus; label: string; dotColor: string; pillColor: string }> = [
    { id: 'To Do', label: 'To Do', dotColor: 'bg-zinc-400', pillColor: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
    { id: 'In Progress', label: 'In Progress', dotColor: 'bg-sky-500', pillColor: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' },
    { id: 'Pending Approval', label: 'In Review', dotColor: 'bg-amber-500', pillColor: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
    { id: 'Done', label: 'Done', dotColor: 'bg-emerald-500', pillColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
  ];

  const overdueCount = tasks.filter((t) => t.status !== 'Done' && t.dueDate < today).length;
  const completedCount = tasks.filter((t) => t.status === 'Done').length;
  const totalCount = tasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getPriorityInfo = (task: Task) => {
    const priority = task.priority || 'Medium';
    if (priority === 'High') {
      return {
        label: 'High Priority',
        dot: 'bg-rose-500',
        badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/40',
      };
    }
    if (priority === 'Low') {
      return {
        label: 'Low Priority',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/40',
      };
    }
    return {
      label: 'Medium Priority',
      dot: 'bg-amber-500',
      badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/40',
    };
  };

  const fmtDate = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ─── 1. TOP HEADER & METRICS ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">

        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#c5e848] text-gray-950 shadow-sm">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Task Board</span>
          </span>
          <span className="text-xs font-bold text-gray-400 dark:text-zinc-500">
            {totalCount} Total Tugas
          </span>
          {currentUserRole === 'user' && currentUser?.username && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-500/15 dark:bg-lime-500/20 text-lime-800 dark:text-lime-300 text-xs font-bold border border-lime-500/30">
              <User className="w-3.5 h-3.5" />
              <span>Tugas {currentUser.username}</span>
            </span>
          )}
        </div>



        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Switcher: Rapat vs Tugas */}
          {onOpenMeetings && (
            <div className="flex items-center bg-white dark:bg-zinc-800 p-1 rounded-full border border-gray-200/70 dark:border-zinc-700/60 shadow-sm text-xs font-bold">
              <button
                onClick={onOpenMeetings}
                className="px-3.5 py-1.5 rounded-full text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition"
              >
                📅 Rapat
              </button>
              <span className="px-3.5 py-1.5 rounded-full bg-[#18191d] text-white shadow-xs">
                ✓ Tugas
              </span>
            </div>
          )}

          {/* Stats Pills */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 p-1 rounded-2xl border border-gray-200/70 dark:border-zinc-700/60 shadow-sm text-xs font-bold">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {completionRate}% Selesai
            </span>
            {overdueCount > 0 && (
              <span className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {overdueCount} Terlambat
              </span>
            )}
          </div>

          {onOpenAddTask && (
            <button
              onClick={onOpenAddTask}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#18191d] hover:bg-black text-white text-xs font-extrabold shadow-lg transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tugas</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. SEARCH & FILTER CONTROLS (Pill-Style) ─── */}
      <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md rounded-[28px] p-4 border border-gray-200/70 dark:border-zinc-700/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Cari tugas, PIC, atau rapat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-750/70 rounded-full pl-11 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white border border-transparent"
          />
        </div>

        {/* Assignee Filter & View Mode */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {currentUserRole === 'user' ? (
            <div className="flex items-center gap-2 bg-lime-50 dark:bg-lime-950/30 px-3.5 py-2 rounded-full border border-lime-200 dark:border-lime-800/50">
              <User className="w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
              <span className="text-xs font-bold text-lime-800 dark:text-lime-300">
                PIC: {currentUser?.username || 'Saya'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-750/70 px-3.5 py-2 rounded-full border border-gray-200/50 dark:border-zinc-700">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-800 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="all">Semua PIC</option>
                {assignees.map((a, idx) => (
                  <option key={idx} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-700/70 p-1 rounded-full">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-full transition-all ${viewMode === 'kanban'
                ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-700'
                }`}
              title="Kanban Board"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-full transition-all ${viewMode === 'list'
                ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-700'
                }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 3. KANBAN BOARD VIEW (Dribbble Columns) ─── */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-[#f7f8fa] dark:bg-zinc-800/50 rounded-[30px] p-4 border border-gray-200/60 dark:border-zinc-700/50 flex flex-col min-h-[480px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200/50 dark:border-zinc-700/50">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      {col.label}
                    </span>
                  </div>
                  <span className="w-6 h-6 rounded-full bg-white dark:bg-zinc-700 shadow-xs flex items-center justify-center text-[11px] font-bold text-gray-700 dark:text-zinc-200">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Tasks */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="py-10 text-center rounded-2xl border border-dashed border-gray-300/80 dark:border-zinc-700/60">
                      <p className="text-xs font-medium text-gray-400 dark:text-zinc-500">
                        Tidak ada tugas
                      </p>
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
        /* ─── LIST VIEW ─── */
        <div className="bg-white dark:bg-zinc-800/90 rounded-[32px] p-6 border border-gray-100 dark:border-zinc-700/60 shadow-sm space-y-3">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700 dark:text-zinc-300">
                Tidak ada tugas yang sesuai
              </p>
              <p className="text-xs text-gray-400 mt-1">Coba ubah kata kunci pencarian atau filter.</p>
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
