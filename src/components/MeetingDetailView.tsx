import React, { useState } from 'react';
import { Meeting, Task, TaskStatus, CreateTaskInput } from '../types';
import { TaskItem } from './TaskItem';
import {
  Calendar,
  Users,
  FileText,
  CheckSquare,
  Plus,
  Sparkles,
  ArrowLeft,
  Trash2,
  Edit3,
  Check,
  X,
  AlertCircle,
  Filter,
  UserPlus
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
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isEditingMeeting, setIsEditingMeeting] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState(meeting.title || '');
  const [editDate, setEditDate] = useState(meeting.meetingDate);
  const [editNotes, setEditNotes] = useState(meeting.meetingNotes);
  const [editParticipants, setEditParticipants] = useState(meeting.participants.join(', '));
  const [newParticipantInput, setNewParticipantInput] = useState('');
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);

  // Quick inline add task form state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState(meeting.participants[0] || '');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('To Do');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Filter tasks
  const tasks = meeting.tasks || [];
  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const doneCount = tasks.filter((t) => t.status === 'Done').length;
  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length;
  const blockedCount = tasks.filter((t) => t.status === 'Blocked').length;
  const todoCount = tasks.filter((t) => t.status === 'To Do').length;
  const completionRate = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

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
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            id="meeting-detail-back-btn"
            onClick={onBack}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg shadow-xs transition-colors"
            title="Kembali ke Daftar Rapat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Detail Rapat & Action Items
            </span>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
              {meeting.title || `Rapat ${meeting.meetingDate}`}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditingMeeting ? (
            <>
              <button
                id="edit-meeting-btn"
                onClick={() => {
                  setEditTitle(meeting.title || '');
                  setEditDate(meeting.meetingDate);
                  setEditNotes(meeting.meetingNotes);
                  setEditParticipants(meeting.participants.join(', '));
                  setIsEditingMeeting(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-xs transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Rapat</span>
              </button>
              <button
                id="delete-meeting-btn"
                onClick={() => {
                  if (confirm('Hapus rapat ini dan seluruh tugas/action item yang terhubung?')) {
                    onDeleteMeeting(meeting.id);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveMeetingEdits}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xs transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </button>
              <button
                onClick={() => setIsEditingMeeting(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-xs transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Batal</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4 CORE DATA FIELDS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Core Fields 1, 2, 3 (Meeting Date, Participants, Notes) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* CORE FIELD 1: Meeting Date (Tanggal Rapat) */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    1. Meeting Date (Tanggal Rapat)
                  </h3>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Waktu pelaksanaan rapat</span>
                </div>
              </div>
            </div>

            {isEditingMeeting ? (
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full mt-2 px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            ) : (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {meeting.meetingDate}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  ({new Date(meeting.meetingDate).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })})
                </span>
              </div>
            )}
          </div>

          {/* CORE FIELD 2: Participants (Peserta) */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    2. Participants (Peserta)
                  </h3>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {meeting.participants.length} orang terdaftar
                  </span>
                </div>
              </div>

              {!isEditingMeeting && (
                <button
                  onClick={() => setIsAddingParticipant(true)}
                  className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              )}
            </div>

            {isEditingMeeting ? (
              <div className="mt-2">
                <label className="text-[11px] text-zinc-500 dark:text-zinc-400 block mb-1">
                  Pisahkan nama peserta dengan tanda koma:
                </label>
                <input
                  type="text"
                  value={editParticipants}
                  onChange={(e) => setEditParticipants(e.target.value)}
                  placeholder="Contoh: Budi, Siti, Alex"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {meeting.participants.map((participant, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
                      <span>{participant}</span>
                    </span>
                  ))}
                </div>

                {isAddingParticipant && (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nama peserta baru..."
                      value={newParticipantInput}
                      onChange={(e) => setNewParticipantInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddQuickParticipant();
                      }}
                      autoFocus
                      className="flex-1 px-2.5 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                    <button
                      onClick={handleAddQuickParticipant}
                      className="px-2.5 py-1 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => setIsAddingParticipant(false)}
                      className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CORE FIELD 3: Meeting Notes / Minutes (Catatan) */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    3. Meeting Notes/Minutes (Catatan)
                  </h3>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Ringkasan hasil notula rapat</span>
                </div>
              </div>

              {!isEditingMeeting && (
                <button
                  onClick={() => onAiExtractNotes(meeting.meetingNotes, meeting.meetingDate)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/60 rounded-md transition-colors"
                  title="Ekstrak Action Items otomatis menggunakan Gemini AI"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>AI Parse Action Items</span>
                </button>
              )}
            </div>

            {isEditingMeeting ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={12}
                className="w-full mt-2 p-3 text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 leading-relaxed"
                placeholder="Tuliskan poin-poin pembahasan rapat di sini..."
              />
            ) : (
              <div className="mt-3 p-3.5 bg-zinc-50/80 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-[380px] overflow-y-auto font-sans">
                {meeting.meetingNotes || 'Tidak ada catatan tertulis.'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Core Field 4: Tasks / Action Items (One-to-Many relationship) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Header & Metrics of Action Items */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    4. Tasks (Action Items)
                  </h3>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Relasi One-to-Many: {tasks.length} item terdaftar untuk rapat ini
                  </span>
                </div>
              </div>

              {/* Add task button */}
              <button
                id="add-task-to-meeting-btn"
                onClick={() => setIsAddingTask(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Action Item</span>
              </button>
            </div>

            {/* Progress Metrics Bar */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Progres Penyelesaian: {completionRate}%
                  </span>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    ({doneCount} selesai dari {tasks.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-zinc-600 dark:text-zinc-400">To Do: {todoCount}</span>
                  <span>•</span>
                  <span className="text-sky-600 dark:text-sky-400">In Progress: {inProgressCount}</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400">Blocked: {blockedCount}</span>
                </div>
              </div>

              <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(doneCount / (tasks.length || 1)) * 100}%` }}
                />
                <div
                  className="bg-sky-400 transition-all duration-300"
                  style={{ width: `${(inProgressCount / (tasks.length || 1)) * 100}%` }}
                />
                <div
                  className="bg-rose-400 transition-all duration-300"
                  style={{ width: `${(blockedCount / (tasks.length || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mt-4 flex items-center gap-1 overflow-x-auto text-xs border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <span className="text-zinc-400 dark:text-zinc-500 mr-2 flex items-center gap-1 text-[11px]">
                <Filter className="w-3 h-3" />
                Filter:
              </span>
              {[
                { id: 'all', label: `Semua (${tasks.length})` },
                { id: 'To Do', label: `To Do (${todoCount})` },
                { id: 'In Progress', label: `In Progress (${inProgressCount})` },
                { id: 'Done', label: `Done (${doneCount})` },
                { id: 'Blocked', label: `Blocked (${blockedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filterStatus === tab.id
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Inline Add Task Box */}
          {isAddingTask && (
            <form
              onSubmit={handleQuickTaskSubmit}
              className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl shadow-xs space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                  Tambah Tindak Lanjut Baru
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingTask(false)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Task Title (Judul Tindakan) */}
              <div>
                <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  Judul Tindakan (Action Item Title) *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Buat draf kebijakan privasi..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Assignee (Penanggung Jawab) */}
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    PIC (Peserta) *
                  </label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    {meeting.participants.map((p, idx) => (
                      <option key={idx} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value="Tim Gabungan">Tim Gabungan</option>
                  </select>
                </div>

                {/* Due Date (Tenggat Waktu) */}
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Tenggat Waktu *
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                  />
                </div>

                {/* Initial Status */}
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Status *
                  </label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask || !taskTitle.trim()}
                  className="px-3.5 py-1.5 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                >
                  {isSubmittingTask ? 'Menyimpan...' : 'Tambahkan Action Item'}
                </button>
              </div>
            </form>
          )}

          {/* Action Items List */}
          <div className="space-y-2.5">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 transition-colors">
                <CheckSquare className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {filterStatus === 'all'
                    ? 'Belum ada action item untuk rapat ini.'
                    : `Tidak ada tugas dengan status "${filterStatus}".`}
                </p>
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="mt-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
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
                />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
