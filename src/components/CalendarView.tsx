import React, { useState, useMemo } from 'react';
import { Meeting, Task, CalendarEvent } from '../types';
import { Translations } from '../i18n';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';

interface CalendarViewProps {
  meetings: Meeting[];
  t: Translations;
  onSelectMeeting: (meeting: Meeting) => void;
  onOpenNewMeeting: () => void;
  onOpenNewMeetingOnDate?: (date: string) => void;
}

type CalendarMode = 'month' | 'week' | 'day';

const STATUS_COLORS: Record<string, string> = {
  'To Do': '#8e8e93',
  'In Progress': '#007aff',
  'Pending Approval': '#ff9500',
  'Blocked': '#ff3b30',
  'Done': '#34c759',
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  meetings,
  t,
  onSelectMeeting,
  onOpenNewMeeting,
  onOpenNewMeetingOnDate,
}) => {
  const [mode, setMode] = useState<CalendarMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    new Date().toISOString().split('T')[0]
  );
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Build events map: date → events[]
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    const addEvent = (date: string, event: CalendarEvent) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(event);
    };

    for (const m of meetings) {
      // Meeting event
      addEvent(m.meetingDate, {
        id: `m-${m.id}`,
        date: m.meetingDate,
        title: m.title || `Rapat ${m.meetingDate}`,
        type: 'meeting',
        meetingId: m.id,
        color: '#007aff',
      });

      // Task due date events
      for (const task of m.tasks || []) {
        if (!task.dueDate) continue;
        const isOverdue = task.status !== 'Done' && task.dueDate < today;
        addEvent(task.dueDate, {
          id: `t-${task.id}`,
          date: task.dueDate,
          title: task.title,
          type: isOverdue ? 'task-overdue' : 'task-due',
          meetingId: m.id,
          taskId: task.id,
          color: isOverdue ? '#ff3b30' : STATUS_COLORS[task.status] || '#8e8e93',
        });
      }
    }

    return map;
  }, [meetings, today]);

  // --- MONTH VIEW HELPERS ---
  const getMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun

    const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Prev month padding
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + 1 + i);
      cells.push({ date: d, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    // Next month padding
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return cells;
  };

  // --- WEEK VIEW HELPERS ---
  const getWeekDays = () => {
    const date = new Date(currentDate);
    const dow = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - dow);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  };

  const fmtDate = (d: Date) => d.toISOString().split('T')[0];
  const fmtMonthYear = (d: Date) =>
    `${t.calendar.months[d.getMonth()]} ${d.getFullYear()}`;
  const fmtDayShort = (d: Date) => d.getDate();
  const fmtDayOfWeek = (d: Date, short = true) =>
    short ? t.calendar.days[d.getDay()] : t.calendar.days[d.getDay()];

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (mode === 'month') d.setMonth(d.getMonth() + dir);
    else if (mode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(today);
  };

  // Selected date panel data
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) || [] : [];
  const selectedMeetings = meetings.filter((m) => m.meetingDate === selectedDate);

  const headerLabel = () => {
    if (mode === 'month') return fmtMonthYear(currentDate);
    if (mode === 'week') {
      const days = getWeekDays();
      const first = days[0];
      const last = days[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} – ${last.getDate()} ${t.calendar.months[first.getMonth()]} ${first.getFullYear()}`;
      }
      return `${t.calendar.months[first.getMonth()].slice(0, 3)} ${first.getDate()} – ${t.calendar.months[last.getMonth()].slice(0, 3)} ${last.getDate()}, ${first.getFullYear()}`;
    }
    return `${currentDate.getDate()} ${t.calendar.months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  return (
    <div className="space-y-4">
      {/* HEADER BAR */}
      <div className="ios-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="ios-large-title">{t.calendar.title}</h2>
            <p className="text-sm text-notion-text-secondary mt-0.5">{t.calendar.subtitle}</p>
          </div>
          <button
            onClick={onOpenNewMeeting}
            className="notion-btn notion-btn-primary self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            {t.calendar.addMeeting}
          </button>
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-notion-hover transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-notion-text-secondary" />
            </button>
            <span className="text-sm font-semibold text-notion-text min-w-[160px] text-center">
              {headerLabel()}
            </span>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-xl hover:bg-notion-hover transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-notion-text-secondary" />
            </button>
            <button
              onClick={goToday}
              className="notion-btn text-xs font-medium text-ios-blue hover:bg-blue-50 dark:hover:bg-blue-950/30 ml-1"
            >
              {t.calendar.today}
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-notion-sidebar p-1 rounded-xl border border-notion-border">
            {(['month', 'week', 'day'] as CalendarMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === m
                    ? 'bg-notion-bg text-notion-text shadow-sm'
                    : 'text-notion-text-secondary hover:text-notion-text'
                }`}
              >
                {m === 'month' ? t.calendar.month : m === 'week' ? t.calendar.week : t.calendar.day}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* =====================
            MONTH VIEW
            ===================== */}
        {mode === 'month' && (
          <div className="ios-card overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-notion-border">
              {t.calendar.days.map((day) => (
                <div
                  key={day}
                  className="py-2.5 text-center text-[11px] font-semibold text-notion-text-secondary uppercase tracking-wide"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div className="grid grid-cols-7">
              {getMonthGrid().map((cell, idx) => {
                const dateStr = fmtDate(cell.date);
                const events = eventsByDate.get(dateStr) || [];
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const meetingEvents = events.filter((e) => e.type === 'meeting');
                const taskEvents = events.filter((e) => e.type !== 'meeting');
                const hasOverdue = events.some((e) => e.type === 'task-overdue');

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(dateStr)}
                    onMouseEnter={() => setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className={`min-h-[80px] p-1.5 border-b border-r border-notion-border cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-notion-hover'}
                      ${!cell.isCurrentMonth ? 'opacity-40' : ''}
                    `}
                  >
                    {/* Day number */}
                    <div className="flex justify-center mb-1">
                      <span
                        className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                          isToday
                            ? 'bg-ios-blue text-white font-bold'
                            : isSelected
                            ? 'text-ios-blue font-semibold'
                            : 'text-notion-text'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                    </div>

                    {/* Event chips — show up to 2 */}
                    <div className="space-y-0.5">
                      {meetingEvents.slice(0, 1).map((ev) => (
                        <div
                          key={ev.id}
                          className="calendar-event-chip bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {taskEvents.slice(0, 1).map((ev) => (
                        <div
                          key={ev.id}
                          className={`calendar-event-chip ${
                            ev.type === 'task-overdue'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                              : 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300'
                          }`}
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-[9px] text-notion-text-secondary pl-1">
                          +{events.length - 2} lainnya
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =====================
            WEEK VIEW
            ===================== */}
        {mode === 'week' && (
          <div className="ios-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-notion-border">
              {getWeekDays().map((day) => {
                const dateStr = fmtDate(day);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const events = eventsByDate.get(dateStr) || [];
                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-3 text-center cursor-pointer transition-colors border-r border-notion-border last:border-r-0 ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-notion-hover'
                    }`}
                  >
                    <p className="text-[10px] font-medium text-notion-text-secondary uppercase tracking-wide mb-1">
                      {fmtDayOfWeek(day)}
                    </p>
                    <div
                      className={`text-sm font-semibold w-8 h-8 flex items-center justify-center rounded-full mx-auto transition-all ${
                        isToday ? 'bg-ios-blue text-white' : 'text-notion-text'
                      }`}
                    >
                      {fmtDayShort(day)}
                    </div>
                    {events.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1.5">
                        {events.slice(0, 3).map((ev, i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: ev.color || '#007aff' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Week day content */}
            <div className="grid grid-cols-7 min-h-[400px]">
              {getWeekDays().map((day) => {
                const dateStr = fmtDate(day);
                const isSelected = dateStr === selectedDate;
                const events = eventsByDate.get(dateStr) || [];
                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-2 border-r border-notion-border last:border-r-0 cursor-pointer min-h-[200px] transition-colors ${
                      isSelected ? 'bg-blue-50/50 dark:bg-blue-950/10' : 'hover:bg-notion-hover/50'
                    }`}
                  >
                    <div className="space-y-1">
                      {events.map((ev) => (
                        <div
                          key={ev.id}
                          className="calendar-event-chip"
                          style={{
                            backgroundColor: `${ev.color}20`,
                            color: ev.color,
                          }}
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =====================
            DAY VIEW
            ===================== */}
        {mode === 'day' && (
          <div className="ios-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold ${
                  fmtDate(currentDate) === today
                    ? 'bg-ios-blue text-white'
                    : 'bg-notion-sidebar text-notion-text'
                }`}
              >
                {currentDate.getDate()}
              </div>
              <div>
                <p className="text-xs text-notion-text-secondary font-medium uppercase tracking-wide">
                  {fmtDayOfWeek(currentDate, false)}
                </p>
                <p className="text-sm font-semibold text-notion-text">
                  {t.calendar.months[currentDate.getMonth()]} {currentDate.getFullYear()}
                </p>
              </div>
            </div>

            {(() => {
              const dateStr = fmtDate(currentDate);
              const events = eventsByDate.get(dateStr) || [];
              if (events.length === 0) {
                return (
                  <div className="text-center py-12">
                    <Calendar className="w-10 h-10 text-notion-text-secondary opacity-30 mx-auto mb-3" />
                    <p className="text-sm text-notion-text-secondary">{t.calendar.noEvents}</p>
                    <button
                      onClick={() => onOpenNewMeetingOnDate?.(dateStr) || onOpenNewMeeting()}
                      className="mt-3 notion-btn text-xs text-ios-blue hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t.calendar.addMeeting}
                    </button>
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => {
                        if (ev.meetingId) {
                          const m = meetings.find((x) => x.id === ev.meetingId);
                          if (m) onSelectMeeting(m);
                        }
                      }}
                      className={`p-3 rounded-xl border-l-2 cursor-pointer hover:bg-notion-hover transition-colors ${
                        ev.type === 'meeting'
                          ? 'border-ios-blue bg-blue-50/50 dark:bg-blue-950/10'
                          : ev.type === 'task-overdue'
                          ? 'border-red-500 bg-red-50/50 dark:bg-red-950/10'
                          : 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {ev.type === 'meeting' ? (
                          <Calendar className="w-3.5 h-3.5 text-ios-blue shrink-0" />
                        ) : ev.type === 'task-overdue' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        ) : (
                          <CheckSquare className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium text-notion-text">{ev.title}</span>
                      </div>
                      <p className="text-xs text-notion-text-secondary mt-0.5 ml-5">
                        {ev.type === 'meeting' ? 'Rapat' : 'Tugas jatuh tempo'}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* =====================
            SIDE PANEL — selected date detail
            ===================== */}
        <div className="space-y-3">
          {/* Selected date header */}
          <div className="ios-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-notion-text">
                {selectedDate
                  ? (() => {
                      const d = new Date(selectedDate + 'T00:00:00');
                      return `${d.getDate()} ${t.calendar.months[d.getMonth()]}`;
                    })()
                  : 'Pilih tanggal'}
              </h3>
              {selectedDate && (
                <button
                  onClick={() =>
                    onOpenNewMeetingOnDate?.(selectedDate) || onOpenNewMeeting()
                  }
                  className="notion-btn text-xs text-ios-blue hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2 py-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {selectedDate === today && (
              <span className="notion-badge bg-ios-blue text-white text-[10px] mb-2">
                {t.calendar.today}
              </span>
            )}

            {selectedEvents.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 text-notion-text-secondary opacity-20 mx-auto mb-2" />
                <p className="text-xs text-notion-text-secondary">{t.calendar.noEvents}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Meetings */}
                {selectedMeetings.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => onSelectMeeting(m)}
                    className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-ios-blue shrink-0" />
                      <p className="text-xs font-semibold text-notion-text line-clamp-1">
                        {m.title || `Rapat ${m.meetingDate}`}
                      </p>
                    </div>
                    <p className="text-[10px] text-notion-text-secondary mt-0.5 ml-5">
                      {m.participants.length} peserta · {m.tasks?.length || 0} tugas
                    </p>
                  </div>
                ))}

                {/* Tasks due on this date */}
                {selectedEvents
                  .filter((e) => e.type !== 'meeting')
                  .map((ev) => (
                    <div
                      key={ev.id}
                      className={`p-2.5 rounded-xl ${
                        ev.type === 'task-overdue'
                          ? 'bg-red-50 dark:bg-red-950/20'
                          : 'bg-orange-50 dark:bg-orange-950/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {ev.type === 'task-overdue' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        ) : (
                          <CheckSquare className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        )}
                        <p className="text-xs font-medium text-notion-text line-clamp-1">{ev.title}</p>
                      </div>
                      <p className="text-[10px] text-notion-text-secondary mt-0.5 ml-5">
                        Tugas jatuh tempo
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="ios-card p-4">
            <p className="text-[11px] font-semibold text-notion-text-secondary uppercase tracking-widest mb-2">
              Keterangan
            </p>
            <div className="space-y-1.5">
              {[
                { color: '#007aff', label: 'Rapat', bg: 'bg-blue-100 dark:bg-blue-950/50' },
                { color: '#ff9500', label: 'Tugas jatuh tempo', bg: 'bg-orange-50 dark:bg-orange-950/30' },
                { color: '#ff3b30', label: 'Tugas terlambat', bg: 'bg-red-50 dark:bg-red-950/30' },
              ].map(({ color, label, bg }) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-notion-text-secondary">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
