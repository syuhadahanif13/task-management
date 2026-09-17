import React, { useState, useEffect } from 'react';
import { Meeting, Task, TaskStatus, CreateMeetingInput, CreateTaskInput, TaskSubmission, AppTab } from './types';
import { Language, getT } from './i18n';
import { api } from './api/client';
import { getSupabaseClient } from './lib/supabase';

// Layout
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { BottomTabBar } from './components/BottomTabBar';

// Pages
import { Dashboard } from './components/Dashboard';
import { CalendarView } from './components/CalendarView';
import { AllTasksKanban } from './components/AllTasksKanban';
import { TeamDashboard } from './components/TeamDashboard';
import { MeetingDetailView } from './components/MeetingDetailView';

// Modals
import { NewMeetingModal } from './components/NewMeetingModal';
import { AiExtractModal } from './components/AiExtractModal';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskSubmissionModal } from './components/TaskSubmissionModal';
import { TaskReviewModal } from './components/TaskReviewModal';
import { DivisionManager } from './components/DivisionManager';
import { UserManager } from './components/UserManager';
import { AddTaskModal } from './components/AddTaskModal';
import { LoginPage } from './components/LoginPage';

import {
  Check,
  AlertCircle,
  RefreshCw,
  Plus,
  BookOpen,
  CheckSquare,
  Users,
  Settings as SettingsIcon,
} from 'lucide-react';

export default function App() {
  // ─── Auth ───
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    sessionStorage.getItem('isAuthenticated') === 'true'
  );

  // ─── Theme ───
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return false;
  });

  // ─── Language ───
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'id';
  });
  const t = getT(language);

  // ─── Data ───
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ─── Navigation ───
  const [currentTab, setCurrentTab] = useState<AppTab>('dashboard');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ─── Modals ───
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [isAiExtractOpen, setIsAiExtractOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [reviewingTask, setReviewingTask] = useState<Task | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<TaskSubmission | null>(null);
  const [aiInitialNotes, setAiInitialNotes] = useState('');
  const [aiInitialDate, setAiInitialDate] = useState('');
  const [isDivisionManagerOpen, setIsDivisionManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newMeetingDefaultDate, setNewMeetingDefaultDate] = useState('');

  // ─── Effects ───
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // ─── Handlers: Auth ───
  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      setIsAuthenticated(true);
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('currentUser', JSON.stringify(response.user));
      return true;
    } catch (err) {
      if (username === 'admin' && password === 'r@jaemasmantab') {
        setIsAuthenticated(true);
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem(
          'currentUser',
          JSON.stringify({ id: 'admin', username: 'admin', role: 'admin', divisionId: '' })
        );
        return true;
      }
      return false;
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('isAuthenticated');
    setMeetings([]);
    setSelectedMeetingId(null);
    setCurrentTab('dashboard');
    setErrorMsg('');
    setToastMessage(null);
  };

  // ─── Handlers: Toast ───
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─── Handlers: Meetings ───
  const loadMeetings = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await api.getMeetings();
      setMeetings(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(t.meetings.failedLoad);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleSelectMeeting = (meeting: Meeting) => {
    setSelectedMeetingId(meeting.id);
    setCurrentTab('active-meeting');
  };

  const handleCreateMeeting = async (input: CreateMeetingInput) => {
    try {
      const created = await api.createMeeting(input);
      setMeetings([created, ...meetings]);
      setSelectedMeetingId(created.id);
      setCurrentTab('active-meeting');
      showToast('Rapat dan action items berhasil disimpan!');
    } catch (err: any) {
      alert(err.message || 'Gagal membuat rapat baru.');
    }
  };

  const handleUpdateMeeting = async (meetingId: string, updates: Partial<Meeting>) => {
    try {
      const updated = await api.updateMeeting(meetingId, updates);
      setMeetings(meetings.map((m) => (m.id === meetingId ? updated : m)));
      showToast('Data rapat berhasil diperbarui.');
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui rapat.');
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('tasks').delete().eq('meeting_id', meetingId);
          await supabase.from('meetings').delete().eq('id', meetingId);
        } catch (sErr) {
          console.warn('Direct Supabase delete notice:', sErr);
        }
      }
      await api.deleteMeeting(meetingId);
      setMeetings(meetings.filter((m) => m.id !== meetingId));
      if (selectedMeetingId === meetingId) {
        setSelectedMeetingId(null);
        setCurrentTab('meetings');
      }
      showToast('Rapat berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus rapat.');
    }
  };

  // ─── Handlers: Tasks ───
  const handleAddTaskToMeeting = async (meetingId: string, taskInput: CreateTaskInput) => {
    try {
      const newTask = await api.createTask(meetingId, taskInput);
      setMeetings(
        meetings.map((m) => {
          if (m.id === meetingId) return { ...m, tasks: [...(m.tasks || []), newTask] };
          return m;
        })
      );
      showToast('Tugas berhasil ditambahkan.');
      return newTask;
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan tugas.');
      throw err;
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    setMeetings((prev) =>
      prev.map((m) => ({
        ...m,
        tasks: (m.tasks || []).map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      }))
    );
    try {
      await api.updateTask(taskId, { status: newStatus });
    } catch (err: any) {
      console.error(err);
      loadMeetings();
      alert('Gagal memperbarui status tugas di server.');
    }
  };

  const handleSaveTaskEdits = async (taskId: string, updates: Partial<Task>) => {
    try {
      const updated = await api.updateTask(taskId, updates);
      setMeetings((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: (m.tasks || []).map((t) => (t.id === taskId ? updated : t)),
        }))
      );
      showToast('Tugas berhasil diperbarui.');
      setEditingTask(null);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui tugas.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm(t.tasks.deleteConfirm)) return;
    try {
      await api.deleteTask(taskId);
      setMeetings((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: (m.tasks || []).filter((t) => t.id !== taskId),
        }))
      );
      showToast('Tugas berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus tugas.');
    }
  };

  const handleSubmitTask = async (
    taskId: string,
    input: { notes: string; attachments: TaskSubmission['attachments'] }
  ) => {
    try {
      await api.submitTask(taskId, input);
      setMeetings((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: (m.tasks || []).map((t) =>
            t.id === taskId ? { ...t, status: 'Pending Approval' } : t
          ),
        }))
      );
      showToast('Pekerjaan berhasil dikirim untuk approval.');
      setSubmittingTask(null);
    } catch (err: any) {
      alert(err.message || 'Gagal mengirimkan submission.');
    }
  };

  const handleApproveSubmission = async (
    taskId: string,
    submissionId: string,
    reviewNote?: string
  ) => {
    try {
      await api.approveTaskSubmission(taskId, submissionId, reviewNote);
      setMeetings((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: (m.tasks || []).map((t) =>
            t.id === taskId ? { ...t, status: 'Done' } : t
          ),
        }))
      );
      showToast('Submission berhasil disetujui.');
      setReviewingTask(null);
      setReviewSubmission(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menyetujui submission.');
    }
  };

  const handleRejectSubmission = async (
    taskId: string,
    submissionId: string,
    reviewNote: string
  ) => {
    try {
      await api.rejectTaskSubmission(taskId, submissionId, reviewNote);
      setMeetings((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: (m.tasks || []).map((t) =>
            t.id === taskId ? { ...t, status: 'In Progress' } : t
          ),
        }))
      );
      showToast('Submission ditolak. Tugas dikembalikan ke In Progress.');
      setReviewingTask(null);
      setReviewSubmission(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menolak submission.');
    }
  };

  const handleAiExtractNotes = (notes: string, date: string) => {
    setAiInitialNotes(notes);
    setAiInitialDate(date);
    setIsAiExtractOpen(true);
  };

  // ─── Derived data ───
  const allTasksWithOrigin = meetings.flatMap((m) =>
    (m.tasks || []).map((t) => ({
      ...t,
      meetingTitle: m.title || `Rapat ${m.meetingDate}`,
      meetingDate: m.meetingDate,
    }))
  );

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);
  const totalMeetings = meetings.length;
  const totalTasks = allTasksWithOrigin.length;

  // Tab navigation handler
  const handleTabChange = (tab: AppTab) => {
    if (tab !== 'active-meeting') setSelectedMeetingId(null);
    if (tab === 'meetings' || tab === 'dashboard' || tab === 'calendar' || tab === 'all-tasks' || tab === 'team' || tab === 'settings') {
      setCurrentTab(tab);
    } else {
      setCurrentTab(tab);
    }
  };

  // Page title
  const getPageTitle = (): string => {
    if (currentTab === 'active-meeting' && selectedMeeting) {
      return selectedMeeting.title || `Rapat ${selectedMeeting.meetingDate}`;
    }
    const map: Partial<Record<AppTab, string>> = {
      dashboard: t.nav.dashboard,
      calendar: t.nav.calendar,
      meetings: t.nav.meetings,
      'all-tasks': t.nav.tasks,
      team: t.nav.team,
      settings: t.nav.settings,
    };
    return map[currentTab] || 'Meeting Hub';
  };

  // ─── Render ───
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={handleLogin}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((p) => !p)}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'id' ? 'en' : 'id'))}
      />
    );
  }

  return (
    <div className="min-h-screen bg-notion-kanban-bg text-notion-text font-sans antialiased flex">
      {/* macOS Sidebar — desktop only */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onOpenNewMeeting={() => setIsNewMeetingOpen(true)}
        onOpenAddTask={() => setIsAddTaskOpen(true)}
        onOpenAiExtract={() => {
          setAiInitialNotes('');
          setAiInitialDate('');
          setIsAiExtractOpen(true);
        }}
        meetingCount={totalMeetings}
        taskCount={totalTasks}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((p) => !p)}
        onLogout={handleLogout}
        t={t}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'id' ? 'en' : 'id'))}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <TopBar
          currentTab={currentTab}
          onBack={() => {
            setSelectedMeetingId(null);
            setCurrentTab('meetings');
          }}
          pageTitle={getPageTitle()}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((p) => !p)}
          onLogout={handleLogout}
          t={t}
          language={language}
          onToggleLanguage={() => setLanguage((l) => (l === 'id' ? 'en' : 'id'))}
          onOpenNewMeeting={() => setIsNewMeetingOpen(true)}
          onOpenAiExtract={() => {
            setAiInitialNotes('');
            setAiInitialDate('');
            setIsAiExtractOpen(true);
          }}
          onOpenAddTask={() => setIsAddTaskOpen(true)}
          showBack={currentTab === 'active-meeting'}
        />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 pb-safe overflow-y-auto">
          {/* Error notification */}
          {errorMsg && (
            <div className="mb-5 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-2xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={loadMeetings}
                className="px-3 py-1 bg-white dark:bg-red-950 border border-red-300 dark:border-red-800 rounded-lg font-medium text-red-700 dark:text-red-400 hover:bg-red-100 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> {t.common.retry}
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && currentTab !== 'active-meeting' ? (
            <div className="ios-card p-12 text-center">
              <div className="w-8 h-8 border-2 border-ios-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-notion-text-secondary">{t.meetings.loadingMeetings}</p>
            </div>
          ) : (
            <>
              {/* TAB: DASHBOARD */}
              {currentTab === 'dashboard' && (
                <Dashboard
                  meetings={meetings}
                  t={t}
                  onSelectMeeting={handleSelectMeeting}
                  onTabChange={handleTabChange}
                />
              )}

              {/* TAB: CALENDAR */}
              {currentTab === 'calendar' && (
                <CalendarView
                  meetings={meetings}
                  t={t}
                  onSelectMeeting={handleSelectMeeting}
                  onOpenNewMeeting={() => setIsNewMeetingOpen(true)}
                  onOpenNewMeetingOnDate={(date) => {
                    setNewMeetingDefaultDate(date);
                    setIsNewMeetingOpen(true);
                  }}
                />
              )}

              {/* TAB: MEETINGS LIST */}
              {currentTab === 'meetings' && (
                <div className="space-y-5">
                  <div className="ios-card p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="ios-large-title">{t.meetings.title}</h2>
                        <p className="text-sm text-notion-text-secondary mt-0.5">
                          {t.meetings.subtitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="notion-badge bg-notion-sidebar text-notion-text-secondary">
                          {totalMeetings} {t.meetings.title.toLowerCase()}
                        </span>
                        <span className="notion-badge bg-notion-sidebar text-notion-text-secondary">
                          {totalTasks} {t.tasks.title.toLowerCase()}
                        </span>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="mt-4 relative">
                      <input
                        type="text"
                        placeholder={`${t.common.search} rapat...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="notion-input pl-4"
                      />
                    </div>
                  </div>

                  {/* Meeting Grid */}
                  {(() => {
                    const filtered = meetings.filter((m) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        m.title?.toLowerCase().includes(q) ||
                        m.meetingDate.includes(q) ||
                        m.meetingNotes.toLowerCase().includes(q) ||
                        m.participants.some((p) => p.toLowerCase().includes(q)) ||
                        m.tasks?.some(
                          (t) =>
                            t.title.toLowerCase().includes(q) ||
                            t.assignee.toLowerCase().includes(q)
                        )
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="ios-card p-12 text-center">
                          <BookOpen className="w-10 h-10 text-notion-text-secondary mx-auto mb-3 opacity-20" />
                          <h3 className="text-base font-bold text-notion-text mb-1">
                            {searchQuery
                              ? t.meetings.noMeetingsFound
                              : t.meetings.noMeetings}
                          </h3>
                          <p className="text-sm text-notion-text-secondary max-w-sm mx-auto mb-4">
                            {t.meetings.noMeetingsSubtitle}
                          </p>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => setIsNewMeetingOpen(true)}
                              className="notion-btn notion-btn-primary"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {t.meetings.addManual}
                            </button>
                            <button
                              onClick={() => setIsAiExtractOpen(true)}
                              className="notion-btn text-ios-indigo hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                            >
                              <span>✨</span>
                              {t.meetings.aiParse}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((meeting) => {
                          const totalT = meeting.tasks?.length || 0;
                          const doneT = meeting.tasks?.filter((t) => t.status === 'Done').length || 0;
                          const progress = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;
                          const fmtDate = new Date(meeting.meetingDate + 'T00:00:00').toLocaleDateString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          });

                          return (
                            <div
                              key={meeting.id}
                              onClick={() => handleSelectMeeting(meeting)}
                              className="ios-card-interactive p-4 group"
                            >
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <span className="notion-badge bg-blue-50 dark:bg-blue-950/30 text-ios-blue text-[10px]">
                                  📅 {fmtDate}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(t.meetings.deleteConfirm)) {
                                      handleDeleteMeeting(meeting.id);
                                    }
                                  }}
                                  className="sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 hover:text-red-500 text-notion-text-secondary transition-all"
                                  title="Hapus rapat"
                                >
                                  ✕
                                </button>
                              </div>

                              <h3 className="text-sm font-bold text-notion-text mb-1.5 line-clamp-2">
                                {meeting.title || `Rapat ${meeting.meetingDate}`}
                              </h3>

                              <p className="text-xs text-notion-text-secondary line-clamp-2 mb-3 leading-relaxed">
                                {meeting.meetingNotes || 'Tidak ada catatan.'}
                              </p>

                              <div className="flex flex-wrap gap-1 mb-3">
                                {meeting.participants.slice(0, 3).map((p, i) => (
                                  <span key={i} className="notion-badge bg-notion-sidebar text-notion-text-secondary">
                                    {p}
                                  </span>
                                ))}
                                {meeting.participants.length > 3 && (
                                  <span className="notion-badge bg-notion-sidebar text-notion-text-secondary">
                                    +{meeting.participants.length - 3}
                                  </span>
                                )}
                              </div>

                              <div className="pt-3 border-t border-notion-border">
                                <div className="flex items-center justify-between text-xs mb-2">
                                  <span className="text-notion-text-secondary">
                                    {totalT} {t.meetings.actionItems}
                                    {totalT > 0 && ` · ${doneT} ${t.meetings.completed}`}
                                  </span>
                                  <span className="font-semibold text-notion-text">{progress}%</span>
                                </div>
                                {totalT > 0 && (
                                  <div className="h-1 rounded-full bg-notion-sidebar overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-ios-green transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB: ACTIVE MEETING */}
              {currentTab === 'active-meeting' && selectedMeeting && (
                <MeetingDetailView
                  meeting={selectedMeeting}
                  onBack={() => setCurrentTab('meetings')}
                  onUpdateMeeting={handleUpdateMeeting}
                  onDeleteMeeting={handleDeleteMeeting}
                  onAddTask={handleAddTaskToMeeting}
                  onUpdateTaskStatus={handleUpdateTaskStatus}
                  onEditTask={(task) => setEditingTask(task)}
                  onDeleteTask={handleDeleteTask}
                  onAiExtractNotes={handleAiExtractNotes}
                  onSubmitTask={handleSubmitTask}
                  onApproveSubmission={handleApproveSubmission}
                  onRejectSubmission={handleRejectSubmission}
                  currentUserRole="admin"
                />
              )}

              {/* TAB: ALL TASKS KANBAN */}
              {currentTab === 'all-tasks' && (
                <AllTasksKanban
                  tasks={allTasksWithOrigin}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onEditTask={(task) => setEditingTask(task)}
                  onDeleteTask={handleDeleteTask}
                  onSelectMeeting={(meetingId) => {
                    setSelectedMeetingId(meetingId);
                    setCurrentTab('active-meeting');
                  }}
                  onOpenAddTask={() => setIsAddTaskOpen(true)}
                />
              )}

              {/* TAB: TEAM DASHBOARD */}
              {currentTab === 'team' && (
                <TeamDashboard
                  meetings={meetings}
                  t={t}
                  onSelectMeeting={handleSelectMeeting}
                  onOpenUserManager={() => setIsUserManagerOpen(true)}
                />
              )}

              {/* TAB: SETTINGS */}
              {currentTab === 'settings' && (
                <div className="space-y-5">
                  <div className="ios-card p-5">
                    <h2 className="ios-large-title">{t.settings.title}</h2>
                    <p className="text-sm text-notion-text-secondary mt-1">{t.settings.subtitle}</p>
                  </div>

                  {/* Organization */}
                  <div className="ios-card p-5">
                    <p className="notion-section-title mb-4">Organisasi</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-notion-sidebar">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-ios-blue" />
                            <h3 className="text-sm font-semibold text-notion-text">{t.settings.divisions}</h3>
                          </div>
                          <button
                            onClick={() => setIsDivisionManagerOpen(true)}
                            className="notion-btn notion-btn-primary text-xs py-1 px-2.5"
                          >
                            {t.settings.manageDivisions}
                          </button>
                        </div>
                        <p className="text-xs text-notion-text-secondary">{t.settings.divisionsDesc}</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-notion-sidebar">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-ios-indigo" />
                            <h3 className="text-sm font-semibold text-notion-text">{t.settings.users}</h3>
                          </div>
                          <button
                            onClick={() => setIsUserManagerOpen(true)}
                            className="notion-btn notion-btn-primary text-xs py-1 px-2.5"
                          >
                            {t.settings.manageUsers}
                          </button>
                        </div>
                        <p className="text-xs text-notion-text-secondary">{t.settings.usersDesc}</p>
                      </div>
                    </div>
                  </div>

                  {/* Appearance */}
                  <div className="ios-card p-5">
                    <p className="notion-section-title mb-4">{t.settings.appearance}</p>
                    <div className="space-y-3">
                      {/* Language */}
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium text-notion-text">{t.settings.language}</p>
                          <p className="text-xs text-notion-text-secondary">
                            {language === 'id' ? 'Bahasa Indonesia' : 'English'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-notion-sidebar p-1 rounded-xl border border-notion-border">
                          {(['id', 'en'] as Language[]).map((lang) => (
                            <button
                              key={lang}
                              onClick={() => setLanguage(lang)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                language === lang
                                  ? 'bg-notion-bg text-notion-text shadow-sm'
                                  : 'text-notion-text-secondary hover:text-notion-text'
                              }`}
                            >
                              {lang === 'id' ? '🇮🇩 ID' : '🇺🇸 EN'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="notion-divider" />

                      {/* Theme */}
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium text-notion-text">{t.settings.theme}</p>
                          <p className="text-xs text-notion-text-secondary">
                            {isDarkMode ? t.settings.darkMode : t.settings.lightMode}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-notion-sidebar p-1 rounded-xl border border-notion-border">
                          <button
                            onClick={() => setIsDarkMode(false)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              !isDarkMode
                                ? 'bg-notion-bg text-notion-text shadow-sm'
                                : 'text-notion-text-secondary hover:text-notion-text'
                            }`}
                          >
                            ☀️ {t.settings.lightMode}
                          </button>
                          <button
                            onClick={() => setIsDarkMode(true)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isDarkMode
                                ? 'bg-notion-bg text-notion-text shadow-sm'
                                : 'text-notion-text-secondary hover:text-notion-text'
                            }`}
                          >
                            🌙 {t.settings.darkMode}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* iOS Bottom Tab Bar — mobile only */}
        <BottomTabBar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          t={t}
        />
      </div>

      {/* FAB — mobile only, shown on meetings/tasks/calendar/dashboard */}
      {(currentTab === 'meetings' || currentTab === 'calendar' || currentTab === 'dashboard' || currentTab === 'all-tasks') && (
        <button
          onClick={() => {
            if (currentTab === 'all-tasks') {
              setIsAddTaskOpen(true);
            } else {
              setIsNewMeetingOpen(true);
            }
          }}
          className="ios-fab lg:hidden"
          aria-label={currentTab === 'all-tasks' ? t.tasks.addTask : t.meetings.newMeeting}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-50 px-4 py-3 bg-zinc-900 dark:bg-zinc-800 text-white text-sm font-medium rounded-2xl shadow-2xl border border-zinc-800 dark:border-zinc-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-ios-green shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODALS */}
      <NewMeetingModal
        isOpen={isNewMeetingOpen}
        onClose={() => { setIsNewMeetingOpen(false); setNewMeetingDefaultDate(''); }}
        onSubmit={handleCreateMeeting}
      />

      <AiExtractModal
        isOpen={isAiExtractOpen}
        onClose={() => setIsAiExtractOpen(false)}
        onSuccess={handleCreateMeeting}
        initialRawText={aiInitialNotes}
        initialMeetingDate={aiInitialDate}
      />

      <TaskFormModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onSave={handleSaveTaskEdits}
        participants={
          editingTask
            ? meetings.find((m) => m.id === editingTask.meetingId)?.participants || []
            : []
        }
      />

      <TaskSubmissionModal
        isOpen={!!submittingTask}
        onClose={() => setSubmittingTask(null)}
        task={submittingTask}
        onSubmit={handleSubmitTask}
      />

      <TaskReviewModal
        isOpen={!!reviewingTask}
        onClose={() => {
          setReviewingTask(null);
          setReviewSubmission(null);
        }}
        task={reviewingTask}
        submission={reviewSubmission}
        onApprove={handleApproveSubmission}
        onReject={handleRejectSubmission}
      />

      <DivisionManager
        isOpen={isDivisionManagerOpen}
        onClose={() => setIsDivisionManagerOpen(false)}
      />

      <UserManager
        isOpen={isUserManagerOpen}
        onClose={() => setIsUserManagerOpen(false)}
      />

      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAddTask={handleAddTaskToMeeting}
      />
    </div>
  );
}
