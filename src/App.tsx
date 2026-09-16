import React, { useState, useEffect } from 'react';
import { Meeting, Task, TaskStatus, CreateMeetingInput, CreateTaskInput } from './types';
import { api } from './api/client';
import { getSupabaseClient } from './lib/supabase';
import { Header } from './components/Header';
import { MeetingCard } from './components/MeetingCard';
import { MeetingDetailView } from './components/MeetingDetailView';
import { AllTasksKanban } from './components/AllTasksKanban';
import { NewMeetingModal } from './components/NewMeetingModal';
import { AiExtractModal } from './components/AiExtractModal';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskSubmissionModal } from './components/TaskSubmissionModal';
import { TaskReviewModal } from './components/TaskReviewModal';
import { LoginPage } from './components/LoginPage';
import {
  Calendar,
  CheckSquare,
  Sparkles,
  Plus,
  Search,
  Filter,
  Users,
  FileText,
  AlertCircle,
  Clock,
  Layers,
  Check,
  TrendingUp,
  RefreshCw,
  BookOpen,
  LogOut
} from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('isAuthenticated') === 'true';
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'meetings' | 'active-meeting' | 'all-tasks'>('meetings');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync dark class on <html> element and persist in localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  const handleLogin = (username: string, password: string) => {
    if (username === 'admin' && password === 'r@jaemasmantab') {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAuthenticated', 'true');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('isAuthenticated');
    setMeetings([]);
    setSelectedMeetingId(null);
    setCurrentTab('meetings');
    setErrorMsg('');
    setToastMessage(null);
  };

  // Modals
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [isAiExtractOpen, setIsAiExtractOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [reviewingTask, setReviewingTask] = useState<Task | null>(null);
  const [aiInitialNotes, setAiInitialNotes] = useState('');
  const [aiInitialDate, setAiInitialDate] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load initial meetings
  const loadMeetings = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await api.getMeetings();
      setMeetings(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal memuat data rapat dari server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  // Compute aggregated all-tasks for cross-meeting view
  const allTasksWithOrigin: Array<Task & { meetingTitle: string; meetingDate: string }> = [];
  for (const m of meetings) {
    for (const t of m.tasks || []) {
      allTasksWithOrigin.push({
        ...t,
        meetingTitle: m.title || `Rapat ${m.meetingDate}`,
        meetingDate: m.meetingDate,
      });
    }
  }

  // Selected meeting entity
  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);

  // Meeting Handlers
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
      // 1. Hapus dari Supabase via client jika kredensial aktif di browser
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('tasks').delete().eq('meeting_id', meetingId);
          await supabase.from('meetings').delete().eq('id', meetingId);
        } catch (sErr) {
          console.warn('Direct Supabase delete notice:', sErr);
        }
      }

      // 2. Hapus via backend API (yang juga menghapus di Supabase server-side)
      await api.deleteMeeting(meetingId);
      setMeetings(meetings.filter((m) => m.id !== meetingId));
      if (selectedMeetingId === meetingId) {
        setSelectedMeetingId(null);
        setCurrentTab('meetings');
      }
      showToast('Rapat dan data terkait di Supabase berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus rapat.');
    }
  };

  // Task Handlers (One-to-Many)
  const handleAddTaskToMeeting = async (meetingId: string, taskInput: CreateTaskInput) => {
    try {
      const newTask = await api.createTask(meetingId, taskInput);
      setMeetings(
        meetings.map((m) => {
          if (m.id === meetingId) {
            return {
              ...m,
              tasks: [...(m.tasks || []), newTask],
            };
          }
          return m;
        })
      );
      showToast('Action item berhasil ditambahkan ke rapat.');
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan action item.');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic UI update
    setMeetings((prevMeetings) =>
      prevMeetings.map((m) => ({
        ...m,
        tasks: (m.tasks || []).map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      }))
    );

    try {
      await api.updateTask(taskId, { status: newStatus });
    } catch (err: any) {
      console.error(err);
      loadMeetings(); // Revert on failure
      alert('Gagal memperbarui status tugas di server.');
    }
  };

  const handleSaveTaskEdits = async (taskId: string, updates: Partial<Task>) => {
    try {
      const updated = await api.updateTask(taskId, updates);
      setMeetings((prevMeetings) =>
        prevMeetings.map((m) => ({
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
    if (!confirm('Hapus action item ini?')) return;
    try {
      await api.deleteTask(taskId);
      setMeetings((prevMeetings) =>
        prevMeetings.map((m) => ({
          ...m,
          tasks: (m.tasks || []).filter((t) => t.id !== taskId),
        }))
      );
      showToast('Tugas berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus tugas.');
    }
  };

  const handleSubmitTask = async (taskId: string, input: { notes: string; attachments: TaskSubmission['attachments'] }) => {
    try {
      await api.submitTask(taskId, input);
      setMeetings((prevMeetings) =>
        prevMeetings.map((m) => ({
          ...m,
          tasks: (m.tasks || []).map((t) => (t.id === taskId ? { ...t, status: 'Pending Approval' } : t)),
        }))
      );
      showToast('Pekerjaan berhasil dikirim untuk approval.');
      setSubmittingTask(null);
    } catch (err: any) {
      alert(err.message || 'Gagal mengirimkan submission.');
    }
  };

  const handleApproveSubmission = async (taskId: string, submissionId: string, reviewNote?: string) => {
    try {
      await api.approveTaskSubmission(taskId, submissionId, reviewNote);
      setMeetings((prevMeetings) =>
        prevMeetings.map((m) => ({
          ...m,
          tasks: (m.tasks || []).map((t) => (t.id === taskId ? { ...t, status: 'Done' } : t)),
        }))
      );
      showToast('Submission berhasil disetujui.');
      setReviewingTask(null);
      setReviewSubmission(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menyetujui submission.');
    }
  };

  const handleRejectSubmission = async (taskId: string, submissionId: string, reviewNote: string) => {
    try {
      await api.rejectTaskSubmission(taskId, submissionId, reviewNote);
      setMeetings((prevMeetings) =>
        prevMeetings.map((m) => ({
          ...m,
          tasks: (m.tasks || []).map((t) => (t.id === taskId ? { ...t, status: 'In Progress' } : t)),
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

  // Filter meetings by search
  const filteredMeetings = meetings.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchTitle = m.title?.toLowerCase().includes(q);
    const matchDate = m.meetingDate.includes(q);
    const matchNotes = m.meetingNotes.toLowerCase().includes(q);
    const matchParticipants = m.participants.some((p) => p.toLowerCase().includes(q));
    const matchTasks = m.tasks?.some((t) => t.title.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q));
    return matchTitle || matchDate || matchNotes || matchParticipants || matchTasks;
  });

  // Calculate high-level stats
  const totalMeetings = meetings.length;
  const totalTasks = allTasksWithOrigin.length;
  const completedTasks = allTasksWithOrigin.filter((t) => t.status === 'Done').length;
  const overallCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const inProgressTasks = allTasksWithOrigin.filter((t) => t.status === 'In Progress').length;

  return (
    <>
      {!isAuthenticated ? (
        <LoginPage
          onLogin={handleLogin}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      ) : (
        <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased flex flex-col transition-colors">
          {/* Sticky Header */}
          <Header
            currentTab={currentTab}
            onTabChange={(tab) => {
              if (tab === 'meetings') setSelectedMeetingId(null);
              setCurrentTab(tab);
            }}
            onOpenNewMeeting={() => setIsNewMeetingOpen(true)}
            onOpenAiExtract={() => {
              setAiInitialNotes('');
              setAiInitialDate('');
              setIsAiExtractOpen(true);
            }}
            onOpenSupabaseModal={() => {}}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            meetingCount={totalMeetings}
            taskCount={totalTasks}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            onLogout={handleLogout}
          />

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Error notification if any */}
            {errorMsg && (
              <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  onClick={loadMeetings}
                  className="px-3 py-1 bg-white dark:bg-zinc-800 border border-rose-300 dark:border-rose-800 rounded font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-zinc-700 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Coba Lagi
                </button>
              </div>
            )}

            {/* TAB 1: MEETINGS LIST (DAFTAR RAPAT) */}
            {currentTab === 'meetings' && (
              <div className="space-y-6">
                {/* Top Metrics Hero / Summary Bar */}
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                        <span>Sistem Notula Terstruktur</span>
                      </div>
                      <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Daftar Rapat & Catatan Hasil (Meetings)
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Setiap rapat mengikat Tanggal Rapat, Peserta, Catatan Notula, dan Action Items secara relasional.
                      </p>
                    </div>

                    {/* Metric Badges */}
                    <div className="grid grid-cols-3 gap-2 text-center shrink-0">
                      <div className="px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                        <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 block">
                          Total Rapat
                        </span>
                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                          {totalMeetings}
                        </span>
                      </div>

                      <div className="px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                        <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 block">
                          Total Tasks
                        </span>
                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                          {totalTasks}
                        </span>
                      </div>

                      <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                        <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-300 block">
                          Penyelesaian
                        </span>
                        <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200 font-mono">
                          {overallCompletionRate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Core Fields Quick Legend */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">1. Tanggal Rapat</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">2. Peserta</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">3. Catatan Notula</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">4. Action Items</span>
                    </div>
                  </div>
                </div>

                {/* Meetings Grid */}
                {isLoading ? (
                  <div className="p-12 text-center">
                    <div className="w-8 h-8 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Memuat data rapat...</p>
                  </div>
                ) : filteredMeetings.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 transition-colors">
                    <Calendar className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                      {searchQuery ? 'Tidak ada rapat yang sesuai dengan pencarian' : 'Belum ada rapat terdaftar'}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
                      Mulai catat rapat baru secara manual atau gunakan AI untuk mengekstrak 4 data inti langsung dari teks notula.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setIsNewMeetingOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Rapat Manual</span>
                      </button>
                      <button
                        onClick={() => setIsAiExtractOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Ekstraksi Notula AI</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        onSelect={handleSelectMeeting}
                        onDelete={handleDeleteMeeting}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ACTIVE MEETING WORKBENCH */}
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

            {/* TAB 3: ALL TASKS KANBAN (CROSS-MEETING) */}
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
              />
            )}
          </main>

          {/* Floating Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-medium rounded-xl shadow-lg border border-zinc-800 dark:border-zinc-700 flex items-center gap-2 transition-all">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* MODALS */}
          {/* 1. New Meeting Modal */}
          <NewMeetingModal
            isOpen={isNewMeetingOpen}
            onClose={() => setIsNewMeetingOpen(false)}
            onSubmit={handleCreateMeeting}
          />

          {/* 2. AI Meeting Minutes Parser Modal */}
          <AiExtractModal
            isOpen={isAiExtractOpen}
            onClose={() => setIsAiExtractOpen(false)}
            onSuccess={handleCreateMeeting}
            initialRawText={aiInitialNotes}
            initialMeetingDate={aiInitialDate}
          />

          {/* 3. Edit Task Modal */}
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

          {/* 4. Task Submission Modal */}
          <TaskSubmissionModal
            isOpen={!!submittingTask}
            onClose={() => setSubmittingTask(null)}
            task={submittingTask}
            onSubmit={handleSubmitTask}
          />

          {/* 5. Task Review Modal */}
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
        </div>
      )}
    </>
  );
}
