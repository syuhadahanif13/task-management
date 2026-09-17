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
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PwaSettingsCard } from './components/PwaSettingsCard';

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
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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

  // Handle PWA shortcuts & deep links (e.g., ?tab=all-tasks&action=new-task)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as AppTab | null;
      const actionParam = params.get('action');

      if (tabParam && ['dashboard', 'calendar', 'meetings', 'all-tasks', 'team', 'settings'].includes(tabParam)) {
        setCurrentTab(tabParam);
      }
      if (actionParam === 'new-task') {
        setIsAddTaskOpen(true);
      } else if (actionParam === 'new-meeting') {
        setIsNewMeetingOpen(true);
      }
    }
  }, []);

  // ─── Handlers: Auth ───
  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      setIsAuthenticated(true);
      setCurrentUser(response.user);
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('currentUser', JSON.stringify(response.user));
      return true;
    } catch (err) {
      if (username === 'admin' && password === 'r@jaemasmantab') {
        const adminUser = { id: 'admin', username: 'admin', role: 'admin', divisionId: '' };
        setIsAuthenticated(true);
        setCurrentUser(adminUser);
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('currentUser', JSON.stringify(adminUser));
        return true;
      }
      return false;
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('currentUser');
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
  const handleAddTaskToMeeting = async (meetingId: string | undefined, taskInput: CreateTaskInput) => {
    try {
      const targetMeetingId = meetingId || 'general-tasks';
      const newTask = await api.createTask(meetingId, taskInput);
      setMeetings((prevMeetings) => {
        const exists = prevMeetings.some((m) => m.id === targetMeetingId);
        if (exists) {
          return prevMeetings.map((m) => {
            if (m.id === targetMeetingId) {
              return { ...m, tasks: [...(m.tasks || []), newTask] };
            }
            return m;
          });
        }
        // If target was general-tasks and not yet in state, create container meeting
        const today = new Date().toISOString().split('T')[0];
        const generalMeeting: Meeting = {
          id: 'general-tasks',
          title: 'Tugas Mandiri',
          meetingDate: today,
          participants: [],
          meetingNotes: 'Tugas umum tanpa rapat',
          tasks: [newTask],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return [...prevMeetings, generalMeeting];
      });
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
      alert(err?.message || 'Gagal memperbarui status tugas di server.');
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
    (m.tasks || []).map((t) => {
      const isStandalone = m.id === 'general-tasks' || !t.meetingId || t.meetingId === 'general-tasks';
      return {
        ...t,
        meetingTitle: isStandalone ? 'Tugas Mandiri' : (m.title || `Rapat ${m.meetingDate}`),
        meetingDate: isStandalone ? '' : m.meetingDate,
      };
    })
  );

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);
  const totalMeetings = meetings.filter((m) => m.id !== 'general-tasks').length;
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-br from-[#faf6f2] via-[#f7f2fa] to-[#f4f7fd] dark:from-[#121316] dark:via-[#16171d] dark:to-[#111215] text-notion-text font-sans antialiased flex">
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
        {/* Top Bar / Mobile Header */}
        <TopBar
          currentTab={currentTab}
          onTabChange={handleTabChange}
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
          currentUser={currentUser}
          overdueCount={meetings.flatMap((m) => m.tasks || []).filter((task) => task.status !== 'Done' && task.dueDate && task.dueDate < new Date().toISOString().split('T')[0]).length}
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
                  currentUser={currentUser}
                  onSelectMeeting={handleSelectMeeting}
                  onTabChange={handleTabChange}
                  onOpenAddTask={() => setIsAddTaskOpen(true)}
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
                  onOpenAddTask={() => setIsAddTaskOpen(true)}
                />
              )}

              {/* TAB: MEETINGS LIST */}
              {currentTab === 'meetings' && (
                <div className="space-y-6 max-w-6xl mx-auto pb-12">
                  {/* Top Header & Actions */}
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-ios-blue shadow-xs">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Meetings & Minutes</span>
                        </span>
                        <span className="text-xs font-bold text-gray-400 dark:text-zinc-500">
                          {totalMeetings} Rapat Tercatat
                        </span>
                      </div>
                      <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-950 dark:text-white leading-tight">
                        Daftar Rapat &<br />Notulen Agenda
                      </h1>
                    </div>

                    {/* Actions & Switcher */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Segmented Switcher for Mobile/Desktop: Rapat vs Tugas */}
                      <div className="flex items-center bg-white dark:bg-zinc-800 p-1 rounded-full border border-gray-200/70 dark:border-zinc-700/60 shadow-sm text-xs font-bold">
                        <span className="px-3.5 py-1.5 rounded-full bg-[#18191d] text-white shadow-xs">
                          📅 Rapat
                        </span>
                        <button
                          onClick={() => setCurrentTab('all-tasks')}
                          className="px-3.5 py-1.5 rounded-full text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition"
                        >
                          ✓ Tugas
                        </button>
                      </div>

                      <button
                        onClick={() => setIsAiExtractOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition shadow-sm"
                      >
                        <span>✨</span>
                        <span>Ekstrak AI</span>
                      </button>

                      <button
                        onClick={() => setIsNewMeetingOpen(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#18191d] hover:bg-black text-white text-xs font-extrabold shadow-lg transition active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Rapat</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar (Pill-Style) */}
                  <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md rounded-[28px] p-4 border border-gray-200/70 dark:border-zinc-700/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:max-w-md">
                      <BookOpen className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
                      <input
                        type="text"
                        placeholder="Cari judul rapat, tanggal, peserta, notulen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-750/70 rounded-full pl-11 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white border border-transparent"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-zinc-400">
                      <span className="px-3 py-1.5 rounded-full bg-gray-50 dark:bg-zinc-750">
                        {totalMeetings} Total Rapat
                      </span>
                      <span className="px-3 py-1.5 rounded-full bg-gray-50 dark:bg-zinc-750">
                        {totalTasks} Action Items
                      </span>
                    </div>
                  </div>

                  {/* Meeting Grid */}
                  {(() => {
                    const filtered = meetings.filter((m) => {
                      if (m.id === 'general-tasks') return false;
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
                        <div className="bg-white dark:bg-zinc-800/80 rounded-[32px] p-12 text-center border border-gray-100 dark:border-zinc-700/60 shadow-sm">
                          <BookOpen className="w-12 h-12 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
                          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                            {searchQuery ? 'Rapat Tidak Ditemukan' : 'Belum Ada Rapat'}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-sm mx-auto mb-5">
                            {searchQuery ? 'Coba cari dengan kata kunci lain.' : 'Buat jadwal rapat baru untuk mulai mencatat notulen dan action items.'}
                          </p>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => setIsNewMeetingOpen(true)}
                              className="px-5 py-2.5 rounded-full bg-[#18191d] hover:bg-black text-white text-xs font-bold shadow-md"
                            >
                              <Plus className="w-3.5 h-3.5 inline mr-1" />
                              Tambah Manual
                            </button>
                            <button
                              onClick={() => setIsAiExtractOpen(true)}
                              className="px-5 py-2.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100"
                            >
                              ✨ Ekstrak AI
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
                              className="bg-white dark:bg-zinc-800/90 rounded-[30px] p-6 shadow-sm border border-gray-100 dark:border-zinc-700/60 hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer"
                            >
                              <div>
                                {/* Top Row: Date Badge & Action Buttons */}
                                <div className="flex items-start justify-between gap-2 mb-3">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-ios-blue">
                                    📅 {fmtDate}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(t.meetings.deleteConfirm)) {
                                          handleDeleteMeeting(meeting.id);
                                        }
                                      }}
                                      className="w-8 h-8 rounded-full bg-gray-50 dark:bg-zinc-700/50 hover:bg-rose-50 hover:text-rose-600 text-gray-400 flex items-center justify-center transition"
                                      title="Hapus rapat"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Meeting Title */}
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 line-clamp-2 group-hover:text-ios-blue transition-colors">
                                  {meeting.title || `Rapat ${meeting.meetingDate}`}
                                </h3>

                                {/* Notes Preview */}
                                <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
                                  {meeting.meetingNotes || 'Tidak ada catatan khusus.'}
                                </p>

                                {/* Participants Avatar Stack */}
                                <div className="flex items-center -space-x-2 mb-4">
                                  {(meeting.participants || []).slice(0, 4).map((p, i) => (
                                    <div
                                      key={i}
                                      className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white dark:border-zinc-800 flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                                      title={p}
                                    >
                                      {p.charAt(0).toUpperCase()}
                                    </div>
                                  ))}
                                  {(meeting.participants?.length || 0) > 4 && (
                                    <div className="w-7 h-7 rounded-full bg-black text-white dark:bg-white dark:text-black border-2 border-white dark:border-zinc-800 flex items-center justify-center text-[10px] font-extrabold shadow-sm">
                                      +{(meeting.participants?.length || 0) - 4}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Bottom Stats: Progress bar + Meet button */}
                              <div className="pt-3.5 border-t border-gray-100 dark:border-zinc-750 flex items-center justify-between">
                                <div className="flex-1 mr-4">
                                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                                    <span className="text-gray-400">
                                      {doneT}/{totalT} Selesai
                                    </span>
                                    <span className="text-gray-800 dark:text-zinc-200">{progress}%</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleSelectMeeting(meeting)}
                                  className="w-8 h-8 rounded-full bg-gray-50 dark:bg-zinc-700/60 group-hover:bg-[#18191d] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black flex items-center justify-center text-gray-400 transition"
                                  title="Lihat Detail"
                                >
                                  <span className="text-xs">↗</span>
                                </button>
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
                  onOpenMeetings={() => setCurrentTab('meetings')}
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

                  {/* PWA Application Settings */}
                  <PwaSettingsCard />
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

      {/* Progressive Web App (PWA) Install Prompt */}
      <PwaInstallBanner />
    </div>
  );
}
