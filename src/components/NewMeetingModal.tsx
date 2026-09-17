import React, { useState, useEffect } from 'react';
import { CreateMeetingInput, TaskStatus, Division, User } from '../types';
import { api } from '../api/client';
import {
  X,
  Calendar,
  Users,
  FileText,
  CheckSquare,
  Plus,
  Trash2,
  UserPlus,
  ChevronDown,
  Building,
  Check,
} from 'lucide-react';

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMeetingInput) => Promise<void>;
  initialData?: Partial<CreateMeetingInput>;
}

export const NewMeetingModal: React.FC<NewMeetingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState(initialData?.title || '');
  const [meetingDate, setMeetingDate] = useState(initialData?.meetingDate || todayStr);
  const [participants, setParticipants] = useState<string[]>(initialData?.participants || []);
  const [manualParticipantInput, setManualParticipantInput] = useState('');
  const [meetingNotes, setMeetingNotes] = useState(initialData?.meetingNotes || '');

  // Registered users & divisions
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);

  // Quick Create User inline state
  const [isQuickUserOpen, setIsQuickUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123456');
  const [newUserDivisionId, setNewUserDivisionId] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [quickUserError, setQuickUserError] = useState('');

  const [tasks, setTasks] = useState<
    Array<{ title: string; assignee: string; dueDate: string; status: TaskStatus }>
  >(
    initialData?.tasks || [
      {
        title: '',
        assignee: '',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'To Do',
      },
    ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load registered users and divisions on modal open
  useEffect(() => {
    if (isOpen) {
      Promise.all([api.getUsers(), api.getDivisions()])
        .then(([usersData, divisionsData]) => {
          setUsers(usersData);
          setDivisions(divisionsData);
          if (divisionsData.length > 0 && !newUserDivisionId) {
            setNewUserDivisionId(divisionsData[0].id);
          }
        })
        .catch((err) => {
          console.warn('Gagal memuat pengguna / divisi:', err);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Add / remove participant chips
  const handleAddParticipant = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!participants.includes(trimmed)) {
      setParticipants([...participants, trimmed]);
    }
    setManualParticipantInput('');
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants(participants.filter((_, idx) => idx !== index));
  };

  // Quick Create User handler
  const handleQuickCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setQuickUserError('Nama pengguna wajib diisi.');
      return;
    }
    if (!newUserDivisionId) {
      setQuickUserError('Pilih divisi pengguna.');
      return;
    }

    setIsCreatingUser(true);
    setQuickUserError('');
    try {
      const created = await api.createUser({
        username: newUsername.trim(),
        password: newUserPassword || '123456',
        divisionId: newUserDivisionId,
        role: 'user',
      });

      // Update local users list
      setUsers((prev) => [...prev, created]);

      // Automatically add new user as participant
      handleAddParticipant(created.username);

      // Reset form
      setNewUsername('');
      setNewUserPassword('123456');
      setIsQuickUserOpen(false);
    } catch (err: any) {
      setQuickUserError(err.message || 'Gagal menambahkan pengguna.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Tasks row management
  const handleAddTaskRow = () => {
    setTasks([
      ...tasks,
      {
        title: '',
        assignee: participants[0] || '',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'To Do',
      },
    ]);
  };

  const handleRemoveTaskRow = (index: number) => {
    setTasks(tasks.filter((_, idx) => idx !== index));
  };

  const handleTaskChange = (index: number, field: string, value: any) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    setTasks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!meetingDate) {
      setErrorMsg('Tanggal Rapat (Meeting Date) wajib diisi.');
      return;
    }
    if (participants.length === 0) {
      setErrorMsg('Peserta (Participants) minimal 1 orang. Tambahkan dari pengguna atau input manual.');
      return;
    }
    if (!meetingNotes.trim()) {
      setErrorMsg('Catatan Notula Rapat (Meeting Notes) wajib diisi.');
      return;
    }

    const validTasks = tasks.filter((t) => t.title.trim().length > 0);

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim() || `Rapat ${meetingDate}`,
        meetingDate,
        participants,
        meetingNotes: meetingNotes.trim(),
        tasks: validTasks,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan rapat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDivisionName = (divisionId: string) => {
    return divisions.find((d) => d.id === divisionId)?.name || 'Tanpa Divisi';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="notion-card w-full max-w-3xl my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-notion-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-notion-text">Buat Rapat & Notula Baru</h3>
            <p className="text-xs text-notion-text-secondary">
              Pencatatan data rapat, integrasi pengguna/divisi, dan penetapan action items
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-notion-text-secondary hover:bg-notion-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Meeting Title */}
          <div>
            <label className="text-xs font-semibold text-notion-text block mb-1">
              Topik / Judul Rapat (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Rapat Koordinasi Antar Divisi Q3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="notion-input"
            />
          </div>

          {/* Date & Participants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Meeting Date */}
            <div>
              <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-notion-text-secondary" />
                <span>Tanggal Rapat *</span>
              </label>
              <input
                type="date"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="notion-input font-mono"
              />
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-notion-text-secondary" />
                  <span>Peserta Rapat ({participants.length}) *</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsUserPickerOpen(!isUserPickerOpen)}
                    className="notion-btn notion-btn-ghost text-xs px-2 py-0.5 text-ios-blue font-medium"
                  >
                    <Users className="w-3 h-3" />
                    <span>Pilih Pengguna</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQuickUserOpen(!isQuickUserOpen)}
                    className="notion-btn notion-btn-ghost text-xs px-2 py-0.5 text-ios-indigo font-medium"
                    title="Buat Pengguna Baru"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ User</span>
                  </button>
                </div>
              </div>

              {/* Quick Create User Inline Form */}
              {isQuickUserOpen && (
                <div className="mb-2.5 p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ios-indigo flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" />
                      Tambah Pengguna & Divisi Baru
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsQuickUserOpen(false)}
                      className="text-notion-text-secondary hover:text-notion-text p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {quickUserError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">{quickUserError}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Username / Nama Karyawan"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="notion-input text-xs py-1.5"
                    />
                    <select
                      value={newUserDivisionId}
                      onChange={(e) => setNewUserDivisionId(e.target.value)}
                      className="notion-input text-xs py-1.5"
                    >
                      <option value="">Pilih Divisi...</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleQuickCreateUser}
                      disabled={isCreatingUser}
                      className="notion-btn notion-btn-primary text-xs py-1 px-3"
                    >
                      {isCreatingUser ? 'Menyimpan...' : 'Simpan & Tambah ke Rapat'}
                    </button>
                  </div>
                </div>
              )}

              {/* User Dropdown Picker */}
              {isUserPickerOpen && (
                <div className="mb-2.5 p-2 bg-notion-bg border border-notion-border rounded-xl shadow-lg max-h-48 overflow-y-auto space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-notion-text-secondary border-b border-notion-border mb-1">
                    <span>Klik pengguna untuk menambahkan:</span>
                    <button
                      type="button"
                      onClick={() => setIsUserPickerOpen(false)}
                      className="hover:text-notion-text"
                    >
                      ✕
                    </button>
                  </div>
                  {users.length === 0 ? (
                    <p className="p-2 text-xs text-notion-text-secondary text-center">
                      Belum ada pengguna terdaftar. Klik '+ User' di atas untuk menambah.
                    </p>
                  ) : (
                    users.map((u) => {
                      const isSelected = participants.includes(u.username);
                      const divName = getDivisionName(u.divisionId);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setParticipants(participants.filter((p) => p !== u.username));
                            } else {
                              handleAddParticipant(u.username);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/30 text-ios-blue font-semibold'
                              : 'hover:bg-notion-hover text-notion-text'
                          }`}
                        >
                          <span className="truncate">{u.username}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-notion-text-secondary bg-notion-sidebar px-1.5 py-0.5 rounded-md">
                              {divName}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-ios-blue" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Selected Participants Chips */}
              <div className="min-h-[42px] p-2 bg-notion-sidebar/50 border border-notion-border rounded-xl flex flex-wrap gap-1.5 items-center mb-2">
                {participants.length === 0 ? (
                  <span className="text-xs text-notion-text-secondary italic">
                    Belum ada peserta dipilih.
                  </span>
                ) : (
                  participants.map((p, idx) => {
                    const matchedUser = users.find((u) => u.username === p);
                    const divName = matchedUser ? getDivisionName(matchedUser.divisionId) : null;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-notion-bg border border-notion-border text-xs font-medium text-notion-text shadow-2xs"
                      >
                        <span>{p}</span>
                        {divName && (
                          <span className="text-[9px] font-normal text-notion-text-secondary bg-notion-sidebar px-1 py-0.2 rounded">
                            {divName}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(idx)}
                          className="text-notion-text-secondary hover:text-red-500 transition-colors ml-0.5"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })
                )}
              </div>

              {/* Manual input for external guests */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Atau ketik nama peserta tamu / eksternal..."
                  value={manualParticipantInput}
                  onChange={(e) => setManualParticipantInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddParticipant(manualParticipantInput);
                    }
                  }}
                  className="notion-input text-xs py-1.5 flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleAddParticipant(manualParticipantInput)}
                  className="notion-btn notion-btn-ghost text-xs px-3 py-1.5 border border-notion-border shrink-0"
                >
                  <Plus className="w-3 h-3" /> Tambah
                </button>
              </div>
            </div>
          </div>

          {/* Meeting Notes */}
          <div>
            <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-notion-text-secondary" />
              <span>Catatan Notula Rapat (Meeting Notes/Minutes) *</span>
            </label>
            <textarea
              required
              rows={5}
              placeholder="Tuliskan poin-poin pembahasan, hasil keputusan, dan konteks diskusi..."
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              className="notion-input leading-relaxed"
            />
          </div>

          {/* Tasks Builder */}
          <div className="pt-2 border-t border-notion-border">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-notion-text-secondary" />
                <span>Tindak Lanjut / Action Items (Tugas)</span>
              </label>
              <button
                type="button"
                onClick={handleAddTaskRow}
                className="notion-btn text-xs text-ios-blue hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Baris Tugas
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {tasks.map((task, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-notion-sidebar/60 border border-notion-border rounded-xl space-y-2 transition-all focus-within:border-ios-blue/40 focus-within:bg-notion-bg"
                >
                  {/* Row 1: Full-width Task Title */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-notion-text-secondary shrink-0 w-6 text-center">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      placeholder="Tuliskan judul tugas / action item..."
                      value={task.title}
                      onChange={(e) => handleTaskChange(idx, 'title', e.target.value)}
                      className="w-full notion-input text-sm py-2 px-3 bg-notion-bg font-medium"
                    />
                    {tasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTaskRow(idx)}
                        className="p-1.5 text-notion-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors shrink-0"
                        title="Hapus tugas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Row 2: Proportional Metadata (PIC, Due Date, Status) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-8">
                    {/* PIC / Assignee */}
                    <div>
                      <input
                        type="text"
                        list={`assignee-options-${idx}`}
                        placeholder="Pilih PIC / Penanggung jawab"
                        value={task.assignee}
                        onChange={(e) => handleTaskChange(idx, 'assignee', e.target.value)}
                        className="w-full notion-input text-xs py-1.5 bg-notion-bg"
                      />
                      <datalist id={`assignee-options-${idx}`}>
                        {participants.map((p, pIdx) => {
                          const matched = users.find((u) => u.username === p);
                          const label = matched ? `${p} (${getDivisionName(matched.divisionId)})` : p;
                          return <option key={`part-${pIdx}`} value={p}>{label}</option>;
                        })}
                        {users
                          .filter((u) => !participants.includes(u.username))
                          .map((u) => (
                            <option key={u.id} value={u.username}>
                              {u.username} ({getDivisionName(u.divisionId)})
                            </option>
                          ))}
                      </datalist>
                    </div>

                    {/* Due Date */}
                    <div>
                      <input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) => handleTaskChange(idx, 'dueDate', e.target.value)}
                        className="w-full notion-input font-mono text-xs py-1.5 bg-notion-bg"
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <select
                        value={task.status}
                        onChange={(e) => handleTaskChange(idx, 'status', e.target.value)}
                        className="w-full notion-input text-xs py-1.5 bg-notion-bg"
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending Approval">Pending Approval</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-notion-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="notion-btn notion-btn-ghost text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="notion-btn notion-btn-primary text-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Rapat & Tugas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};