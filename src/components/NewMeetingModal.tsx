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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="notion-card w-full max-w-3xl my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-notion-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-notion-text">
              Buat Rapat & Notula Baru
            </h3>
            <p className="text-xs text-notion-text-secondary">
              Pencatatan data inti rapat dan penetapan action item tindak lanjut
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
              placeholder="Contoh: Rapat Evaluasi Sprint & Roadmap Q3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="notion-input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Meeting Date */}
            <div>
              <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-notion-text-secondary" />
                <span>1. Tanggal Rapat (Meeting Date) *</span>
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
              <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-notion-text-secondary" />
                <span>2. Peserta (Participants) *</span>
              </label>
              <input
                type="text"
                required
                placeholder="Pisahkan dengan koma: Budi, Siti, Alex"
                value={participantsText}
                onChange={(e) => setParticipantsText(e.target.value)}
                className="notion-input"
              />
              <span className="text-[10px] text-notion-text-secondary block mt-0.5">
                Nama peserta akan menjadi pilihan penanggung jawab (PIC) tugas.
              </span>
            </div>
          </div>

          {/* Meeting Notes */}
          <div>
            <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-notion-text-secondary" />
              <span>3. Catatan Notula Rapat (Meeting Notes/Minutes) *</span>
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
                <span>4. Tindak Lanjut / Tasks (Action Items)</span>
              </label>
              <button
                type="button"
                onClick={handleAddTaskRow}
                className="notion-btn text-xs text-notion-accent hover:bg-blue-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Baris Tugas
              </button>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {tasks.map((task, idx) => (
                <div
                  key={idx}
                  className="notion-card p-3 flex flex-col sm:flex-row items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Judul Action Item *"
                    value={task.title}
                    onChange={(e) => handleTaskChange(idx, 'title', e.target.value)}
                    className="flex-1 w-full notion-input"
                  />

                  <input
                    type="text"
                    placeholder="PIC / Assignee"
                    value={task.assignee}
                    onChange={(e) => handleTaskChange(idx, 'assignee', e.target.value)}
                    className="w-full sm:w-36 notion-input"
                  />

                  <input
                    type="date"
                    value={task.dueDate}
                    onChange={(e) => handleTaskChange(idx, 'dueDate', e.target.value)}
                    className="w-full sm:w-32 notion-input font-mono"
                  />

                  <select
                    value={task.status}
                    onChange={(e) => handleTaskChange(idx, 'status', e.target.value)}
                    className="w-full sm:w-28 notion-input"
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
                      className="p-1.5 text-notion-text-secondary hover:text-notion-danger rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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