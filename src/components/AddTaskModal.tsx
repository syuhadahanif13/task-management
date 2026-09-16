import React, { useState, useEffect } from 'react';
import { Meeting, Task, TaskStatus, Division, User } from '../types';
import { api } from '../api/client';
import { X, Plus, CheckSquare, Calendar, User as UserIcon, BookOpen } from 'lucide-react';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (meetingId: string, taskInput: { title: string; assignee: string; dueDate: string; status: TaskStatus }) => Promise<Task>;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onAddTask }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        api.getMeetings(),
        api.getDivisions(),
        api.getUsers()
      ]).then(([meetingsData, divisionsData, usersData]) => {
        setMeetings(meetingsData);
        setDivisions(divisionsData);
        setUsers(usersData);
        if (meetingsData.length > 0) {
          setSelectedMeetingId(meetingsData[0].id);
        }
      }).catch((err) => {
        setErrorMsg(err.message || 'Gagal memuat data.');
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId || !title.trim() || !assignee.trim()) {
      setErrorMsg('Meeting, judul, dan PIC wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onAddTask(selectedMeetingId, {
        title: title.trim(),
        assignee: assignee.trim(),
        dueDate,
        status,
      });
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setAssignee('');
    setDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setStatus('To Do');
    setErrorMsg('');
    onClose();
  };

  if (!isOpen) return null;

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);
  const meetingParticipants = selectedMeeting?.participants || [];
  const userOptions = assignee ? users : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="notion-card w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-notion-border">
          <div>
            <h2 className="notion-page-title text-xl">Tambah Task</h2>
            <p className="text-xs text-notion-text-secondary mt-0.5">
              Tambah action item baru ke rapat yang dipilih.
            </p>
          </div>
          <button onClick={handleClose} className="notion-btn notion-btn-ghost text-xs">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-notion-text-secondary" />
              <span>Rapat *</span>
            </label>
            <select
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              className="notion-input"
            >
              <option value="">Pilih rapat...</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title || `Rapat ${m.meetingDate}`} - {m.meetingDate}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
              <CheckSquare className="w-3.5 h-3.5 text-notion-text-secondary" />
              <span>Judul Task *</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Buat draf kebijakan privasi..."
              className="notion-input"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
                <UserIcon className="w-3.5 h-3.5 text-notion-text-secondary" />
                <span>PIC / Assignee *</span>
              </label>
              <input
                type="text"
                list="assignee-list"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Nama penanggung jawab"
                className="notion-input"
              />
              <datalist id="assignee-list">
                {meetingParticipants.map((p, idx) => (
                  <option key={idx} value={p} />
                ))}
                {users.map((u) => (
                  <option key={u.id} value={u.username} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-notion-text-secondary" />
                <span>Tenggat Waktu *</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="notion-input font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-notion-text block mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="notion-input"
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
              <option value="Blocked">Blocked</option>
              <option value="Pending Approval">Pending Approval</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="notion-btn notion-btn-ghost text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="notion-btn notion-btn-primary text-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Tambah Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};