import React, { useState, useMemo } from 'react';
import { Meeting, Task, CalendarEvent } from '../types';
import { Translations } from '../i18n';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  CheckSquare,
  AlertCircle,
  Video,
  Briefcase,
  User,
  Star,
  MoreHorizontal,
  ArrowLeft,
} from 'lucide-react';

import { isTaskAssignedToUser } from '../utils/taskAccess';

interface CalendarViewProps {
  meetings: Meeting[];
  t: Translations;
  currentUser?: { username: string; role?: string; divisionId?: string } | null;
  onSelectMeeting: (meeting: Meeting) => void;
  onOpenNewMeeting: () => void;
  onOpenNewMeetingOnDate?: (date: string) => void;
  onOpenAddTask?: () => void;
}

type CalendarViewMode = 'schedule' | 'month' | 'week' | 'day';

const STATUS_COLORS: Record<string, string> = {
  'To Do': '#8e8e93',
  'In Progress': '#8b5cf6',
  'Pending Approval': '#f59e0b',
  'Done': '#10b981',
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  meetings,
  t,
  currentUser,
  onSelectMeeting,
  onOpenNewMeeting,
  onOpenNewMeetingOnDate,
  onOpenAddTask,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('schedule');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const today = new Date().toISOString().split('T')[0];

  // Build events map: date → events[]
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    const addEvent = (date: string, event: CalendarEvent) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(event);
    };

    for (const m of meetings) {
      if (m.id.startsWith('system-')) continue;
      if (m.id !== 'general-tasks') {
        addEvent(m.meetingDate, {
          id: `m-${m.id}`,
          date: m.meetingDate,
          title: m.title || `Rapat ${m.meetingDate}`,
          type: 'meeting',
          meetingId: m.id,
          color: '#3b82f6',
        });
      }

      for (const task of m.tasks || []) {
        if (!task.dueDate) continue;
        if (!isTaskAssignedToUser(task, currentUser)) continue;
        const isOverdue = task.status !== 'Done' && task.dueDate < today;
        addEvent(task.dueDate, {
          id: `t-${task.id}`,
          date: task.dueDate,
          title: task.title,
          type: isOverdue ? 'task-overdue' : 'task-due',
          meetingId: m.id,
          taskId: task.id,
          color: isOverdue ? '#ef4444' : STATUS_COLORS[task.status] || '#8e8e93',
        });
      }
    }

    return map;
  }, [meetings, today, currentUser]);

  // Weekly Date Strip (7 days around currentDate)
  const weekDays = useMemo(() => {
    const base = new Date(currentDate);
    const dayOfWeek = base.getDay(); // 0 = Sun
    // Adjust so week starts on Monday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - distanceToMonday);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      return { date: d, iso, dayName, dayNum };
    });
  }, [currentDate]);

  // Selected date's events & tasks
  const selectedDateEvents = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      time: string;
      type: 'meeting' | 'task';
      meeting?: Meeting;
      task?: Task;
      status?: string;
      participants?: string[];
      category?: string;
    }> = [];

    // Meetings on selected date
    for (const m of meetings) {
      if (m.id.startsWith('system-')) continue;
      if (m.id !== 'general-tasks' && m.meetingDate === selectedDate) {
        items.push({
          id: `m-${m.id}`,
          title: m.title || `Meeting with Client`,
          subtitle: m.meetingNotes || 'Client meeting to review project progress and align on goals.',
          time: '9:00 AM',
          type: 'meeting',
          meeting: m,
          participants: m.participants,
          category: 'work',
        });
      }

      // Tasks on selected date
      for (const t of m.tasks || []) {
        if (t.dueDate === selectedDate && isTaskAssignedToUser(t, currentUser)) {
          items.push({
            id: `t-${t.id}`,
            title: t.title,
            subtitle: t.description || (m.title ? `From: ${m.title}` : undefined),
            time: t.dueTime ? `${t.dueTime}` : '11:00 AM',
            type: 'task',
            task: t,
            status: t.status,
            participants: t.assignees && t.assignees.length > 0
              ? t.assignees
              : (t.assignee ? t.assignee.split(',').map((s) => s.trim()).filter(Boolean) : []),
            category: t.tags?.includes('Personal') ? 'personal' : 'work',
          });
        }
      }
    }

    if (activeCategory === 'work') return items.filter((i) => i.category !== 'personal');
    if (activeCategory === 'personal') return items.filter((i) => i.category === 'personal');
    return items;
  }, [meetings, selectedDate, activeCategory, currentUser]);

  const selectedDateFormatted = useMemo(() => {
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const navigateWeek = (direction: -1 | 1) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + direction * 7);
    setCurrentDate(d);
  };

  // Month grid calculations for full calendar view
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

    const cells: Array<{ date: Date; iso: string; isCurrentMonth: boolean }> = [];

    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + 1 + i);
      cells.push({ date: d, iso: d.toISOString().split('T')[0], isCurrentMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(year, month, d);
      cells.push({ date: dt, iso: dt.toISOString().split('T')[0], isCurrentMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const dt = new Date(year, month + 1, i);
      cells.push({ date: dt, iso: dt.toISOString().split('T')[0], isCurrentMonth: false });
    }
    return cells;
  }, [currentDate]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* ─── 1. TOP HEADER (Arrow | Formatted Date | + | ...) ─── */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => navigateWeek(-1)}
          className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 border border-gray-200/80 dark:border-zinc-700 flex items-center justify-center text-gray-700 dark:text-zinc-200 shadow-sm hover:bg-gray-50 active:scale-95 transition"
          title="Previous week"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
          {selectedDateFormatted}
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenAddTask ? onOpenAddTask() : onOpenNewMeeting()}
            className="w-11 h-11 rounded-full bg-[#18191d] hover:bg-black text-white flex items-center justify-center shadow-lg transition active:scale-95"
            title="Tambah Tugas / Rapat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigateWeek(1)}
            className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 border border-gray-200/80 dark:border-zinc-700 flex items-center justify-center text-gray-700 dark:text-zinc-200 shadow-sm hover:bg-gray-50 active:scale-95 transition"
            title="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ─── 2. TITLE ROW: "Task Schedule" + [📅 Calendar] Pill ─── */}
      <div className="flex items-end justify-between gap-4 pt-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-950 dark:text-white leading-tight">
            Task<br />Schedule
          </h1>
        </div>

        <button
          onClick={() => setViewMode(viewMode === 'schedule' ? 'month' : 'schedule')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 shadow-sm ${
            viewMode === 'month'
              ? 'bg-[#18191d] text-white border-black dark:bg-white dark:text-black'
              : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-white border-gray-200/80 dark:border-zinc-700 hover:bg-gray-50'
          }`}
        >
          <CalendarIcon className="w-4 h-4 text-gray-600 dark:text-zinc-300" />
          <span>{viewMode === 'month' ? 'Schedule' : 'Calendar'}</span>
        </button>
      </div>

      {/* ─── VIEW 1: DRIBBLE SCHEDULE TIMELINE VIEW (DEFAULT) ─── */}
      {viewMode === 'schedule' && (
        <div className="space-y-6">
          {/* 3. Horizontal Weekly Date Strip */}
          <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-[28px] p-3 border border-gray-200/60 dark:border-zinc-700/60 shadow-sm flex items-center justify-between gap-1.5 overflow-x-auto">
            {weekDays.map((item) => {
              const isSelected = item.iso === selectedDate;
              const isToday = item.iso === today;

              return (
                <button
                  key={item.iso}
                  onClick={() => setSelectedDate(item.iso)}
                  className={`flex-1 min-w-[50px] py-3.5 px-2 rounded-2xl flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#18191d] text-white shadow-xl scale-[1.03]'
                      : 'hover:bg-gray-100/70 dark:hover:bg-zinc-700/50 text-gray-600 dark:text-zinc-400'
                  }`}
                >
                  <span className={`text-[11px] font-medium uppercase tracking-wider mb-1 ${
                    isSelected ? 'text-zinc-300' : 'text-gray-400 dark:text-zinc-500'
                  }`}>
                    {item.dayName}
                  </span>
                  <span className={`text-base sm:text-lg font-black ${
                    isSelected ? 'text-white' : 'text-gray-900 dark:text-white'
                  }`}>
                    {item.dayNum}
                  </span>
                  {isToday && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-ios-blue mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* 4. Category Filter Pills */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                activeCategory === 'all'
                  ? 'bg-[#18191d] text-white shadow-md'
                  : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200/70 dark:border-zinc-700'
              }`}
            >
              All
            </button>

            <button
              onClick={() => setActiveCategory('work')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 border transition-all ${
                activeCategory === 'work'
                  ? 'bg-[#18191d] text-white border-black'
                  : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200/70 dark:border-zinc-700'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Work</span>
            </button>

            <button
              onClick={() => setActiveCategory('personal')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 border transition-all ${
                activeCategory === 'personal'
                  ? 'bg-[#18191d] text-white border-black'
                  : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200/70 dark:border-zinc-700'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Personal</span>
            </button>

            <button
              className="p-2.5 rounded-full bg-white dark:bg-zinc-800 border border-gray-200/70 dark:border-zinc-700 text-gray-500 hover:text-amber-500 transition"
              title="Starred"
            >
              <Star className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 5. Timeline Schedule Section */}
          <div className="space-y-4 pt-1">
            {/* Section Header: Morning | Today */}
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span>☀️ Schedule</span>
              </span>
              <span>{selectedDate === today ? 'Today' : selectedDateFormatted}</span>
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="bg-white dark:bg-zinc-800/70 rounded-[28px] p-8 text-center border border-gray-100 dark:border-zinc-700/60 shadow-sm">
                <CalendarIcon className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                  Tidak ada agenda terjadwal
                </h4>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto">
                  Belum ada rapat atau tugas pada tanggal ini.
                </p>
                <button
                  onClick={() => onOpenAddTask ? onOpenAddTask() : onOpenNewMeeting()}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#18191d] hover:bg-black text-white text-xs font-bold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Kegiatan</span>
                </button>
              </div>
            ) : (
              <div className="space-y-5 relative before:absolute before:left-[45px] before:top-4 before:bottom-4 before:w-[2px] before:bg-gray-200 dark:before:bg-zinc-700/70">
                {selectedDateEvents.map((item, idx) => (
                  <div key={item.id} className="flex items-start gap-4 sm:gap-6 relative">
                    {/* Time Label & Timeline Dot */}
                    <div className="w-20 pt-1 shrink-0 text-right pr-2">
                      <p className="text-xs font-extrabold text-gray-800 dark:text-white">
                        {item.time}
                      </p>
                    </div>

                    {/* Dot on line */}
                    <div className="absolute left-[41px] top-2.5 w-2.5 h-2.5 rounded-full bg-white dark:bg-zinc-900 ring-4 ring-[#18191d] dark:ring-white z-10" />

                    {/* Event Card */}
                    <div
                      onClick={() => {
                        if (item.type === 'meeting' && item.meeting) {
                          onSelectMeeting(item.meeting);
                        }
                      }}
                      className="flex-1 bg-white dark:bg-zinc-800/90 rounded-[28px] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-zinc-700/60 hover:shadow-md transition-all cursor-pointer"
                    >
                      <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug">
                        {item.title}
                      </h4>

                      {item.subtitle && (
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {item.subtitle}
                        </p>
                      )}

                      {/* Bottom Row: Avatars + Action Button */}
                      <div className="mt-4 pt-3 border-t border-gray-50 dark:border-zinc-750 flex items-center justify-between">
                        {/* Avatars */}
                        <div className="flex items-center -space-x-2">
                          {(item.participants || ['User']).slice(0, 3).map((p, pIdx) => (
                            <div
                              key={pIdx}
                              className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white dark:border-zinc-800 flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                              title={p}
                            >
                              {p.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {(item.participants?.length || 1) > 3 && (
                            <div className="w-7 h-7 rounded-full bg-black text-white dark:bg-white dark:text-black border-2 border-white dark:border-zinc-800 flex items-center justify-center text-[10px] font-extrabold shadow-sm">
                              +{item.participants!.length - 3}
                            </div>
                          )}
                        </div>

                        {/* Action Pill: Meet button or Status Badge */}
                        {item.type === 'meeting' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.meeting) onSelectMeeting(item.meeting);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-ios-blue text-white text-xs font-bold shadow-sm hover:bg-blue-600 transition"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Meet</span>
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300"
                          >
                            {item.status || 'In Progress'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── VIEW 2: FULL MONTH CALENDAR GRID ─── */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-zinc-800 rounded-[32px] p-5 sm:p-6 border border-gray-100 dark:border-zinc-700/60 shadow-sm space-y-4">
          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-gray-400 dark:text-zinc-500 py-2 border-b border-gray-100 dark:border-zinc-700">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Month Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {monthGrid.map(({ date, iso, isCurrentMonth }) => {
              const dayEvents = eventsByDate.get(iso) || [];
              const isSelected = iso === selectedDate;
              const isToday = iso === today;

              return (
                <div
                  key={iso}
                  onClick={() => {
                    setSelectedDate(iso);
                    setViewMode('schedule');
                  }}
                  className={`min-h-[70px] sm:min-h-[85px] p-1.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-black dark:border-white bg-gray-50 dark:bg-zinc-700/50 shadow-sm'
                      : isCurrentMonth
                      ? 'border-gray-100 dark:border-zinc-700/40 hover:bg-gray-50/80 dark:hover:bg-zinc-700/30'
                      : 'border-transparent opacity-30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-ios-blue text-white'
                          : 'text-gray-800 dark:text-white'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-gray-400">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Dot / Chip preview */}
                  <div className="space-y-1 mt-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        style={{ backgroundColor: `${ev.color}15`, color: ev.color }}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate"
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-gray-400 font-semibold pl-1">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
