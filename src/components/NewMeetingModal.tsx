import React, { useState } from 'react';
import { CreateMeetingInput, TaskStatus } from '../types';
import { X, Calendar, Users, FileText, CheckSquare, Plus, Trash2 } from 'lucide-react';

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
  const [participantsText, setParticipantsText] = useState(
    initialData?.participants ? initialData.participants.join(', ') : ''
  );
  const [meetingNotes, setMeetingNotes] = useState(initialData?.meetingNotes || '');

  // Dynamic initial action items
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

  if (!isOpen) return null;

  const handleAddTaskRow = () => {
    const participantsList = participantsText
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    setTasks([
      ...tasks,
      {
        title: '',
        assignee: participantsList[0] || '',
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

    const parsedParticipants = participantsText
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (!meetingDate) {
      setErrorMsg('Field 1: Tanggal Rapat (Meeting Date) wajib diisi.');
      return;
    }
    if (parsedParticipants.length === 0) {
      setErrorMsg('Field 2: Peserta (Participants) minimal 1 orang.');
      return;
    }
    if (!meetingNotes.trim()) {
      setErrorMsg('Field 3: Catatan Notula Rapat (Meeting Notes) wajib diisi.');
      return;
    }

    // Filter out completely blank tasks
    const validTasks = tasks.filter((t) => t.title.trim().length > 0);

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim() || `Rapat ${meetingDate}`,
        meetingDate,
        participants: parsedParticipants,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl w-full max-w-3xl my-8 overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-850">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Buat Rapat & Notula Baru
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Pencatatan data inti rapat dan penetapan action item tindak lanjut
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Meeting Title / Topic */}
          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Topik / Judul Rapat (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Rapat Evaluasi Sprint & Roadmap Q3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CORE FIELD 1: Meeting Date (Tanggal Rapat) */}
            <div>
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>1. Tanggal Rapat (Meeting Date) *</span>
              </label>
              <input
                type="date"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
              />
            </div>

            {/* CORE FIELD 2: Participants (Peserta) */}
            <div>
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>2. Peserta (Participants) *</span>
              </label>
              <input
                type="text"
                required
                placeholder="Pisahkan dengan koma: Budi, Siti, Alex"
                value={participantsText}
                onChange={(e) => setParticipantsText(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5">
                Nama peserta akan menjadi pilihan penanggung jawab (PIC) tugas.
              </span>
            </div>
          </div>

          {/* CORE FIELD 3: Meeting Notes/Minutes (Catatan) */}
          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>3. Catatan Notula Rapat (Meeting Notes/Minutes) *</span>
            </label>
            <textarea
              required
              rows={5}
              placeholder="Tuliskan poin-poin pembahasan, hasil keputusan, dan konteks diskusi..."
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 leading-relaxed font-sans"
            />
          </div>

          {/* CORE FIELD 4: Tasks (Action Items) Builder (One-to-Many) */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>4. Tindak Lanjut / Tasks (Action Items)</span>
              </label>
              <button
                type="button"
                onClick={handleAddTaskRow}
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris Tugas</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {tasks.map((task, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-lg flex flex-col sm:flex-row items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Judul Action Item *"
                    value={task.title}
                    onChange={(e) => handleTaskChange(idx, 'title', e.target.value)}
                    className="flex-1 w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />

                  <input
                    type="text"
                    placeholder="PIC / Assignee"
                    value={task.assignee}
                    onChange={(e) => handleTaskChange(idx, 'assignee', e.target.value)}
                    className="w-full sm:w-36 px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />

                  <input
                    type="date"
                    value={task.dueDate}
                    onChange={(e) => handleTaskChange(idx, 'dueDate', e.target.value)}
                    className="w-full sm:w-32 px-2 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                  />

                  <select
                    value={task.status}
                    onChange={(e) => handleTaskChange(idx, 'status', e.target.value)}
                    className="w-full sm:w-28 px-2 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                    <option value="Blocked">Blocked</option>
                  </select>

                  {tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTaskRow(idx)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-xs transition-colors"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Rapat & Tugas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
