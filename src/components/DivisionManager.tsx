import React, { useState, useEffect } from 'react';
import { Division, CreateDivisionInput } from '../types';
import { api } from '../api/client';
import { Plus, Trash2, Edit3, X, Check, Database, Copy, CheckCircle2 } from 'lucide-react';

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
  const [copiedSql, setCopiedSql] = useState(false);

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
    const trimmed = newName.trim();
    setErrorMsg('');
    try {
      const created = await api.createDivision({ name: trimmed });
      // Optimistic update so it appears immediately without disappearing
      setDivisions(prev => {
        const exists = prev.some(d => d.id === created.id || d.name.toLowerCase() === created.name.toLowerCase());
        return exists ? prev : [...prev, created];
      });
      setNewName('');
      setIsCreating(false);
      await loadDivisions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan divisi.');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    const trimmed = editName.trim();
    setErrorMsg('');
    try {
      const updated = await api.updateDivision(id, { name: trimmed });
      setDivisions(prev => prev.map(d => (d.id === id ? { ...d, name: trimmed, updatedAt: updated.updatedAt } : d)));
      setEditingId(null);
      await loadDivisions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui divisi.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus divisi ini?')) return;
    setErrorMsg('');
    try {
      setDivisions(prev => prev.filter(d => d.id !== id));
      await api.deleteDivision(id);
      await loadDivisions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus divisi.');
      await loadDivisions();
    }
  };

  const handleCopySql = () => {
    const sql = `CREATE TABLE IF NOT EXISTS public.divisions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on divisions" ON public.divisions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on divisions" ON public.divisions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on divisions" ON public.divisions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on divisions" ON public.divisions FOR DELETE USING (true);`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
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

          {/* Supabase Sync Information & Helper */}
          <div className="pt-3 border-t border-notion-border flex items-center justify-between text-xs text-notion-text-secondary">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Sinkronisasi Supabase &amp; Offline Cache</span>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors"
              title="Salin skrip SQL untuk tabel divisions di Supabase"
            >
              {copiedSql ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>SQL Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-emerald-600" />
                  <span>Salin SQL Supabase</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};