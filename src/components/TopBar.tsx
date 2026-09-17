import React, { useState } from 'react';
import { AppTab } from '../types';
import { Translations } from '../i18n';
import {
  ArrowLeft,
  Bell,
  Menu,
  X,
  Plus,
  Sparkles,
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  CalendarDays,
  Users,
  Settings,
  Sun,
  Moon,
  LogOut,
  AlertCircle,
} from 'lucide-react';

interface TopBarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onBack?: () => void;
  pageTitle: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  t: Translations;
  language: 'id' | 'en';
  onToggleLanguage: () => void;
  onOpenNewMeeting: () => void;
  onOpenAiExtract: () => void;
  onOpenAddTask?: () => void;
  currentUser?: { username: string; role?: string; divisionId?: string } | null;
  overdueCount?: number;
  showBack?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onTabChange,
  onBack,
  pageTitle,
  isDarkMode,
  onToggleDarkMode,
  onLogout,
  t,
  language,
  onToggleLanguage,
  onOpenNewMeeting,
  onOpenAiExtract,
  onOpenAddTask,
  currentUser,
  overdueCount = 0,
  showBack,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const userName = currentUser?.username || 'Abdul Momon';
  const isHome = currentTab === 'dashboard';

  const handleNavClick = (tab: AppTab) => {
    onTabChange(tab);
    setIsDrawerOpen(false);
  };

  const handleBackClick = () => {
    if (onBack && (showBack || currentTab === 'active-meeting')) {
      onBack();
    } else {
      onTabChange('dashboard');
    }
  };

  // Determine Title for inner screens
  const getHeaderTitle = () => {
    if (currentTab === 'all-tasks') return 'My Task';
    if (currentTab === 'meetings') return 'Routines';
    if (currentTab === 'calendar') return 'Schedule';
    if (currentTab === 'team') return 'Team';
    if (currentTab === 'settings') return 'Settings';
    if (currentTab === 'active-meeting') return 'Meeting Detail';
    return pageTitle;
  };

  return (
    <>
      {/* ────────────────────────────────────────────────────────────
          MINIMALIST MOBILE HEADER (Matches Reference Image)
          Hidden on Desktop (lg:hidden)
         ──────────────────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-[#0f1015]/95 backdrop-blur-md border-b border-gray-100/80 dark:border-zinc-800/60 px-4 py-3 transition-colors">
        {isHome ? (
          /* ─── State 1: Home / Dashboard Header ─── */
          <div className="flex items-center justify-between">
            {/* Left: Avatar + "Welcome Back," + User Name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-500 p-[1.5px] shadow-xs">
                  <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-sm font-bold text-gray-800 dark:text-zinc-100">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full" />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 leading-tight">
                  Welcome Back,
                </p>
                <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-tight tracking-tight truncate">
                  {userName}
                </h2>
              </div>
            </div>

            {/* Right: Notification Bell + Burger Menu (≡) */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Bell Icon */}
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                  aria-label="Notifikasi"
                >
                  <Bell className="w-5 h-5 stroke-[1.8]" />
                  {overdueCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#0f1015]" />
                  )}
                </button>

                {/* Notification Dropdown */}
                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Pemberitahuan</p>
                      <button
                        onClick={() => setIsNotifOpen(false)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                      >
                        ✕
                      </button>
                    </div>
                    {overdueCount > 0 ? (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Ada <strong>{overdueCount} tugas</strong> yang terlambat!</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        Semua tugas berjalan tepat waktu.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Burger Menu Button (≡) */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5 stroke-[2]" />
              </button>
            </div>
          </div>
        ) : (
          /* ─── State 2 & 3: Inner Screens Header (← Title + / ≡) ─── */
          <div className="flex items-center justify-between relative">
            {/* Left: Clean Back Button (←) */}
            <button
              onClick={handleBackClick}
              className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-gray-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2]" />
            </button>

            {/* Center: Title */}
            <div className="flex-1 text-center px-2">
              <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-tight leading-tight truncate">
                {getHeaderTitle()}
              </h1>
            </div>

            {/* Right: Plus (+) Action Button & Burger Menu (≡) */}
            <div className="flex items-center gap-0.5 shrink-0">
              {currentTab === 'all-tasks' && onOpenAddTask && (
                <button
                  onClick={onOpenAddTask}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                  title="Tambah Tugas"
                  aria-label="Tambah Tugas"
                >
                  <Plus className="w-5 h-5 stroke-[2.2]" />
                </button>
              )}

              {currentTab === 'meetings' && (
                <button
                  onClick={onOpenNewMeeting}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                  title="Tambah Rapat"
                  aria-label="Tambah Rapat"
                >
                  <Plus className="w-5 h-5 stroke-[2.2]" />
                </button>
              )}

              {/* Burger Menu Button (≡) */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5 stroke-[2]" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ────────────────────────────────────────────────────────────
          BURGER MENU SLIDE-OVER DRAWER (Right Side Drawer)
         ──────────────────────────────────────────────────────────── */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <aside className="relative w-[82vw] max-w-xs bg-white dark:bg-[#16171d] text-gray-900 dark:text-zinc-100 h-full shadow-2xl z-10 flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#18191d] flex items-center justify-center text-white font-black text-xs">
                    T
                  </div>
                  <span className="font-bold text-sm text-gray-900 dark:text-white">TaskManager</span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Tutup Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Snippet */}
              <div className="my-4 p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 flex items-center gap-3 border border-gray-100 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight">
                    {userName}
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 capitalize truncate">
                    {currentUser?.role || 'Member'}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mb-4 space-y-2">
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenAiExtract();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-ios-indigo border border-indigo-200/50 dark:border-indigo-800/50 font-semibold text-xs transition-colors active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>AI Extract Notula</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenAddTask?.();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 text-xs font-medium hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tugas Baru</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenNewMeeting();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#18191d] text-white text-xs font-medium hover:bg-black transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Rapat Baru</span>
                  </button>
                </div>
              </div>

              {/* Navigation Menu Links */}
              <nav className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 px-3 py-1">
                  Menu Utama
                </p>

                <button
                  onClick={() => handleNavClick('dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    currentTab === 'dashboard'
                      ? 'bg-[#18191d] text-white shadow-xs'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>{t.nav.dashboard}</span>
                </button>

                <button
                  onClick={() => handleNavClick('all-tasks')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    currentTab === 'all-tasks'
                      ? 'bg-[#18191d] text-white shadow-xs'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{t.nav.tasks}</span>
                </button>

                <button
                  onClick={() => handleNavClick('meetings')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    currentTab === 'meetings'
                      ? 'bg-[#18191d] text-white shadow-xs'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{t.nav.meetings}</span>
                </button>

                <button
                  onClick={() => handleNavClick('calendar')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    currentTab === 'calendar'
                      ? 'bg-[#18191d] text-white shadow-xs'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>{t.nav.calendar}</span>
                </button>

                <button
                  onClick={() => handleNavClick('team')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    currentTab === 'team'
                      ? 'bg-[#18191d] text-white shadow-xs'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>{t.nav.team}</span>
                </button>

                <button
                  onClick={() => handleNavClick('settings')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    currentTab === 'settings'
                      ? 'bg-[#18191d] text-white shadow-xs'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>{t.nav.settings}</span>
                </button>
              </nav>
            </div>

            {/* Drawer Bottom Controls */}
            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between px-1">
                {/* Dark Mode Toggle */}
                <button
                  onClick={onToggleDarkMode}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-400" />
                      <span>Mode Terang</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-gray-600" />
                      <span>Mode Gelap</span>
                    </>
                  )}
                </button>

                {/* Language Toggle */}
                <button
                  onClick={onToggleLanguage}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-[11px] font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  {language === 'id' ? '🇮🇩 ID' : '🇺🇸 EN'}
                </button>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.auth.logout}</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
