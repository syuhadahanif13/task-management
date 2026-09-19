import React, { useState, useMemo, useEffect } from 'react';
import { Meeting, Task, EmployeeStats, Division, User } from '../types';
import { Translations } from '../i18n';
import { api } from '../api/client';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Filter,
  ChevronRight,
  Target,
  BarChart2,
  UserPlus,
  Building,
} from 'lucide-react';

interface TeamDashboardProps {
  meetings: Meeting[];
  t: Translations;
  onSelectMeeting: (meeting: Meeting) => void;
  onOpenUserManager?: () => void;
}

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  percent,
  size = 72,
  strokeWidth = 6,
  color = '#34c759',
  trackColor = '#e5e5ea',
  label,
  sublabel,
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        {label && (
          <text
            x="50%"
            y="50%"
            dominantBaseline="central"
            textAnchor="middle"
            className="fill-current font-bold text-xs"
            style={{ fontSize: size > 60 ? '14px' : '11px' }}
          >
            {label}
          </text>
        )}
      </svg>
      {sublabel && (
        <span className="text-[10px] text-notion-text-secondary font-medium">{sublabel}</span>
      )}
    </div>
  );
};

const getRingColor = (rate: number): string => {
  if (rate >= 80) return '#34c759'; // green
  if (rate >= 50) return '#ff9500'; // orange
  return '#ff3b30'; // red
};

export const TeamDashboard: React.FC<TeamDashboardProps> = ({
  meetings,
  t,
  onSelectMeeting,
  onOpenUserManager,
}) => {
  const [filterDivision, setFilterDivision] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'completion' | 'overdue' | 'total'>('completion');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Fetch users and divisions
  useEffect(() => {
    setIsLoadingMeta(true);
    Promise.all([api.getUsers(), api.getDivisions()])
      .then(([usersData, divisionsData]) => {
        setUsers(usersData);
        setDivisions(divisionsData);
      })
      .catch((err) => {
        console.warn('Gagal memuat pengguna / divisi untuk tim:', err);
      })
      .finally(() => {
        setIsLoadingMeta(false);
      });
  }, []);

  // Build employee stats from tasks across all meetings + registered users
  const allTasks = useMemo(() => {
    const result: Array<Task & { meetingTitle: string; meetingDate: string }> = [];
    for (const m of meetings) {
      for (const t of m.tasks || []) {
        const isStandalone = m.id === 'general-tasks' || !t.meetingId || t.meetingId === 'general-tasks';
        result.push({
          ...t,
          meetingTitle: isStandalone ? 'Tugas Mandiri' : (m.title || `Rapat ${m.meetingDate}`),
          meetingDate: isStandalone ? '' : m.meetingDate,
        });
      }
    }
    return result;
  }, [meetings]);

  const employeeStatsMap = useMemo(() => {
    const map = new Map<string, EmployeeStats>();

    // Map divisions
    const divisionNameMap = new Map<string, string>();
    for (const d of divisions) {
      divisionNameMap.set(d.id, d.name);
    }

    // Map user to division
    const userDivisionMap = new Map<string, { id: string; name: string }>();
    for (const u of users) {
      const divName = divisionNameMap.get(u.divisionId) || 'Tanpa Divisi';
      userDivisionMap.set(u.username.toLowerCase(), { id: u.divisionId, name: divName });

      // Pre-seed registered user into the map
      map.set(u.username, {
        name: u.username,
        divisionId: u.divisionId,
        divisionName: divName,
        totalTasks: 0,
        doneTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        pendingApprovalTasks: 0,
        completionRate: 0,
        tasks: [],
      });
    }

    // Aggregate tasks
    for (const task of allTasks) {
      const names = (task.assignees && task.assignees.length > 0)
        ? task.assignees
        : (task.assignee ? task.assignee.split(',').map((s) => s.trim()).filter(Boolean) : ['Tidak Diketahui']);

      for (const rawName of names) {
        const nameKey = rawName.trim();
        if (!nameKey) continue;

        if (!map.has(nameKey)) {
          // Try finding registered user case-insensitively
          const matched = userDivisionMap.get(nameKey.toLowerCase());
          map.set(nameKey, {
            name: nameKey,
            divisionId: matched?.id,
            divisionName: matched?.name || 'Eksternal / Tamu',
            totalTasks: 0,
            doneTasks: 0,
            inProgressTasks: 0,
            overdueTasks: 0,
            pendingApprovalTasks: 0,
            completionRate: 0,
            tasks: [],
          });
        }

        const stats = map.get(nameKey)!;
        stats.totalTasks++;
        stats.tasks.push(task);

        if (task.status === 'Done') stats.doneTasks++;
        else if (task.status === 'In Progress') stats.inProgressTasks++;
        else if (task.status === 'Pending Approval') stats.pendingApprovalTasks++;

        if (task.status !== 'Done' && task.dueDate && task.dueDate < today) {
          stats.overdueTasks++;
        }
      }
    }

    // Calculate completion rates
    for (const stats of map.values()) {
      stats.completionRate =
        stats.totalTasks > 0 ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;
    }

    return map;
  }, [allTasks, today, users, divisions]);

  // Filter and sort
  const employees: EmployeeStats[] = Array.from<EmployeeStats>(employeeStatsMap.values())
    .filter((emp) => {
      if (filterDivision === 'all') return true;
      return emp.divisionId === filterDivision;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'completion') return b.completionRate - a.completionRate;
      if (sortBy === 'overdue') return b.overdueTasks - a.overdueTasks;
      if (sortBy === 'total') return b.totalTasks - a.totalTasks;
      return 0;
    });

  // Summary stats
  const totalEmployees = employees.length;
  const avgCompletion =
    totalEmployees > 0
      ? Math.round(employees.reduce((s, e) => s + e.completionRate, 0) / totalEmployees)
      : 0;
  const totalOverdue = employees.reduce((s, e) => s + e.overdueTasks, 0);
  const totalDone = employees.reduce((s, e) => s + e.doneTasks, 0);
  const totalAll = employees.reduce((s, e) => s + e.totalTasks, 0);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Done': return 'status-done';
      case 'In Progress': return 'status-inprogress';
      case 'Pending Approval': return 'status-pending';
      default: return 'status-todo';
    }
  };

  const getStatusLabel = (status: string) => {
    return (t.tasks.statuses as any)[status] || status;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="ios-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="ios-large-title">{t.team.title}</h2>
            <p className="text-sm text-notion-text-secondary mt-0.5">
              Pemantauan tugas karyawan terintegrasi dengan divisi & pengguna
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Division Filter */}
            <div className="flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-notion-text-secondary" />
              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className="notion-input text-xs py-1.5 min-w-[130px]"
              >
                <option value="all">Semua Divisi</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="notion-input text-xs py-1.5 max-w-[150px]"
            >
              <option value="completion">Urutkan: Penyelesaian</option>
              <option value="overdue">Urutkan: Terlambat</option>
              <option value="total">Urutkan: Total Tugas</option>
              <option value="name">Urutkan: Nama</option>
            </select>

            {/* Manage Users button */}
            {onOpenUserManager && (
              <button
                onClick={onOpenUserManager}
                className="notion-btn notion-btn-primary text-xs py-1.5 px-3"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Kelola Pengguna</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-notion-border">
          {[
            {
              label: t.team.totalEmployees,
              value: totalEmployees,
              icon: Users,
              color: 'text-ios-blue',
            },
            {
              label: t.team.avgCompletion,
              value: `${avgCompletion}%`,
              icon: TrendingUp,
              color: 'text-ios-green',
            },
            {
              label: 'Total Tugas Selesai',
              value: `${totalDone}/${totalAll}`,
              icon: CheckCircle2,
              color: 'text-ios-indigo',
            },
            {
              label: t.team.overdueCount,
              value: totalOverdue,
              icon: AlertCircle,
              color: totalOverdue > 0 ? 'text-ios-red' : 'text-ios-gray',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-3 rounded-xl bg-notion-sidebar">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-notion-text-secondary">{label}</span>
              </div>
              <p className="text-xl font-bold text-notion-text">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Employee Cards */}
      {employees.length === 0 ? (
        <div className="ios-card p-12 text-center">
          <Users className="w-10 h-10 text-notion-text-secondary opacity-20 mx-auto mb-3" />
          <p className="text-sm text-notion-text-secondary">{t.team.noEmployees}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => {
            const isExpanded = expandedEmployee === emp.name;
            const ringColor = getRingColor(emp.completionRate);

            return (
              <div key={emp.name} className="ios-card overflow-hidden">
                {/* Employee header row */}
                <div
                  className="p-4 cursor-pointer hover:bg-notion-hover transition-colors"
                  onClick={() =>
                    setExpandedEmployee(isExpanded ? null : emp.name)
                  }
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-ios-blue to-ios-indigo flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-notion-text truncate">{emp.name}</p>
                        {emp.divisionName && (
                          <span className="notion-badge bg-blue-50 dark:bg-blue-950/30 text-ios-blue text-[10px]">
                            {emp.divisionName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-notion-text-secondary mt-0.5">
                        {emp.totalTasks} tugas
                        {emp.overdueTasks > 0 && (
                          <span className="ml-2 text-red-500 font-medium">
                            · {emp.overdueTasks} terlambat
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Progress Ring */}
                    <div className="shrink-0">
                      <ProgressRing
                        percent={emp.completionRate}
                        size={52}
                        strokeWidth={5}
                        color={ringColor}
                        label={`${emp.completionRate}%`}
                      />
                    </div>

                    {/* Expand */}
                    <ChevronRight
                      className={`w-4 h-4 text-notion-text-secondary transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </div>

                  {/* Task status mini bar */}
                  {emp.totalTasks > 0 && (
                    <div className="mt-3 flex gap-1">
                      {emp.doneTasks > 0 && (
                        <div
                          className="h-1.5 rounded-full bg-ios-green transition-all"
                          style={{ flex: emp.doneTasks }}
                          title={`${emp.doneTasks} selesai`}
                        />
                      )}
                      {emp.inProgressTasks > 0 && (
                        <div
                          className="h-1.5 rounded-full bg-ios-blue transition-all"
                          style={{ flex: emp.inProgressTasks }}
                          title={`${emp.inProgressTasks} dalam proses`}
                        />
                      )}
                      {emp.pendingApprovalTasks > 0 && (
                        <div
                          className="h-1.5 rounded-full bg-ios-orange transition-all"
                          style={{ flex: emp.pendingApprovalTasks }}
                          title={`${emp.pendingApprovalTasks} menunggu persetujuan`}
                        />
                      )}
                      {emp.totalTasks - emp.doneTasks - emp.inProgressTasks - emp.pendingApprovalTasks > 0 && (
                        <div
                          className="h-1.5 rounded-full bg-ios-gray4 transition-all"
                          style={{
                            flex: emp.totalTasks - emp.doneTasks - emp.inProgressTasks - emp.pendingApprovalTasks,
                          }}
                          title="Belum mulai"
                        />
                      )}
                    </div>
                  )}

                  {/* Status counts */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {emp.doneTasks > 0 && (
                      <span className="notion-badge status-done">{emp.doneTasks} selesai</span>
                    )}
                    {emp.inProgressTasks > 0 && (
                      <span className="notion-badge status-inprogress">{emp.inProgressTasks} proses</span>
                    )}
                    {emp.pendingApprovalTasks > 0 && (
                      <span className="notion-badge status-pending">{emp.pendingApprovalTasks} review</span>
                    )}
                    {emp.overdueTasks > 0 && (
                      <span className="notion-badge bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        ⚠ {emp.overdueTasks} terlambat
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded: Task List */}
                {isExpanded && (
                  <div className="border-t border-notion-border divide-y divide-notion-border">
                    {emp.tasks.length === 0 ? (
                      <div className="p-4 text-center text-xs text-notion-text-secondary">
                        Belum ada tugas yang ditugaskan ke karyawan ini
                      </div>
                    ) : (
                      emp.tasks.map((task) => {
                        const isOverdue =
                          task.status !== 'Done' && task.dueDate && task.dueDate < today;
                        return (
                          <div
                            key={task.id}
                            className="px-4 py-3 hover:bg-notion-hover transition-colors cursor-pointer"
                            onClick={() => {
                              if (task.meetingId && task.meetingId !== 'general-tasks') {
                                const m = meetings.find((x) => x.id === task.meetingId);
                                if (m) onSelectMeeting(m);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium ${
                                    task.status === 'Done'
                                      ? 'line-through text-notion-text-secondary'
                                      : 'text-notion-text'
                                  }`}
                                >
                                  {task.title}
                                </p>
                                <p className="text-xs text-notion-text-secondary mt-0.5">
                                  {task.meetingTitle} {task.meetingDate ? `· ${task.meetingDate}` : ''}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span
                                  className={`notion-badge ${getStatusBadgeClass(task.status)}`}
                                >
                                  {getStatusLabel(task.status)}
                                </span>
                                {task.dueDate && (
                                  <span
                                    className={`text-[10px] ${
                                      isOverdue
                                        ? 'text-red-500 font-semibold'
                                        : 'text-notion-text-secondary'
                                    }`}
                                  >
                                    {isOverdue ? 'Terlambat: ' : 'Tenggat: '}
                                    {new Date(task.dueDate + 'T00:00:00').toLocaleDateString(
                                      'id-ID',
                                      { day: 'numeric', month: 'short' }
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
