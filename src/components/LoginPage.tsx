import React, { useState } from 'react';
import { BookOpen, Lock, User, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const success = onLogin(username, password);
    if (!success) {
      setErrorMsg('Username atau password salah.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl p-6 space-y-5">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-9 h-9">
              <img
                src="https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/1871f1632174b485181d942f9d5e61b6.png"
                alt="Logo"
                className="w-9 h-9 object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-900 tracking-tight">
                Meeting Task Management
              </h1>
              <p className="text-xs text-zinc-500">
                Masuk untuk mengelola notula rapat & tindak lanjut
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                <span>Username</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Password</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2 text-xs font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
