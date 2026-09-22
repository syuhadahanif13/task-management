import React, { useState, useEffect } from 'react';
import { Division, User, CreateUserInput } from '../types';
import { api } from '../api/client';
import { Plus, Trash2, Edit3, X, Check, Users, LogIn } from 'lucide-react';

interface UserManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateUser?: (user: Omit<User, 'password'>) => void;
}

export const UserManager: React.FC<UserManagerProps> = ({ isOpen, onClose, onSimulateUser }) => {
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', password: '', divisionId: '', role: 'user' as 'admin' | 'user' });
  const [editForm, setEditForm] = useState({ username: '', password: '', divisionId: '', role: 'user' as 'admin' | 'user' });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, divisionsData] = await Promise.all([
        api.getUsers(),
        api.getDivisions()
      ]);
      setUsers(usersData);
      setDivisions(divisionsData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }

    const handleDivisionsUpdate = () => {
      api.getDivisions().then(setDivisions).catch(() => {});
    };
    window.addEventListener('divisionsUpdated', handleDivisionsUpdate);
    return () => window.removeEventListener('divisionsUpdated', handleDivisionsUpdate);
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim() || !form.divisionId) return;
    setErrorMsg('');
    try {
      const newUser = await api.createUser(form);
      setUsers(prev => {
        const exists = prev.some(u => u.id === newUser.id || u.username.toLowerCase() === newUser.username.toLowerCase());
        return exists ? prev : [...prev, newUser];
      });
      setForm({ username: '', password: '', divisionId: '', role: 'user' });
      setIsCreating(false);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan user.');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.username.trim()) return;
    setErrorMsg('');
    try {
      const updated = await api.updateUser(id, editForm);
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updated } : u)));
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui user.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus user ini?')) return;
    setErrorMsg('');
    try {
      setUsers(prev => prev.filter(u => u.id !== id));
      await api.deleteUser(id);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus user.');
      await loadData();
    }
  };

  if (!isOpen) return null;

  const getDivisionName = (divisionId: string) => {
    return divisions.find(d => d.id === divisionId)?.name || 'Unknown';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="notion-card w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-notion-border">
          <h2 className="notion-page-title text-xl">Users</h2>
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
              onClick={() => {
                setIsCreating(true);
                api.getDivisions().then(setDivisions).catch(() => {});
              }}
              className="notion-btn notion-btn-primary text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add User
            </button>
          ) : (
            <form onSubmit={handleCreate} className="notion-card p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Username"
                  className="notion-input"
                  autoFocus
                />
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Password"
                  className="notion-input"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={form.divisionId}
                  onChange={(e) => setForm({ ...form, divisionId: e.target.value })}
                  className="notion-input"
                >
                  <option value="">Select Division</option>
                  {divisions.map((div) => (
                    <option key={div.id} value={div.id}>{div.name}</option>
                  ))}
                </select>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'user' })}
                  className="notion-input"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setForm({ username: '', password: '', divisionId: '', role: 'user' });
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
              <p className="text-xs text-notion-text-secondary">Loading users...</p>
            ) : (
              users.map((user) => (
                <div key={user.id} className="notion-card p-3 flex items-center justify-between">
                  {editingId === user.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="notion-input flex-1"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        placeholder="Password"
                        className="notion-input flex-1"
                      />
                      <select
                        value={editForm.divisionId}
                        onChange={(e) => setEditForm({ ...editForm, divisionId: e.target.value })}
                        className="notion-input"
                      >
                        <option value="">Division</option>
                        {divisions.map((div) => (
                          <option key={div.id} value={div.id}>{div.name}</option>
                        ))}
                      </select>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'user' })}
                        className="notion-input"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleUpdate(user.id)}
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
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-notion-sidebar flex items-center justify-center">
                          <Users className="h-4 w-4 text-notion-text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-notion-text">{user.username}</p>
                          <p className="text-[11px] text-notion-text-secondary">
                            {getDivisionName(user.divisionId)} • {user.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {onSimulateUser && (
                          <button
                            onClick={() => onSimulateUser(user)}
                            className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md font-semibold flex items-center gap-1 transition-colors"
                            title={`Simulasi login sebagai ${user.username}`}
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px]">Simulasi</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(user.id);
                            setEditForm({
                              username: user.username,
                              password: '',
                              divisionId: user.divisionId,
                              role: user.role,
                            });
                          }}
                          className="p-1.5 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-md"
                          title="Edit User"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1.5 text-notion-text-secondary hover:text-notion-danger hover:bg-rose-50 rounded-md"
                          title="Hapus User"
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