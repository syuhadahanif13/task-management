import React, { useState, useEffect } from 'react';
import { Lock, User, AlertCircle, Sun, Moon, Globe, KeyRound, ExternalLink, X, Check } from 'lucide-react';
import { Language, getT } from '../i18n';
import { api } from '../api/client';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onGitHubLoginSuccess?: (user: any, token: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  language?: Language;
  onToggleLanguage?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  onGitHubLoginSuccess,
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

  // GitHub Auth state
  const [isGitHubConfigured, setIsGitHubConfigured] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [githubPat, setGithubPat] = useState('');
  const [isPatSubmitting, setIsPatSubmitting] = useState(false);
  const [patError, setPatError] = useState('');

  useEffect(() => {
    api.getGitHubConfig()
      .then((cfg) => {
        setIsGitHubConfigured(cfg.configured);
      })
      .catch(() => {});
  }, []);

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

  const handleGitHubClick = () => {
    if (isGitHubConfigured) {
      window.location.href = '/api/auth/github';
    } else {
      setShowTokenModal(true);
    }
  };

  const handlePatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubPat.trim()) {
      setPatError('Personal Access Token GitHub wajib diisi.');
      return;
    }

    setIsPatSubmitting(true);
    setPatError('');

    try {
      const res = await api.loginWithGitHubToken(githubPat.trim());
      if (onGitHubLoginSuccess) {
        onGitHubLoginSuccess(res.user, res.token);
      } else {
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('currentUser', JSON.stringify(res.user));
        window.location.reload();
      }
    } catch (err: any) {
      setPatError(err.message || 'Token GitHub tidak valid atau gagal terhubung.');
    } finally {
      setIsPatSubmitting(false);
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
                placeholder={currentLang === 'en' ? 'Enter username' : 'Masukkan username'}
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

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-notion-border" />
            <span className="bg-notion-card px-2 text-[11px] text-notion-text-secondary uppercase tracking-wider absolute">
              atau
            </span>
          </div>

          {/* GitHub Auth Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGitHubClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-zinc-100 font-semibold text-xs transition shadow-2xs active:scale-[0.98]"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Masuk dengan GitHub (Tim IT)</span>
            </button>

            {!isGitHubConfigured && (
              <p className="text-[10px] text-center text-zinc-500 dark:text-zinc-400">
                Punya token GitHub?{' '}
                <button
                  type="button"
                  onClick={() => setShowTokenModal(true)}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Gunakan Token PAT
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* GitHub Token Modal (For instant developer login/linking without full OAuth app) */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-black flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Masuk via GitHub Token (PAT)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Koneksi cepat untuk Tim IT & Pengembang
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {patError && (
              <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{patError}</span>
              </div>
            )}

            <form onSubmit={handlePatSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  GitHub Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  placeholder="ghp_xxxx atau github_pat_xxxx"
                  className="notion-input font-mono text-xs"
                />
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Buat token dengan izin <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">repo</code> & <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">read:user</code> di:{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>github.com/settings/tokens</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="notion-btn flex-1 justify-center text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPatSubmitting}
                  className="notion-btn notion-btn-primary flex-1 justify-center text-xs"
                >
                  {isPatSubmitting ? 'Memverifikasi...' : 'Masuk Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};