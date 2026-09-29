import React, { useState, useEffect } from 'react';
import { Division, User, CreateUserInput } from '../types';
import { api } from '../api/client';
import { Plus, Trash2, Edit3, X, Check, Users, LogIn, Eye, EyeOff, ShieldCheck, KeyRound, CheckCircle2, UserCheck } from 'lucide-react';

interface UserManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { id?: string; username: string; role?: string; divisionId?: string } | null;
  onSimulateUser?: (user: Omit<User, 'password'>) => void;
  onUserUpdated?: (user: Omit<User, 'password'>) => void;
}

export const UserManager: React.FC<UserManagerProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSimulateUser,
  onUserUpdated,
}) => {
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', password: '', divisionId: '', role: 'user' as 'admin' | 'user' });
  const [editForm, setEditForm] = useState({ username: '', password: '', divisionId: '', role: 'user' as 'admin' | 'user' });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isAdmin = currentUser?.role === 'admin';

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
      setErrorMsg(err.message || 'Gagal memuat data pengguna.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setErrorMsg('');
      setSuccessMsg('');
    }

    const handleDivisionsUpdate = () => {
      api.getDivisions().then(setDivisions).catch(() => {});
    };
    window.addEventListener('divisionsUpdated', handleDivisionsUpdate);
    return () => window.removeEventListener('divisionsUpdated', handleDivisionsUpdate);
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg('Hanya Administrator yang memiliki akses untuk menambahkan user.');
      return;
    }
    if (!form.username.trim() || !form.password.trim() || !form.divisionId) {
      setErrorMsg('Username, password, dan divisi wajib diisi.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const newUser = await api.createUser({
        username: form.username.trim(),
        password: form.password.trim(),
        divisionId: form.divisionId,
        role: form.role,
      });
      setUsers(prev => {
        const exists = prev.some(u => u.id === newUser.id || u.username.toLowerCase() === newUser.username.toLowerCase());
        return exists ? prev : [...prev, newUser];
      });
      setForm({ username: '', password: '', divisionId: '', role: 'user' });
      setIsCreating(false);
      setShowCreatePassword(false);
      setSuccessMsg(`User "${newUser.username}" berhasil ditambahkan.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.username.trim()) {
      setErrorMsg('Username tidak boleh kosong.');
      return;
    }
    const targetUser = users.find(u => u.id === id) || displayedUsers.find(u => u.id === id);
    if (!isAdmin) {
      const isSelf =
        (currentUser?.id && (id === currentUser.id || targetUser?.id === currentUser.id)) ||
        (currentUser?.username && targetUser?.username.toLowerCase() === currentUser.username.toLowerCase());
      if (!isSelf) {
        setErrorMsg('Anda hanya dapat mengubah data profil Anda sendiri.');
        return;
      }
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const payload: Partial<CreateUserInput> = {
        username: editForm.username.trim(),
        divisionId: isAdmin ? editForm.divisionId : (targetUser?.divisionId || editForm.divisionId),
        role: isAdmin ? editForm.role : 'user',
      };
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      const updated = await api.updateUser(id, payload);
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updated } : u)));
      setEditingId(null);
      setShowEditPassword(false);

      // If user is editing their own profile, notify parent component
      const isSelf =
        (currentUser?.id && (id === currentUser.id || updated.id === currentUser.id)) ||
        (currentUser?.username && (targetUser?.username.toLowerCase() === currentUser.username.toLowerCase() || updated.username.toLowerCase() === currentUser.username.toLowerCase()));

      if (isSelf && onUserUpdated) {
        onUserUpdated(updated);
      }

      setSuccessMsg(
        editForm.password && editForm.password.trim()
          ? `Data dan password user "${updated.username}" berhasil diperbarui!`
          : `Data user "${updated.username}" berhasil diperbarui.`
      );
      setTimeout(() => setSuccessMsg(''), 3500);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      setErrorMsg('Hanya Administrator yang memiliki akses untuk menghapus user.');
      return;
    }
    const targetUser = users.find(u => u.id === id);
    if (!confirm(`Hapus akun user "${targetUser?.username || id}"?`)) return;
    setErrorMsg('');
    try {
      setUsers(prev => prev.filter(u => u.id !== id));
      await api.deleteUser(id);
      setSuccessMsg('User berhasil dihapus.');
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus user.');
      await loadData();
    }
  };

  if (!isOpen) return null;

  const getDivisionName = (divisionId: string) => {
    return divisions.find(d => d.id === divisionId)?.name || 'Belum ada divisi';
  };

  // Filter users based on role: Admin sees everyone, Regular user ONLY sees their own profile!
  const visibleUsers = isAdmin
    ? users
    : users.filter(u => {
        if (currentUser?.id && u.id === currentUser.id) return true;
        if (currentUser?.username && u.username.toLowerCase() === currentUser.username.toLowerCase()) return true;
        return false;
      });

  const displayedUsers = visibleUsers.length > 0
    ? visibleUsers
    : (!isAdmin && currentUser
        ? [{
            id: currentUser.id || 'curr-user',
            username: currentUser.username,
            divisionId: currentUser.divisionId || '',
            role: (currentUser.role || 'user') as 'admin' | 'user',
          }]
        : []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isAdmin
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isAdmin ? <Users className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {isAdmin ? 'Manajemen Pengguna (Users)' : 'Profil Pengguna Saya'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isAdmin
                  ? 'Kelola akun, divisi, peran akses, dan kata sandi anggota tim'
                  : 'Lihat data akun dan perbarui kata sandi login Anda'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
              <X className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add User Button or Form (Only for Administrator) */}
          {isAdmin && (
            !isCreating ? (
              <button
                onClick={() => {
                  setIsCreating(true);
                  setEditingId(null);
                  api.getDivisions().then(setDivisions).catch(() => {});
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:shadow active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Tambah Pengguna Baru
              </button>
            ) : (
              <form onSubmit={handleCreate} className="p-5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-2xl space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Tambah Pengguna Baru
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setForm({ username: '', password: '', divisionId: '', role: 'user' });
                    }}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="Contoh: rizki"
                      className="notion-input w-full bg-white dark:bg-zinc-900"
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showCreatePassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Masukkan kata sandi..."
                        className="notion-input w-full pr-10 bg-white dark:bg-zinc-900"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                        title={showCreatePassword ? 'Sembunyikan password' : 'Lihat password'}
                        tabIndex={-1}
                      >
                        {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Divisi <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.divisionId}
                      onChange={(e) => setForm({ ...form, divisionId: e.target.value })}
                      className="notion-input w-full bg-white dark:bg-zinc-900"
                      required
                    >
                      <option value="">-- Pilih Divisi --</option>
                      {divisions.map((div) => (
                        <option key={div.id} value={div.id}>{div.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Peran / Hak Akses
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'user' })}
                      className="notion-input w-full bg-white dark:bg-zinc-900"
                    >
                      <option value="user">User (Hanya Tugas Sendiri)</option>
                      <option value="admin">Admin (Akses Penuh Seluruh Sistem)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setForm({ username: '', password: '', divisionId: '', role: 'user' });
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                  </button>
                </div>
              </form>
            )
          )}

          {/* User List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
              <span>{isAdmin ? `Daftar Pengguna (${displayedUsers.length})` : 'Informasi Akun Profil'}</span>
              {!isAdmin && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Akun Terverifikasi
                </span>
              )}
            </div>

            {isLoading && displayedUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                Memuat data pengguna...
              </div>
            ) : displayedUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                Belum ada pengguna terdaftar.
              </div>
            ) : (
              displayedUsers.map((user) => (
                <div key={user.id}>
                  {editingId === user.id ? (
                    /* Expanded Edit Card - Clean, Spacious & Full-width columns */
                    <div className="p-5 border-2 border-indigo-500/50 bg-indigo-50/20 dark:bg-indigo-950/15 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-150">
                      <div className="flex items-center justify-between pb-3 border-b border-indigo-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {isAdmin ? 'Edit Pengguna: ' : 'Edit Profil Saya: '}
                            <span className="text-indigo-600 dark:text-indigo-400">{user.username}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setShowEditPassword(false);
                          }}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Username
                          </label>
                          <input
                            type="text"
                            value={editForm.username}
                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                            className="notion-input w-full bg-white dark:bg-zinc-900"
                            placeholder="Username"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Password Baru <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">(Kosongkan jika tidak diubah)</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showEditPassword ? 'text' : 'password'}
                              value={editForm.password}
                              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                              placeholder="Ketik password baru..."
                              className="notion-input w-full pr-10 bg-white dark:bg-zinc-900"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEditPassword(!showEditPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                              title={showEditPassword ? 'Sembunyikan password' : 'Lihat password'}
                              tabIndex={-1}
                            >
                              {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Divisi {!isAdmin && <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">(Dikelola oleh Administrator)</span>}
                          </label>
                          <select
                            value={editForm.divisionId}
                            onChange={(e) => setEditForm({ ...editForm, divisionId: e.target.value })}
                            disabled={!isAdmin}
                            className={`notion-input w-full bg-white dark:bg-zinc-900 ${!isAdmin ? 'opacity-70 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800' : ''}`}
                          >
                            <option value="">-- Pilih Divisi --</option>
                            {divisions.map((div) => (
                              <option key={div.id} value={div.id}>{div.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Peran / Hak Akses {!isAdmin && <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">(Hanya Administrator)</span>}
                          </label>
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'user' })}
                            disabled={!isAdmin}
                            className={`notion-input w-full bg-white dark:bg-zinc-900 ${!isAdmin ? 'opacity-70 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800' : ''}`}
                          >
                            <option value="user">User (Hanya Tugas Sendiri)</option>
                            {isAdmin && <option value="admin">Admin (Akses Penuh Seluruh Sistem)</option>}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-indigo-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setShowEditPassword(false);
                          }}
                          className="px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 rounded-xl transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(user.id)}
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal User Item Row */
                    <div className="p-4 bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors shadow-2xs">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          user.role === 'admin'
                            ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                            : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {user.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {user.username}
                            </p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                              user.role === 'admin'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                            }`}>
                              {user.role === 'admin' ? 'ADMIN' : 'USER'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            Divisi: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{getDivisionName(user.divisionId)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isAdmin && onSimulateUser && (
                          <button
                            onClick={() => onSimulateUser(user)}
                            className="px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg font-semibold flex items-center gap-1 transition-colors"
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
                            setShowEditPassword(false);
                            setErrorMsg('');
                          }}
                          className={isAdmin
                            ? "p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-750 rounded-lg transition-colors flex items-center gap-1"
                            : "px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
                          }
                          title="Edit Profil & Ganti Password"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span className={isAdmin ? 'hidden' : 'inline text-xs'}>Edit Profil & Password</span>
                          {isAdmin && <KeyRound className="w-3.5 h-3.5 text-zinc-400" />}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                            title="Hapus User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
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