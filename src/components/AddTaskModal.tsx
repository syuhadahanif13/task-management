import React, { useState, useEffect } from 'react';
import { Meeting, TaskStatus, TaskPriority, Division, User, CreateTaskInput } from '../types';
import { api } from '../api/client';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';
import {
  X,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Folder,
  User as UserIcon,
  Plus,
} from 'lucide-react';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (meetingId: string | undefined, taskInput: CreateTaskInput) => Promise<any>;
  currentUser?: { username: string; role?: string; divisionId?: string } | null;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onAddTask, currentUser }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [dueTime, setDueTime] = useState('10:00');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [tags, setTags] = useState<string[]>(['Work', 'Design']);
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (currentUser?.role === 'user' && currentUser?.username) {
        setAssignees([currentUser.username]);
      } else {
        setAssignees([]);
      }
      Promise.all([
        api.getMeetings(),
        api.getDivisions(),
        api.getUsers()
      ]).then(([meetingsData, divisionsData, usersData]) => {
        const realMeetings = meetingsData.filter((m) => m.id !== 'general-tasks');
        setMeetings(realMeetings);
        setDivisions(divisionsData);
        setUsers(usersData);
      }).catch((err) => {
        setErrorMsg(err.message || 'Gagal memuat data.');
      });
    }
  }, [isOpen, currentUser]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Task Title wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onAddTask(selectedMeetingId || undefined, {
        title: title.trim(),
        assignee: assignees.length > 0 ? assignees.join(', ') : 'Unassigned',
        assignees,
        dueDate,
        dueTime,
        status,
        priority,
        description: description.trim(),
        tags,
      });
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedMeetingId('');
    setTitle('');
    setDescription('');
    setAssignees(
      currentUser?.role === 'user' && currentUser?.username
        ? [currentUser.username]
        : []
    );
    setDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setDueTime('10:00');
    setPriority('Medium');
    setStatus('To Do');
    setTags(['Work', 'Design']);
    setErrorMsg('');
    setShowAddTag(false);
    onClose();
  };

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
      setShowAddTag(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  if (!isOpen) return null;

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);
  const meetingParticipants = selectedMeeting?.participants || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 transition-all">
      <div className="bg-[#f8f9fb] dark:bg-zinc-900 w-full sm:max-w-lg rounded-t-[36px] sm:rounded-[36px] p-6 sm:p-7 shadow-2xl border border-gray-100 dark:border-zinc-800 max-h-[92vh] overflow-y-auto">
        {/* ─── TOP BAR: X | Add New Task | Checkmark ─── */}
        <div className="flex items-center justify-between pb-5 border-b border-gray-200/60 dark:border-zinc-800">
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-gray-500 dark:text-zinc-300 shadow-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
            Add New Task
          </h2>

          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-gray-800 dark:text-white shadow-sm hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition"
            title="Submit"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3.5 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* ─── 1. Task Title ─── */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Finish landing page design"
              className="w-full bg-white dark:bg-zinc-800/90 rounded-2xl px-4 py-3.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200/80 dark:border-zinc-750 shadow-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition"
              autoFocus
            />
          </div>

          {/* ─── 2. Description ─── */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Design the new landing page for the product launch."
              className="w-full bg-white dark:bg-zinc-800/90 rounded-2xl p-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200/80 dark:border-zinc-750 shadow-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition resize-none"
            />
          </div>

          {/* ─── 3. Due Date & Time (Split Pills) ─── */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
              Due Date & time
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Date */}
              <div className="relative bg-white dark:bg-zinc-800/90 rounded-2xl px-3.5 py-3 border border-gray-200/80 dark:border-zinc-750 shadow-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-gray-800 dark:text-white focus:outline-none cursor-pointer"
                />
              </div>

              {/* Time */}
              <div className="relative bg-white dark:bg-zinc-800/90 rounded-2xl px-3.5 py-3 border border-gray-200/80 dark:border-zinc-750 shadow-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-gray-800 dark:text-white focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* ─── 4. Priority Selector Pills ─── */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  value: 'Low' as TaskPriority,
                  label: 'Low',
                  activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20',
                  inactiveClass: 'bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
                },
                {
                  value: 'Medium' as TaskPriority,
                  label: 'Medium',
                  activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20',
                  inactiveClass: 'bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
                },
                {
                  value: 'High' as TaskPriority,
                  label: 'High',
                  activeClass: 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20',
                  inactiveClass: 'bg-rose-50/60 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
                },
              ].map(({ value, label, activeClass, inactiveClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={`py-3 rounded-2xl text-xs font-bold border transition-all ${
                    priority === value ? activeClass : inactiveClass
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── 5. Project / Rapat Dropdown ─── */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
              Project
            </label>
            <div className="relative bg-white dark:bg-zinc-800/90 rounded-2xl px-4 py-3.5 border border-gray-200/80 dark:border-zinc-750 shadow-sm flex items-center gap-3">
              <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
              <select
                value={selectedMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-gray-800 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="">📁 General Tasks (Tugas Mandiri / Tanpa Rapat)</option>
                {meetings.filter((m) => m.id !== 'general-tasks' && !m.id.startsWith('system-')).map((m) => (
                  <option key={m.id} value={m.id}>
                    📁 {m.title || `Rapat ${m.meetingDate}`} ({m.meetingDate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ─── 6. PIC / Assignees (Multi-PIC) ─── */}
          <div>
            <MultiAssigneeSelector
              selectedAssignees={assignees}
              onChange={setAssignees}
              participants={meetingParticipants}
              users={users}
              divisions={divisions}
              label="PIC / Assignees"
            />
          </div>

          {/* ─── 7. Tags (Pill Badges) ─── */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-purple-950 dark:hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {showAddTag ? (
                <div className="inline-flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-full border border-gray-200 text-xs">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Tag..."
                    className="w-16 bg-transparent text-xs focus:outline-none"
                    autoFocus
                  />
                  <button type="button" onClick={handleAddTag} className="text-emerald-600 font-bold">
                    ✓
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddTag(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200/80 dark:border-zinc-700 hover:bg-gray-50"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              )}
            </div>
          </div>

          {/* ─── 8. Bottom Sticky Button: Create Task ─── */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-[#18191d] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-zinc-100 font-extrabold text-sm shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};