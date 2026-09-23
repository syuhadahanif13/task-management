import React, { useState, useEffect } from 'react';
import { Meeting, Task, TaskStatus, CreateTaskInput, TaskSubmission, Division, User } from '../types';
import { api } from '../api/client';
import { extractTaskSubmissionFromDescription } from '../utils/submissionUtils';
import { TaskItem } from './TaskItem';
import { TaskSubmissionModal } from './TaskSubmissionModal';
import { TaskReviewModal } from './TaskReviewModal';
import { TaskProofModal } from './TaskProofModal';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';
import { isTaskAssignedToUser } from '../utils/taskAccess';
import {
  ArrowLeft,
  Trash2,
  Edit3,
  Check,
  X,
  Plus,
  UserPlus,
  Sparkles,
  Calendar,
  Users,
  FileText,
  CheckSquare,
  Filter,
  User as UserIcon
} from 'lucide-react';

interface MeetingDetailViewProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdateMeeting: (id: string, updates: Partial<Meeting>) => Promise<void>;
  onDeleteMeeting: (id: string) => Promise<void>;
  onAddTask: (meetingId: string, taskInput: CreateTaskInput) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAiExtractNotes?: (notes: string, date: string) => void;
  onSubmitTask?: (taskId: string, input: { notes: string; attachments: TaskSubmission['attachments'] }) => Promise<void>;
  onApproveSubmission?: (taskId: string, submissionId: string, reviewNote?: string) => Promise<void>;
  onRejectSubmission?: (taskId: string, submissionId: string, reviewNote: string) => Promise<void>;
  onViewProof?: (task: Task) => void;
  currentUserRole?: 'admin' | 'user';
  currentUser?: { username: string; role?: string; divisionId?: string } | null;
}

export const MeetingDetailView: React.FC<MeetingDetailViewProps> = ({
  meeting,
  onBack,
  onUpdateMeeting,
  onDeleteMeeting,
  onAddTask,
  onUpdateTaskStatus,
  onEditTask,
  onDeleteTask,
  onAiExtractNotes,
  onSubmitTask,
  onApproveSubmission,
  onRejectSubmission,
  onViewProof,
  currentUserRole = 'admin',
  currentUser,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isEditingMeeting, setIsEditingMeeting] = useState<boolean>(false);
  const [viewingProofTask, setViewingProofTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState(meeting.title || '');
  const [editDate, setEditDate] = useState(meeting.meetingDate);
  const [editNotes, setEditNotes] = useState(meeting.meetingNotes);
  const [editParticipants, setEditParticipants] = useState(meeting.participants.join(', '));
  const [newParticipantInput, setNewParticipantInput] = useState('');
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);

  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getDivisions()])
      .then(([usersData, divisionsData]) => {
        setUsers(usersData);
        setDivisions(divisionsData);
      })
      .catch((err) => {
        console.warn('Gagal memuat pengguna / divisi:', err);
      });
  }, []);

  const getDivisionName = (divisionId: string) => {
    return divisions.find((d) => d.id === divisionId)?.name || 'Tanpa Divisi';
  };

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignees, setTaskAssignees] = useState<string[]>(() =>
    currentUserRole === 'user' && currentUser?.username ? [currentUser.username] : []
  );
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('To Do');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [scopeView, setScopeView] = useState<'my' | 'all'>(currentUserRole === 'user' ? 'my' : 'all');

  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [reviewingTask, setReviewingTask] = useState<Task | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<TaskSubmission | null>(null);

  const tasks = meeting.tasks || [];
  const myTasksCount = tasks.filter((t) => isTaskAssignedToUser(t, currentUser)).length;

  const scopedTasks = tasks.filter((t) => {
    if (currentUserRole === 'user' && scopeView === 'my') {
      return isTaskAssignedToUser(t, currentUser);
    }
    return true;
  });

  const filteredTasks = scopedTasks.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const doneCount = scopedTasks.filter((t) => t.status === 'Done').length;
  const inProgressCount = scopedTasks.filter((t) => t.status === 'In Progress').length;
  const todoCount = scopedTasks.filter((t) => t.status === 'To Do').length;
  const pendingApprovalCount = scopedTasks.filter((t) => t.status === 'Pending Approval').length;
  const completionRate = scopedTasks.length > 0 ? Math.round((doneCount / scopedTasks.length) * 100) : 0;

  const handleOpenSubmit = (task: Task) => setSubmittingTask(task);

  const handleOpenReview = async (task: Task) => {
    try {
      let submissions: TaskSubmission[] = [];
      try {
        submissions = await api.getTaskSubmissions(task.id, task.title);
      } catch (e) {
        console.warn('Failed to load submissions:', e);
      }

      if ((!submissions || submissions.length === 0 || !submissions.some(s => Array.isArray(s.attachments) && s.attachments.length > 0)) && task.description) {
        const emb = extractTaskSubmissionFromDescription(task.description);
        if (emb) {
          submissions = [emb, ...submissions];
        }
      }

      const withAtt = submissions.find(s => Array.isArray(s.attachments) && s.attachments.length > 0);
      const latest = withAtt || submissions[0];
      if (latest) {
        setReviewSubmission({
          ...latest,
          assignee: latest.assignee || task.assignee || 'User',
          notes: latest.notes || 'Pekerjaan telah diajukan dan menunggu review.',
          attachments: Array.isArray(latest.attachments) ? latest.attachments : [],
        });
      } else {
        setReviewSubmission({
          id: 'sub-placeholder-' + task.id,
          taskId: task.id,
          assignee: task.assignee || 'User',
          submittedAt: task.updatedAt || new Date().toISOString(),
          status: 'pending',
          notes: 'Pekerjaan telah diajukan dan menunggu review.',
          attachments: [],
        });
      }
      setReviewingTask(task);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  };

  const handleSaveMeetingEdits = async () => {
    const updatedParticipants = editParticipants
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    await onUpdateMeeting(meeting.id, {
      title: editTitle.trim(),
      meetingDate: editDate,
      meetingNotes: editNotes,
      participants: updatedParticipants.length > 0 ? updatedParticipants : meeting.participants,
    });
    setIsEditingMeeting(false);
  };

  const handleAddQuickParticipant = async () => {
    if (!newParticipantInput.trim()) return;
    const clean = newParticipantInput.trim();
    if (!meeting.participants.includes(clean)) {
      const updated = [...meeting.participants, clean];
      await onUpdateMeeting(meeting.id, { participants: updated });
    }
    setNewParticipantInput('');
    setIsAddingParticipant(false);
  };

  const handleQuickTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setIsSubmittingTask(true);
    try {
      await onAddTask(meeting.id, {
        title: taskTitle.trim(),
        assignee: taskAssignees.length > 0 ? taskAssignees.join(', ') : (meeting.participants[0] || 'Unassigned'),
        assignees: taskAssignees,
        dueDate: taskDueDate,
        status: taskStatus,
      });
      setTaskTitle('');
      setTaskAssignees([]);
      setIsAddingTask(false);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  return (
    <div className="bg-white/95 dark:bg-zinc-850 rounded-[32px] p-5 sm:p-7 border border-gray-200/70 dark:border-zinc-750 shadow-sm space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-gray-100 dark:border-zinc-800 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-gray-100/80 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-black hover:text-white transition active:scale-95 shadow-xs"
            title="Kembali"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              {meeting.title || `Rapat ${meeting.meetingDate}`}
            </h1>
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 mt-0.5">
              📅 {new Date(meeting.meetingDate).toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditingMeeting ? (
            <>
              <button
                onClick={() => {
                  setEditTitle(meeting.title || '');
                  setEditDate(meeting.meetingDate);
                  setEditNotes(meeting.meetingNotes);
                  setEditParticipants(meeting.participants.join(', '));
                  setIsEditingMeeting(true);
                }}
                className="px-4 py-2 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-800 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
              {currentUserRole === 'admin' && (
                <button
                  onClick={() => {
                    if (confirm('Hapus rapat ini dan seluruh tugas/action item yang terhubung?')) {
                      onDeleteMeeting(meeting.id);
                    }
                  }}
                  className="px-4 py-2 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hapus</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleSaveMeetingEdits}
                className="px-5 py-2 rounded-full bg-[#18191d] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Check className="h-3.5 w-3.5" />
                Simpan
              </button>
              <button
                onClick={() => setIsEditingMeeting(false)}
                className="px-4 py-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-xs font-bold hover:bg-gray-200 transition"
              >
                <X className="h-3.5 w-3.5" />
                Batal
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Core Fields */}
        <div className="lg:col-span-5 space-y-4">
          {/* Meeting Date */}
          <div className="bg-[#f8f9fa] dark:bg-zinc-800/60 rounded-[26px] p-5 border border-gray-200/50 dark:border-zinc-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-ios-blue" />
              <h3 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Tanggal Rapat
              </h3>
            </div>
            {isEditingMeeting ? (
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full bg-white dark:bg-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 dark:text-white border border-gray-200"
              />
            ) : (
              <p className="text-sm font-bold text-gray-900 dark:text-white">{meeting.meetingDate}</p>
            )}
          </div>

          {/* Participants */}
          <div className="bg-[#f8f9fa] dark:bg-zinc-800/60 rounded-[26px] p-5 border border-gray-200/50 dark:border-zinc-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Peserta ({meeting.participants.length})
                </h3>
              </div>
              {!isEditingMeeting && (
                <button
                  onClick={() => setIsAddingParticipant(true)}
                  className="px-3 py-1 rounded-full bg-white dark:bg-zinc-700 text-gray-800 dark:text-zinc-200 hover:bg-gray-100 text-xs font-bold border border-gray-200/60 shadow-xs inline-flex items-center gap-1"
                >
                  <UserPlus className="h-3 w-3" />
                  Tambah
                </button>
              )}
            </div>
            {isEditingMeeting ? (
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">
                  Pisahkan dengan koma:
                </label>
                <input
                  type="text"
                  value={editParticipants}
                  onChange={(e) => setEditParticipants(e.target.value)}
                  placeholder="Contoh: Budi, Siti, Alex"
                  className="w-full bg-white dark:bg-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 dark:text-white border border-gray-200"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {meeting.participants.map((participant, idx) => {
                    const matchedUser = users.find((u) => u.username === participant);
                    const divName = matchedUser ? getDivisionName(matchedUser.divisionId) : null;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-700/80 border border-gray-200/60 dark:border-zinc-600 text-xs font-bold text-gray-800 dark:text-zinc-200 shadow-2xs"
                      >
                        <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white text-[9px] flex items-center justify-center font-black">
                          {participant.charAt(0).toUpperCase()}
                        </span>
                        <span>{participant}</span>
                        {divName && (
                          <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                            {divName}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {isAddingParticipant && (
                  <div className="p-3.5 bg-white dark:bg-zinc-750 border border-gray-200 dark:border-zinc-700 rounded-2xl space-y-2 pt-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 dark:text-white">Tambah Peserta:</span>
                      <button
                        onClick={() => setIsAddingParticipant(false)}
                        className="text-gray-400 hover:text-black text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    {users.filter((u) => !meeting.participants.includes(u.username)).length > 0 && (
                      <div>
                        <span className="text-[10px] text-gray-400 block mb-1">
                          Pilih pengguna terdaftar:
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {users
                            .filter((u) => !meeting.participants.includes(u.username))
                            .map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={async () => {
                                  const updated = [...meeting.participants, u.username];
                                  await onUpdateMeeting(meeting.id, { participants: updated });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-50 dark:bg-zinc-800 border border-gray-200/80 hover:border-black dark:hover:border-white transition-all"
                              >
                                <span>+ {u.username}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nama peserta baru..."
                        value={newParticipantInput}
                        onChange={(e) => setNewParticipantInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddQuickParticipant())}
                        className="flex-1 bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-1.5 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={handleAddQuickParticipant}
                        className="px-3 py-1.5 rounded-xl bg-[#18191d] text-white text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Meeting Notes */}
          <div className="bg-[#f8f9fa] dark:bg-zinc-800/60 rounded-[26px] p-5 border border-gray-200/50 dark:border-zinc-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Catatan Rapat
                </h3>
              </div>
              {!isEditingMeeting && onAiExtractNotes && (
                <button
                  onClick={() => onAiExtractNotes(meeting.meetingNotes, meeting.meetingDate)}
                  className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 hover:bg-indigo-100"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>AI Parse</span>
                </button>
              )}
            </div>
            {isEditingMeeting ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={10}
                className="w-full bg-white dark:bg-zinc-700/80 rounded-2xl p-3.5 text-xs text-gray-800 dark:text-white border border-gray-200 resize-none leading-relaxed"
                placeholder="Tuliskan poin-poin pembahasan rapat di sini..."
              />
            ) : (
              <div className="text-xs sm:text-sm text-gray-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                {meeting.meetingNotes || 'Tidak ada catatan tertulis.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tasks */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#f8f9fa] dark:bg-zinc-800/60 rounded-[28px] p-5 sm:p-6 border border-gray-200/50 dark:border-zinc-700/50">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-ios-blue" />
                <h3 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Action Items ({tasks.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {currentUserRole === 'user' && (
                  <div className="flex items-center bg-gray-200/80 dark:bg-zinc-700/80 p-0.5 rounded-full text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setScopeView('my')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        scopeView === 'my'
                          ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-xs'
                          : 'text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      Tugas Saya ({myTasksCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeView('all')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        scopeView === 'all'
                          ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-xs'
                          : 'text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      Semua ({tasks.length})
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#18191d] hover:bg-black text-white text-xs font-bold shadow-md transition active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Action Item
                </button>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-5 bg-white dark:bg-zinc-750 p-4 rounded-2xl border border-gray-200/60 dark:border-zinc-700/60">
              <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-zinc-300 mb-1.5">
                <span>Progres Tindak Lanjut</span>
                <span className="text-emerald-600 font-extrabold">{completionRate}% ({doneCount}/{tasks.length} selesai)</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#a3e635] transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            {/* Filter Tabs matching Dribbble style */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
              {[
                { id: 'all', label: `Semua`, count: tasks.length },
                { id: 'To Do', label: `To Do`, count: todoCount },
                { id: 'In Progress', label: `In Progress`, count: inProgressCount },
                { id: 'Pending Approval', label: `In Review`, count: pendingApprovalCount },
                { id: 'Done', label: `Done`, count: doneCount },
              ].map((tab) => {
                const isActive = filterStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilterStatus(tab.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#c5e848] text-gray-950 shadow-xs'
                        : 'bg-white dark:bg-zinc-750 text-gray-600 dark:text-zinc-400 border border-gray-200/60 dark:border-zinc-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      isActive ? 'bg-white text-black' : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Add Task Form */}
            {isAddingTask && (
              <form
                onSubmit={handleQuickTaskSubmit}
                className="notion-card p-4 mb-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-notion-text uppercase tracking-wide">
                    Tambah Action Item Baru
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="text-notion-text-secondary hover:text-notion-text"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-notion-text-secondary block mb-1">
                    Judul Tindakan *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Buat draf kebijakan privasi..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                    autoFocus
                    className="notion-input"
                  />
                </div>

                {/* Multi-PIC Selector */}
                <MultiAssigneeSelector
                  selectedAssignees={taskAssignees}
                  onChange={setTaskAssignees}
                  participants={meeting.participants}
                  users={users}
                  divisions={divisions}
                  label="PIC / Penanggung Jawab *"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

                  <div>
                    <label className="text-[11px] font-medium text-notion-text-secondary block mb-1">
                      Tenggat Waktu *
                    </label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      required
                      className="notion-input font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-notion-text-secondary block mb-1">
                      Status
                    </label>
                    <select
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                      className="notion-input"
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending Approval">Pending Approval</option>
                      <option value="Done">Done</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="notion-btn notion-btn-ghost text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTask || !taskTitle.trim()}
                    className="notion-btn notion-btn-primary text-xs"
                  >
                    {isSubmittingTask ? 'Menyimpan...' : 'Tambahkan'}
                  </button>
                </div>
              </form>
            )}

            {/* Tasks List */}
            <div className="space-y-2.5">
              {filteredTasks.length === 0 ? (
                <div className="notion-card p-8 text-center">
                  <CheckSquare className="w-8 h-8 text-notion-text-secondary mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-notion-text-secondary">
                    {filterStatus === 'all'
                      ? 'Belum ada action item untuk rapat ini.'
                      : `Tidak ada tugas dengan status "${filterStatus}".`}
                  </p>
                  <button
                    onClick={() => setIsAddingTask(true)}
                    className="mt-3 text-xs font-medium text-notion-accent hover:underline"
                  >
                    + Tambahkan tugas pertama
                  </button>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isMine = isTaskAssignedToUser(task, currentUser);
                  return (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onStatusChange={onUpdateTaskStatus}
                      onEdit={currentUserRole === 'admin' || isMine ? onEditTask : undefined}
                      onDelete={currentUserRole === 'admin' || isMine ? onDeleteTask : undefined}
                      onOpenSubmit={currentUserRole === 'user' && isMine ? handleOpenSubmit : undefined}
                      onOpenReview={currentUserRole === 'admin' ? handleOpenReview : undefined}
                      onViewProof={onViewProof || ((t) => setViewingProofTask(t))}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TaskSubmissionModal
        isOpen={!!submittingTask}
        onClose={() => setSubmittingTask(null)}
        task={submittingTask}
        onSubmit={async (taskId, input) => {
          if (onSubmitTask) {
            await onSubmitTask(taskId, input);
          }
          setSubmittingTask(null);
          return {
            id: 'sub-' + Date.now(),
            taskId,
            assignee: currentUser?.username || 'User',
            notes: input.notes,
            attachments: input.attachments,
            status: 'pending',
            submittedAt: new Date().toISOString(),
          };
        }}
      />

      <TaskReviewModal
        isOpen={!!reviewingTask && !!reviewSubmission}
        onClose={() => {
          setReviewingTask(null);
          setReviewSubmission(null);
        }}
        task={reviewingTask}
        submission={reviewSubmission}
        onApprove={onApproveSubmission}
        onReject={onRejectSubmission}
      />

      <TaskProofModal
        isOpen={!!viewingProofTask}
        onClose={() => setViewingProofTask(null)}
        task={viewingProofTask}
      />
    </div>
  );
};