import React, { useState, useEffect } from 'react';
import { Division, CreateDivisionInput } from '../types';
import { api } from '../api/client';
import { Plus, Trash2, Edit3, X, Check } from 'lucide-react';

interface DivisionManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DivisionManager: React.FC<DivisionManagerProps> = ({ isOpen, onClose }) => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadDivisions = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDivisions();
      setDivisions(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data divisi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDivisions();
    }
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.createDivision({ name: newName.trim() });
      setNewName('');
      setIsCreating(false);
      await loadDivisions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan divisi.');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await api.updateDivision(id, { name: editName.trim() });
      setEditingId(null);
      await loadDivisions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui divisi.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus divisi ini?')) return;
    try {
      await api.deleteDivision(id);
      await loadDivisions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus divisi.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="notion-card w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-notion-border">
          <h2 className="notion-page-title text-xl">Divisions</h2>
          <button onClick={onClose} className="notion-btn notion-btn-ghost text-xs">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {errorMsg}
            </div>
          )}

          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="notion-btn notion-btn-primary text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Division
            </button>
          ) : (
            <form onSubmit={handleCreate} className="notion-card p-4 space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Division name"
                className="notion-input"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewName('');
                  }}
                  className="notion-btn notion-btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="notion-btn notion-btn-primary text-xs">
                  Save
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-xs text-notion-text-secondary">Loading divisions...</p>
            ) : (
              divisions.map((div) => (
                <div key={div.id} className="notion-card p-3 flex items-center justify-between">
                  {editingId === div.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="notion-input flex-1"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdate(div.id)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-notion-text-secondary hover:bg-notion-hover rounded-md"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-notion-text">{div.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(div.id);
                            setEditName(div.name);
                          }}
                          className="p-1.5 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-md"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(div.id)}
                          className="p-1.5 text-notion-text-secondary hover:text-notion-danger hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};