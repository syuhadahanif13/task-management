import React from 'react';
import { Meeting, Task } from '../types';
import { Translations } from '../i18n';
import {
  BookOpen,
  CheckSquare,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  Calendar,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface DashboardProps {
  meetings: Meeting[];
  t: Translations;
  onSelectMeeting: (meeting: Meeting) => void;
  onTabChange: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  meetings,
  t,
  onSelectMeeting,
  onTabChange,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const allTasks: Array<Task & { meetingTitle: string }> = [];
  for (const m of meetings) {
    for (const task of m.tasks || []) {
      allTasks.push({ ...task, meetingTitle: m.title || `Rapat ${m.meetingDate}` });
    }
  }

  const totalMeetings = meetings.length;
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === 'Done').length;
  const inProgressTasks = allTasks.filter((t) => t.status === 'In Progress').length;
  const overdueTasks = allTasks.filter(
    (t) => t.status !== 'Done' && t.dueDate && t.dueDate < today
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Upcoming tasks (not done, due in the future or today, sorted by due date)
  const upcomingTasks = allTasks
    .filter((t) => t.status !== 'Done' && t.dueDate && t.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  // Recent meetings (last 5)
  const recentMeetings = [...meetings]
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))
    .slice(0, 5);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Done': return 'status-done';
      case 'In Progress': return 'status-inprogress';
      case 'Pending Approval': return 'status-pending';
      case 'Blocked': return 'status-blocked';
      default: return 'status-todo';
    }
  };

  const getStatusLabel = (status: string, t: Translations) => {
    return (t.tasks.statuses as any)[status] || status;
  };

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });

  return (
    <div className="space-y-5">
      {/* Welcome header */}
      <div className="ios-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="ios-large-title">{t.dashboard.title}</h2>
            <p className="text-sm text-notion-text-secondary mt-1">{t.dashboard.subtitle}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-notion-text-secondary">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: t.dashboard.totalMeetings,
            value: totalMeetings,
            icon: BookOpen,
            iconColor: 'text-ios-blue',
            bg: 'bg-blue-50 dark:bg-blue-950/20',
            onClick: () => onTabChange('meetings'),
          },
          {
            label: t.dashboard.totalTasks,
            value: totalTasks,
            icon: CheckSquare,
            iconColor: 'text-ios-indigo',
            bg: 'bg-indigo-50 dark:bg-indigo-950/20',
            onClick: () => onTabChange('all-tasks'),
          },
          {
            label: t.dashboard.completionRate,
            value: `${completionRate}%`,
            icon: TrendingUp,
            iconColor: 'text-ios-green',
            bg: 'bg-green-50 dark:bg-green-950/20',
            onClick: () => onTabChange('all-tasks'),
          },
          {
            label: t.dashboard.overdue,
            value: overdueTasks,
            icon: AlertCircle,
            iconColor: overdueTasks > 0 ? 'text-ios-red' : 'text-ios-gray',
            bg: overdueTasks > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-notion-sidebar',
            onClick: () => onTabChange('all-tasks'),
          },
        ].map(({ label, value, icon: Icon, iconColor, bg, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className={`${bg} rounded-2xl p-4 text-left ios-card-interactive ios-card border-0`}
          >
            <div className={`${iconColor} mb-2.5`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-notion-text">{value}</p>
            <p className="text-xs text-notion-text-secondary mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Meetings */}
        <div className="ios-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-notion-border">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-ios-blue" />
              <h3 className="text-sm font-bold text-notion-text">{t.dashboard.recentMeetings}</h3>
            </div>
            <button
              onClick={() => onTabChange('meetings')}
              className="text-xs text-ios-blue font-medium flex items-center gap-0.5 hover:underline"
            >
              Semua <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentMeetings.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-8 h-8 text-notion-text-secondary opacity-20 mx-auto mb-2" />
              <p className="text-xs text-notion-text-secondary">{t.meetings.noMeetings}</p>
            </div>
          ) : (
            <div className="divide-y divide-notion-border">
              {recentMeetings.map((m) => {
                const tasksDone = m.tasks?.filter((t) => t.status === 'Done').length || 0;
                const tasksTotal = m.tasks?.length || 0;
                return (
                  <div
                    key={m.id}
                    onClick={() => onSelectMeeting(m)}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-notion-hover cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-ios-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-notion-text truncate">
                        {m.title || `Rapat ${m.meetingDate}`}
                      </p>
                      <p className="text-xs text-notion-text-secondary mt-0.5">
                        {fmtDate(m.meetingDate)} · {tasksTotal} tugas
                      </p>
                    </div>
                    {tasksTotal > 0 && (
                      <span className="text-[11px] font-semibold text-notion-text-secondary shrink-0">
                        {tasksDone}/{tasksTotal}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Tasks */}
        <div className="ios-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-notion-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-ios-orange" />
              <h3 className="text-sm font-bold text-notion-text">{t.dashboard.upcomingTasks}</h3>
            </div>
            <button
              onClick={() => onTabChange('all-tasks')}
              className="text-xs text-ios-blue font-medium flex items-center gap-0.5 hover:underline"
            >
              Semua <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-notion-text-secondary opacity-20 mx-auto mb-2" />
              <p className="text-xs text-notion-text-secondary">
                {totalTasks === 0 ? 'Belum ada tugas' : 'Semua tugas sudah selesai! 🎉'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-notion-border">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="px-4 py-3 flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      task.status === 'In Progress'
                        ? 'bg-ios-blue'
                        : task.status === 'Pending Approval'
                        ? 'bg-ios-orange'
                        : 'bg-ios-gray3'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-notion-text truncate">{task.title}</p>
                    <p className="text-xs text-notion-text-secondary mt-0.5">
                      {task.assignee} · {task.meetingTitle}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className={`notion-badge ${getStatusClass(task.status)}`}>
                      {getStatusLabel(task.status, t)}
                    </span>
                    <span className="text-[10px] text-notion-text-secondary">
                      {fmtDate(task.dueDate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In-progress summary */}
      {inProgressTasks > 0 && (
        <div className="ios-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-ios-blue" />
            </div>
            <div>
              <p className="text-sm font-semibold text-notion-text">
                {inProgressTasks} tugas sedang dikerjakan
              </p>
              <p className="text-xs text-notion-text-secondary">
                {doneTasks} dari {totalTasks} tugas sudah selesai ({completionRate}%)
              </p>
            </div>
            <div className="flex-1 ml-2 hidden sm:block">
              <div className="h-1.5 rounded-full bg-notion-sidebar overflow-hidden">
                <div
                  className="h-full rounded-full bg-ios-green transition-all duration-700"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
