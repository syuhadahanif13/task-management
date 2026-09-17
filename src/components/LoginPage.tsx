import React, { useState } from 'react';
import { Lock, User, AlertCircle, Sun, Moon, Globe } from 'lucide-react';
import { Language, getT } from '../i18n';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  language?: Language;
  onToggleLanguage?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  isDarkMode = false,
  onToggleDarkMode,
  language = 'id',
  onToggleLanguage,
}) => {
  const currentLang: Language = language === 'en' ? 'en' : 'id';
  const t = getT(currentLang);
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
        setErrorMsg(t.auth.loginError);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t.auth.loginError);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-notion-bg flex items-center justify-center p-4 relative transition-colors">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {onToggleLanguage && (
          <button
            onClick={onToggleLanguage}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-notion-text-secondary hover:bg-notion-hover flex items-center gap-1.5 transition-colors border border-notion-border"
            title="Ganti Bahasa / Change Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language.toUpperCase()}</span>
          </button>
        )}
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className="rounded-lg p-2 text-notion-text-secondary hover:bg-notion-hover transition-colors"
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
      </div>

      <div className="w-full max-w-sm">
        <div className="notion-card p-6 space-y-5">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-9 w-9">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-9 w-9 object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-notion-text tracking-tight">
                {t.auth.loginTitle}
              </h1>
              <p className="text-xs text-notion-text-secondary">
                {t.auth.loginSubtitle}
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
                <span>{t.auth.username}</span>
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
                <span>{t.auth.password}</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                autoComplete="current-password"
                className="notion-input"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="notion-btn notion-btn-primary w-full justify-center"
            >
              {isSubmitting ? t.auth.loggingIn : t.auth.loginButton}
            </button>
          </form>

          {/* Quick Login / Testing Accounts */}
          <div className="pt-3 border-t border-notion-border space-y-2">
            <p className="text-[11px] font-semibold text-notion-text-secondary text-center">
              Akun Percobaan (Testing & Debugging):
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('r@jaemasmantab');
                  setErrorMsg('');
                }}
                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors text-center border border-indigo-200/50"
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('rizki');
                  setPassword('r@jaemas123');
                  setErrorMsg('');
                }}
                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 transition-colors text-center border border-zinc-200 dark:border-zinc-700"
              >
                👤 User (Rizki)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('ajeng');
                  setPassword('r@jaemas123');
                  setErrorMsg('');
                }}
                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 transition-colors text-center border border-zinc-200 dark:border-zinc-700"
              >
                👤 User (Ajeng)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('Hanif');
                  setPassword('r@jaemas123');
                  setErrorMsg('');
                }}
                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 transition-colors text-center border border-zinc-200 dark:border-zinc-700"
              >
                👤 User (Hanif)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};