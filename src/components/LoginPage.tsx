import React, { useState } from 'react';
import { Lock, User, AlertCircle, Sun, Moon } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const success = await onLogin(username, password);
      if (!success) {
        setErrorMsg('Username atau password salah.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login gagal.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-notion-bg flex items-center justify-center p-4 relative transition-colors">
      {onToggleDarkMode && (
        <button
          onClick={onToggleDarkMode}
          className="absolute top-4 right-4 rounded-lg p-2 text-notion-text-secondary hover:bg-notion-hover transition-colors"
          title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          aria-label="Toggle theme"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-notion-text-secondary" />
          )}
        </button>
      )}

      <div className="w-full max-w-sm">
        <div className="notion-card p-6 space-y-5">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-9 w-9">
              <img
                src="https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/1871f1632174b485181d942f9d5e61b6.png"
                alt="Logo"
                className="h-9 w-9 object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-notion-text tracking-tight">
                Meeting Task Management
              </h1>
              <p className="text-xs text-notion-text-secondary">
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
              <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-notion-text-secondary" />
                <span>Username</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="notion-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-notion-text flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-notion-text-secondary" />
                <span>Password</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                className="notion-input"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="notion-btn notion-btn-primary w-full justify-center"
            >
              {isSubmitting ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};