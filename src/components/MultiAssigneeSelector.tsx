import React, { useState } from 'react';
import { User, X, Plus, Check } from 'lucide-react';
import { Division, User as UserType } from '../types';

interface MultiAssigneeSelectorProps {
  selectedAssignees: string[];
  onChange: (assignees: string[]) => void;
  participants?: string[];
  users?: Omit<UserType, 'password'>[];
  divisions?: Division[];
  placeholder?: string;
  label?: string;
}

export const MultiAssigneeSelector: React.FC<MultiAssigneeSelectorProps> = ({
  selectedAssignees,
  onChange,
  participants = [],
  users = [],
  divisions = [],
  placeholder = 'Ketik nama PIC lalu tekan Enter...',
  label = 'Penanggung Jawab (PIC / Assignees) *',
}) => {
  const [customInput, setCustomInput] = useState('');

  const handleToggle = (name: string) => {
    const clean = name.trim();
    if (!clean) return;

    if (selectedAssignees.includes(clean)) {
      onChange(selectedAssignees.filter((n) => n !== clean));
    } else {
      onChange([...selectedAssignees, clean]);
    }
  };

  const handleRemove = (name: string) => {
    onChange(selectedAssignees.filter((n) => n !== name));
  };

  const handleAddCustom = () => {
    if (!customInput.trim()) return;
    const newNames = customInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !selectedAssignees.includes(s));

    if (newNames.length > 0) {
      onChange([...selectedAssignees, ...newNames]);
    }
    setCustomInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  const getDivisionName = (divisionId?: string) => {
    if (!divisionId) return '';
    return divisions.find((d) => d.id === divisionId)?.name || '';
  };

  const otherUsers = users.filter((u) => !participants.includes(u.username));

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400" />
            <span>{label}</span>
          </span>
          <span className="text-[11px] font-normal text-gray-400 dark:text-zinc-500">
            {selectedAssignees.length} PIC dipilih
          </span>
        </label>
      )}

      {/* Selected Assignees Chips */}
      <div className="min-h-[44px] p-2 bg-white dark:bg-zinc-800/90 rounded-2xl border border-gray-200/80 dark:border-zinc-700 shadow-2xs flex flex-wrap items-center gap-1.5 transition-all">
        {selectedAssignees.length === 0 ? (
          <span className="text-xs text-gray-400 dark:text-zinc-500 px-2 py-1 italic">
            Belum ada PIC dipilih. Pilih peserta di bawah atau ketik nama.
          </span>
        ) : (
          selectedAssignees.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs group animate-in fade-in zoom-in-95 duration-150"
            >
              <span className="w-4 h-4 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 flex items-center justify-center text-[9px] font-bold">
                {name.charAt(0).toUpperCase()}
              </span>
              <span>{name}</span>
              <button
                type="button"
                onClick={() => handleRemove(name)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-indigo-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title={`Hapus ${name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Input to type custom / search name */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-white dark:bg-zinc-800/90 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white placeholder:text-gray-400 border border-gray-200/80 dark:border-zinc-700 focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customInput.trim()}
          className="px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Suggested Participants & Users Toggle Pills */}
      <div className="space-y-1.5 pt-1">
        {participants.length > 0 && (
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
              Peserta Rapat:
            </span>
            <div className="flex flex-wrap gap-1">
              {participants.map((p, idx) => {
                const isSelected = selectedAssignees.includes(p);
                return (
                  <button
                    key={`part-${idx}`}
                    type="button"
                    onClick={() => handleToggle(p)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : (
                      <Plus className="w-3 h-3 text-gray-400" />
                    )}
                    <span>{p}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {otherUsers.length > 0 && (
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
              Anggota Tim Lainnya:
            </span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {otherUsers.map((u) => {
                const isSelected = selectedAssignees.includes(u.username);
                const div = getDivisionName(u.divisionId);
                return (
                  <button
                    key={`user-${u.id}`}
                    type="button"
                    onClick={() => handleToggle(u.username)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-2.5 h-2.5 text-white" />
                    ) : (
                      <Plus className="w-2.5 h-2.5 text-gray-400" />
                    )}
                    <span>{u.username}</span>
                    {div && (
                      <span className={`text-[9px] ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>
                        ({div})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
