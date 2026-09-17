import React, { useState, useEffect } from 'react';
import { Meeting, Task, TaskStatus, CreateTaskInput, TaskSubmission, Division, User } from '../types';
import { api } from '../api/client';
import { TaskItem } from './TaskItem';
import { TaskSubmissionModal } from './TaskSubmissionModal';
import { TaskReviewModal } from './TaskReviewModal';
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
  Filter
} from 'lucide-react';

interface MeetingDetailViewProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdateMeeting: (meetingId: string, updates: Partial<Meeting>) => Promise<void>;
  onDeleteMeeting: (meetingId: string) => Promise<void>;
  onAddTask: (meetingId: string, taskInput: CreateTaskInput) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAiExtractNotes: (meetingNotes: string, meetingDate: string) => void;
  onSubmitTask: (taskId: string, input: { notes: string; attachments: TaskSubmission['attachments'] }) => Promise<TaskSubmission>;
  onApproveSubmission: (taskId: string, submissionId: string, reviewNote?: string) => Promise<Task>;
  onRejectSubmission: (taskId: string, submissionId: string, reviewNote: string) => Promise<Task>;
  currentUserRole?: 'admin' | 'user';
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
  currentUserRole = 'admin',
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isEditingMeeting, setIsEditingMeeting] = useState<boolean>(false);
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
  const [taskAssignee, setTaskAssignee] = useState(meeting.participants[0] || '');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('To Do');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [reviewingTask, setReviewingTask] = useState<Task | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<TaskSubmission | null>(null);

  const tasks = meeting.tasks || [];
  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const doneCount = tasks.filter((t) => t.status === 'Done').length;
  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length;
  const blockedCount = tasks.filter((t) => t.status === 'Blocked').length;
  const todoCount = tasks.filter((t) => t.status === 'To Do').length;
  const pendingApprovalCount = tasks.filter((t) => t.status === 'Pending Approval').length;
  const completionRate = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const handleOpenSubmit = (task: Task) => setSubmittingTask(task);

  const handleOpenReview = async (task: Task) => {
    try {
      const submissions = await api.getTaskSubmissions(task.id);
      const latest = submissions[0];
      if (latest) {
        setReviewSubmission(latest);
        setReviewingTask(task);
      }
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
        assignee: taskAssignee || meeting.participants[0] || 'Unassigned',
        dueDate: taskDueDate,
        status: taskStatus,
      });
      setTaskTitle('');
      setIsAddingTask(false);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  return (
    <div className="notion-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-notion-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md p-1.5 text-notion-text-secondary hover:bg-notion-hover"
            title="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="notion-page-title">
              {meeting.title || `Rapat ${meeting.meetingDate}`}
            </h1>
            <p className="text-xs text-notion-text-secondary mt-0.5">
              {new Date(meeting.meetingDate).toLocaleDateString('id-ID', {
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
                className="notion-btn notion-btn-ghost text-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => {
                  if (confirm('Hapus rapat ini dan seluruh tugas/action item yang terhubung?')) {
                    onDeleteMeeting(meeting.id);
                  }
                }}
                className="notion-btn text-xs text-notion-danger hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hapus</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveMeetingEdits}
                className="notion-btn notion-btn-primary text-xs"
              >
                <Check className="h-3.5 w-3.5" />
                Simpan
              </button>
              <button
                onClick={() => setIsEditingMeeting(false)}
                className="notion-btn notion-btn-ghost text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Batal
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
        {/* Left Column: Core Fields */}
        <div className="lg:col-span-5 space-y-4">
          {/* Meeting Date */}
          <div className="notion-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-notion-text-secondary" />
              <h3 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wide">
                Tanggal Rapat
              </h3>
            </div>
            {isEditingMeeting ? (
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="notion-input"
              />
            ) : (
              <p className="text-sm font-medium text-notion-text">{meeting.meetingDate}</p>
            )}
          </div>

          {/* Participants */}
          <div className="notion-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-notion-text-secondary" />
                <h3 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wide">
                  Peserta ({meeting.participants.length})
                </h3>
              </div>
              {!isEditingMeeting && (
                <button
                  onClick={() => setIsAddingParticipant(true)}
                  className="notion-btn notion-btn-ghost text-xs"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Tambah
                </button>
              )}
            </div>
            {isEditingMeeting ? (
              <div>
                <label className="text-[11px] text-notion-text-secondary block mb-1">
                  Pisahkan dengan koma:
                </label>
                <input
                  type="text"
                  value={editParticipants}
                  onChange={(e) => setEditParticipants(e.target.value)}
                  placeholder="Contoh: Budi, Siti, Alex"
                  className="notion-input"
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-notion-sidebar text-xs font-medium text-notion-text"
                      >
                        <span>{participant}</span>
                        {divName && (
                          <span className="text-[9px] text-notion-text-secondary bg-notion-bg px-1.5 py-0.5 rounded border border-notion-border">
                            {divName}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {isAddingParticipant && (
                  <div className="p-3 bg-notion-sidebar/60 border border-notion-border rounded-xl space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-notion-text">Tambah Peserta ke Rapat:</span>
                      <button
                        onClick={() => setIsAddingParticipant(false)}
                        className="text-notion-text-secondary hover:text-notion-text text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Quick add from registered users */}
                    {users.filter((u) => !meeting.participants.includes(u.username)).length > 0 && (
                      <div>
                        <span className="text-[10px] text-notion-text-secondary block mb-1">
                          Pilih pengguna terdaftar:
                        </span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-notion-bg border border-notion-border hover:border-ios-blue hover:text-ios-blue transition-all"
                              >
                                <span>+ {u.username}</span>
                                <span className="text-[9px] text-notion-text-secondary">
                                  ({getDivisionName(u.divisionId)})
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Manual input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Atau ketik nama peserta manual / tamu..."
                        value={newParticipantInput}
                        onChange={(e) => setNewParticipantInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddQuickParticipant();
                        }}
                        autoFocus
                        className="notion-input text-xs py-1.5"
                      />
                      <button
                        onClick={handleAddQuickParticipant}
                        className="notion-btn notion-btn-primary text-xs shrink-0 py-1.5"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Meeting Notes */}
          <div className="notion-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-notion-text-secondary" />
                <h3 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wide">
                  Catatan Notula
                </h3>
              </div>
              {!isEditingMeeting && (
                <button
                  onClick={() => onAiExtractNotes(meeting.meetingNotes, meeting.meetingDate)}
                  className="notion-btn text-xs text-notion-accent hover:bg-blue-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">AI Parse</span>
                </button>
              )}
            </div>
            {isEditingMeeting ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={12}
                className="notion-input font-mono text-xs"
                placeholder="Tuliskan poin-poin pembahasan rapat di sini..."
              />
            ) : (
              <div className="text-sm text-notion-text whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                {meeting.meetingNotes || 'Tidak ada catatan tertulis.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tasks */}
        <div className="lg:col-span-7 space-y-4">
          <div className="notion-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-notion-text-secondary" />
                <h3 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wide">
                  Action Items ({tasks.length})
                </h3>
              </div>
              <button
                onClick={() => setIsAddingTask(true)}
                className="notion-btn notion-btn-primary text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Action Item
              </button>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-notion-text-secondary mb-1">
                <span>Progres: {completionRate}%</span>
                <span>{doneCount}/{tasks.length} selesai</span>
              </div>
              <div className="h-1.5 rounded-full bg-notion-sidebar">
                <div
                  className="h-full rounded-full bg-notion-accent transition-all duration-300"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs border-b border-notion-border pb-2 mb-3">
              <Filter className="h-3 w-3 text-notion-text-secondary mr-1" />
              {[
                { id: 'all', label: `Semua (${tasks.length})` },
                { id: 'To Do', label: `To Do (${todoCount})` },
                { id: 'In Progress', label: `In Progress (${inProgressCount})` },
                { id: 'Pending Approval', label: `Pending (${pendingApprovalCount})` },
                { id: 'Done', label: `Done (${doneCount})` },
                { id: 'Blocked', label: `Blocked (${blockedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filterStatus === tab.id
                      ? 'bg-notion-hover text-notion-text'
                      : 'text-notion-text-secondary hover:bg-notion-hover'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-notion-text-secondary block mb-1">
                      PIC *
                    </label>
                    <select
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      className="notion-input"
                    >
                      <optgroup label="Peserta Rapat">
                        {meeting.participants.map((p, idx) => {
                          const matchedUser = users.find((u) => u.username === p);
                          const label = matchedUser
                            ? `${p} (${getDivisionName(matchedUser.divisionId)})`
                            : p;
                          return <option key={idx} value={p}>{label}</option>;
                        })}
                      </optgroup>
                      {users.filter((u) => !meeting.participants.includes(u.username)).length > 0 && (
                        <optgroup label="Pengguna Lainnya">
                          {users
                            .filter((u) => !meeting.participants.includes(u.username))
                            .map((u) => (
                              <option key={u.id} value={u.username}>
                                {u.username} ({getDivisionName(u.divisionId)})
                              </option>
                            ))}
                        </optgroup>
                      )}
                      <option value="Tim Gabungan">Tim Gabungan</option>
                    </select>
                  </div>

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
                      <option value="Done">Done</option>
                      <option value="Blocked">Blocked</option>
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
                filteredTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onStatusChange={onUpdateTaskStatus}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onOpenSubmit={currentUserRole === 'user' ? handleOpenSubmit : undefined}
                    onOpenReview={currentUserRole === 'admin' ? handleOpenReview : undefined}
                  />
                ))
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
        onSubmit={onSubmitTask}
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
    </div>
  );
};