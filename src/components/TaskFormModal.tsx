import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, User as UserType, Division } from '../types';
import { X, CheckSquare, Calendar } from 'lucide-react';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';
import { api } from '../api/client';
import { extractTaskDescription, extractTaskSubmissionFromDescription, embedTaskSubmissionIntoDescription } from '../utils/submissionUtils';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (taskId: string, updates: Partial<Task>) => Promise<void>;
  participants?: string[];
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  participants = [],
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('Medium');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [users, setUsers] = useState<Omit<UserType, 'password'>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    if (isOpen) {
      Promise.all([api.getUsers(), api.getDivisions()])
        .then(([u, d]) => {
          setUsers(u);
          setDivisions(d);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(extractTaskDescription(task.description || ''));
      setPriority(task.priority || 'Medium');
      const initial = task.assignees && task.assignees.length > 0
        ? task.assignees
        : (task.assignee ? task.assignee.split(',').map((s) => s.trim()).filter(Boolean) : []);
      setAssignees(initial);
      setDueDate(task.dueDate);
      setStatus(task.status);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate.trim()) {
      setErrorMsg('Judul tindakan dan tenggat waktu wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const existingSub = extractTaskSubmissionFromDescription(task.description || '');
      const finalDescription = existingSub
        ? embedTaskSubmissionIntoDescription(description.trim(), existingSub)
        : description.trim();

      await onSave(task.id, {
        title: title.trim(),
        description: finalDescription,
        priority: priority as any,
        assignee: assignees.length > 0 ? assignees.join(', ') : 'Unassigned',
        assignees,
        dueDate: dueDate.trim(),
        status,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl w-full max-w-md overflow-hidden transition-colors">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-850">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Edit Tindak Lanjut (Task)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Action Item Title */}
          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Judul Tindakan (Action Item Title) *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="notion-input text-sm py-2 px-3"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Deskripsi (Opsional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Tambahkan detail catatan atau instruksi tugas..."
              className="notion-input text-xs py-2 px-3 resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Prioritas
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Low', 'Medium', 'High'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                    priority === p
                      ? p === 'High'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                        : p === 'Low'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                      : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee Multi-PIC Selector */}
          <MultiAssigneeSelector
            selectedAssignees={assignees}
            onChange={setAssignees}
            participants={participants}
            users={users}
            divisions={divisions}
            label="Penanggung Jawab (PIC / Assignees) *"
          />

          <div className="grid grid-cols-2 gap-3">
            {/* Due Date */}
            <div>
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Tenggat Waktu *</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="notion-input font-mono text-xs py-2 px-2.5"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="notion-input text-xs py-2 px-2.5"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Done">Done</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
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
              {isSubmitting ? 'Menyimpan...' : 'Perbarui Tugas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
