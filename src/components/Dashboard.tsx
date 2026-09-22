import React, { useState } from 'react';
import { Meeting, Task, TaskStatus } from '../types';
import { Translations } from '../i18n';
import { filterTasksForUser } from '../utils/taskAccess';
import {
  Plus,
  Bell,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  ListTodo,
  Calendar as CalendarIcon,
  ChevronRight,
  BookOpen,
  Users,
  CheckSquare,
  Search,
} from 'lucide-react';

interface DashboardProps {
  meetings: Meeting[];
  t: Translations;
  currentUser?: { username: string; role: string; divisionId?: string } | null;
  onSelectMeeting: (meeting: Meeting) => void;
  onTabChange: (tab: any) => void;
  onOpenAddTask?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  meetings,
  t,
  currentUser,
  onSelectMeeting,
  onTabChange,
  onOpenAddTask,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Extract all tasks with parent meeting title
  const realMeetings = meetings.filter((m) => m.id !== 'general-tasks');
  const rawTasks: Array<Task & { meetingTitle: string }> = [];
  for (const m of meetings) {
    for (const task of m.tasks || []) {
      const isStandalone = m.id === 'general-tasks' || !task.meetingId || task.meetingId === 'general-tasks';
      rawTasks.push({
        ...task,
        meetingTitle: isStandalone ? 'Tugas Mandiri' : (m.title || `Rapat ${m.meetingDate}`),
      });
    }
  }

  // Scope tasks according to user role: Admin gets all tasks, regular user gets only their assigned tasks
  const allTasks = filterTasksForUser(rawTasks, currentUser);

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === 'Done').length;
  const inProgressTasks = allTasks.filter((t) => t.status === 'In Progress').length;
  const pendingTasks = allTasks.filter((t) => t.status === 'Pending Approval' || t.status === 'To Do').length;
  const todoTasks = allTasks.filter((t) => t.status === 'To Do').length;
  const reviewTasks = allTasks.filter((t) => t.status === 'Pending Approval').length;
  const overdueTasks = allTasks.filter(
    (t) => t.status !== 'Done' && t.dueDate && t.dueDate < today
  ).length;

  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Filter tasks for Today's Tasks section
  const filteredTasks = allTasks.filter((task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        task.title.toLowerCase().includes(q) ||
        (task.assignee && task.assignee.toLowerCase().includes(q)) ||
        (task.meetingTitle && task.meetingTitle.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (selectedStatusFilter === 'all') return true;
    if (selectedStatusFilter === 'todo') return task.status === 'To Do';
    if (selectedStatusFilter === 'in-progress') return task.status === 'In Progress';
    if (selectedStatusFilter === 'review') return task.status === 'Pending Approval';
    if (selectedStatusFilter === 'done') return task.status === 'Done';
    return true;
  });

  // SVG Progress Ring calculations (radius 38 -> circumference ≈ 238.76)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionRate / 100) * circumference;

  const greetingName = currentUser?.username || 'Olivia Reed';

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

  const statusFilterOptions = [
    { id: 'all', label: 'All', count: totalTasks },
    { id: 'todo', label: 'To Do', count: todoTasks },
    { id: 'in-progress', label: 'In Progress', count: inProgressTasks },
    { id: 'review', label: 'In Review', count: reviewTasks },
    { id: 'done', label: 'Done', count: doneTasks },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* ─── 1. TOP GREETING BAR (Desktop Only) ─── */}
      <div className="hidden lg:flex items-center justify-between pt-1">
        <div className="flex items-center gap-3.5">
          {/* User Avatar */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white/80 dark:ring-zinc-700 shadow-md bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
              {greetingName.charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full" />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
              Good Morning
            </p>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              {greetingName}
            </h2>
          </div>
        </div>

        {/* Action Buttons: Dark + & Bell */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenAddTask?.()}
            className="w-11 h-11 rounded-full bg-[#18191d] hover:bg-black text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
            title="Add New Task"
          >
            <Plus className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 border border-gray-200/80 dark:border-zinc-700 flex items-center justify-center shadow-sm transition-all active:scale-95"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {overdueTasks > 0 && (
                <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
              )}
            </button>

            {notificationOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 p-4 z-30">
                <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mb-2">
                  Notifikasi
                </p>
                {overdueTasks > 0 ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
                    ⚠️ Ada {overdueTasks} tugas yang melewati tenggat waktu!
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Tidak ada pemberitahuan mendesak. Hari yang bagus!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MOBILE SEARCH BAR (Matches Screen 1 in design) ─── */}
      <div className="lg:hidden pt-1">
        <div className="relative">
          <input
            type="text"
            placeholder="Search tasks, meetings, or assignees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#18191e] border border-gray-200/80 dark:border-zinc-800 rounded-2xl py-3 pl-11 pr-8 text-xs sm:text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[#a3e635] transition-all"
          />
          <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. HERO HEADING ─── */}
      <div className="pt-1">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-950 dark:text-white leading-[1.12]">
          Let's Make<br />Today Productive
        </h1>
      </div>

      {/* ─── 3. "TODAY'S PROGRESS" DARK CARD ─── */}
      <div className="bg-[#18191e] dark:bg-[#111215] text-white rounded-[32px] p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Subtle ambient lighting effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <p className="text-xs sm:text-sm font-semibold text-zinc-400 tracking-wide uppercase mb-4">
            Today's Progress
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* Left: Donut Progress Chart */}
            <div className="flex items-center justify-center sm:justify-start gap-5">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Track ring */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    className="stroke-[#27282f]"
                    strokeWidth="8.5"
                    fill="transparent"
                  />
                  {/* Neon Lime Progress ring */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    className="stroke-[#a3e635] transition-all duration-1000 ease-out"
                    strokeWidth="8.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Centered % */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {completionRate}%
                  </span>
                </div>
              </div>

              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-white">
                  {doneTasks} of {totalTasks}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">Tugas terselesaikan</p>
              </div>
            </div>

            {/* Right: Vertical Stats List with divider */}
            <div className="sm:border-l sm:border-zinc-800/80 sm:pl-6 space-y-3.5">
              {/* Total Task */}
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-[#28292f] flex items-center justify-center text-zinc-300 shrink-0">
                  <ListTodo className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-base font-bold text-white leading-none">{totalTasks}</p>
                  <p className="text-xs text-zinc-400 mt-1">Total Task</p>
                </div>
              </div>

              {/* Completed Task */}
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-[#28292f] flex items-center justify-center text-[#a3e635] shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-base font-bold text-white leading-none">{doneTasks}</p>
                  <p className="text-xs text-zinc-400 mt-1">Completed Task</p>
                </div>
              </div>

              {/* Pending Task */}
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-[#28292f] flex items-center justify-center text-amber-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-base font-bold text-white leading-none">{pendingTasks}</p>
                  <p className="text-xs text-zinc-400 mt-1">Pending Task</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. "TODAY'S TASKS" SECTION ─── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Today's Tasks
          </h2>
          <button
            onClick={() => onTabChange('all-tasks')}
            className="text-xs sm:text-sm font-semibold text-gray-500 hover:text-gray-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            View All
          </button>
        </div>

        {/* Status Filter Pills (Horizontal Scrollable) */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {statusFilterOptions.map((opt) => {
            const isActive = selectedStatusFilter === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedStatusFilter(opt.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#c5e848] text-gray-950 shadow-md shadow-lime-400/20'
                    : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-100 dark:border-zinc-700/60 hover:bg-gray-50 dark:hover:bg-zinc-750'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isActive
                      ? 'bg-white text-gray-950'
                      : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300'
                  }`}
                >
                  {opt.count}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Task Cards List (Dribbble Modern Cards) */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800/60 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-700/50">
            <CheckCircle2 className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
              Tidak ada tugas untuk filter ini
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Klik tombol + di atas untuk menambahkan tugas baru.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((task) => {
              const priorityInfo = getPriorityInfo(task);
              const isOverdue = task.status !== 'Done' && task.dueDate < today;

              return (
                <div
                  key={task.id}
                  onClick={() => onTabChange('all-tasks')}
                  className="bg-white dark:bg-zinc-800/90 rounded-[28px] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-zinc-700/60 hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Priority Pill + Arrow Button */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${priorityInfo.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.dot}`} />
                        {priorityInfo.label}
                      </span>

                      <button
                        className="w-8 h-8 rounded-full bg-gray-50 dark:bg-zinc-700/60 group-hover:bg-[#18191d] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black flex items-center justify-center text-gray-400 transition-colors"
                        title="View Task Details"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Task Title */}
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-3.5 mb-1 group-hover:text-ios-blue transition-colors line-clamp-2">
                      {task.title}
                    </h3>

                    {/* Description or Meeting Origin */}
                    <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 mb-4">
                      {task.description || task.meetingTitle}
                    </p>
                  </div>

                  {/* Bottom Row: Time / Due Date + Participant Avatar Stack */}
                  <div className="pt-3 border-t border-gray-50 dark:border-zinc-750 flex items-center justify-between">
                    <div
                      className={`flex items-center gap-1.5 text-xs font-semibold ${
                        isOverdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-gray-500 dark:text-zinc-400'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {task.dueTime
                          ? `${fmtDate(task.dueDate)} · ${task.dueTime}`
                          : fmtDate(task.dueDate)}
                      </span>
                    </div>

                    {/* Real Avatar Stack for PICs */}
                    <div className="flex items-center -space-x-2">
                      {(() => {
                        const assignees = (task.assignees && task.assignees.length > 0)
                          ? task.assignees
                          : (task.assignee ? task.assignee.split(',').map((s) => s.trim()).filter(Boolean) : ['User']);
                        const colors = [
                          'from-indigo-500 to-purple-500',
                          'from-amber-400 to-rose-400',
                          'from-emerald-400 to-teal-500',
                          'from-blue-400 to-cyan-500',
                        ];
                        return (
                          <>
                            {assignees.slice(0, 3).map((name, i) => (
                              <div
                                key={i}
                                className={`w-7 h-7 rounded-full bg-gradient-to-tr ${colors[i % colors.length]} border-2 border-white dark:border-zinc-800 flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}
                                title={name}
                              >
                                {name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {assignees.length > 3 && (
                              <div
                                className="w-7 h-7 rounded-full bg-black dark:bg-white text-white dark:text-black border-2 border-white dark:border-zinc-800 flex items-center justify-center text-[10px] font-extrabold shadow-sm"
                                title={assignees.slice(3).join(', ')}
                              >
                                +{assignees.length - 3}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 5. RECENT MEETINGS SECTION (Desktop/Tablet Bonus) ─── */}
      {realMeetings.length > 0 && (
        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-ios-blue" />
              <span>Jadwal Rapat Terakhir</span>
            </h2>
            <button
              onClick={() => onTabChange('meetings')}
              className="text-xs sm:text-sm font-semibold text-gray-500 hover:text-gray-950 dark:text-zinc-400 dark:hover:text-white"
            >
              Semua Rapat
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {realMeetings.slice(0, 3).map((m) => {
              const taskCount = m.tasks?.length || 0;
              const doneCount = m.tasks?.filter((t) => t.status === 'Done').length || 0;
              return (
                <div
                  key={m.id}
                  onClick={() => onSelectMeeting(m)}
                  className="bg-white dark:bg-zinc-800/90 rounded-2xl p-4 border border-gray-100 dark:border-zinc-700/60 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-ios-blue bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full">
                      {fmtDate(m.meetingDate)}
                    </span>
                    <span className="text-xs font-semibold text-gray-400">
                      {doneCount}/{taskCount} Tugas
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {m.title || `Rapat ${m.meetingDate}`}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 truncate">
                    {m.participants.join(', ') || 'Tanpa peserta tercatat'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
