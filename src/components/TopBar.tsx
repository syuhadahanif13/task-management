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
          BURGER MENU SLIDE-OVER DRAWER (Glassmorphism + Neon Blur)
         ──────────────────────────────────────────────────────────── */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          />

          {/* Glassmorphism Drawer Panel */}
          <aside className="relative w-[84vw] max-w-xs bg-white/80 dark:bg-[#0e0f14]/85 backdrop-blur-3xl border-l border-white/60 dark:border-white/10 text-gray-900 dark:text-zinc-100 h-full shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] z-10 flex flex-col justify-between p-5 overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Neon Blur Ambient Orbs */}
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#a3e635]/20 dark:bg-[#a3e635]/15 blur-[60px] pointer-events-none" />
            <div className="absolute top-1/2 -left-12 w-48 h-48 rounded-full bg-[#38bdf8]/20 dark:bg-[#38bdf8]/15 blur-[70px] pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-[#a855f7]/20 dark:bg-[#818cf8]/15 blur-[60px] pointer-events-none" />

            <div className="relative z-10 overflow-y-auto pr-0.5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/40 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-950 dark:bg-white/10 border border-white/20 flex items-center justify-center text-[#a3e635] font-black text-xs shadow-[0_0_12px_rgba(163,230,53,0.4)]">
                    T
                  </div>
                  <span className="font-bold text-sm text-gray-900 dark:text-white">Meeting Hub</span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 transition-colors"
                  aria-label="Tutup Menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Profile Snippet (Glass Card) */}
              <div className="my-3.5 p-3 rounded-2xl bg-white/50 dark:bg-white/5 flex items-center gap-3 border border-white/60 dark:border-white/10 shadow-xs">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-500 p-[1.5px] shadow-xs shrink-0">
                  <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-zinc-100">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight">
                    {userName}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635] shadow-[0_0_6px_#a3e635]" />
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 capitalize truncate">
                      {currentUser?.role || 'Member'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions (Neon Glowing Buttons) */}
              <div className="mb-3.5 space-y-2">
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenAiExtract();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/15 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-300/40 dark:border-purple-500/30 font-semibold text-xs transition-all duration-200 active:scale-98 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                >
                  <Sparkles className="w-4 h-4 text-purple-500 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)] shrink-0" />
                  <span>AI Extract Notula</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenAddTask?.();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/70 hover:bg-white/90 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-zinc-200 text-xs font-medium border border-white/60 dark:border-white/10 hover:border-sky-400/50 hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-sky-500" />
                    <span>Tugas Baru</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenNewMeeting();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900/90 hover:bg-black dark:bg-white/10 dark:hover:bg-white/15 text-white text-xs font-medium border border-white/20 hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#a3e635]" />
                    <span>Rapat Baru</span>
                  </button>
                </div>
              </div>

              {/* Navigation Menu Links */}
              <nav className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 px-3 py-1">
                  Menu Utama
                </p>

                {[
                  { tab: 'dashboard' as AppTab, label: t.nav.dashboard, icon: LayoutDashboard },
                  { tab: 'all-tasks' as AppTab, label: t.nav.tasks, icon: CheckSquare },
                  { tab: 'meetings' as AppTab, label: t.nav.meetings, icon: BookOpen },
                  { tab: 'calendar' as AppTab, label: t.nav.calendar, icon: CalendarDays },
                  { tab: 'team' as AppTab, label: t.nav.team, icon: Users },
                  { tab: 'settings' as AppTab, label: t.nav.settings, icon: Settings },
                ].map(({ tab, label, icon: Icon }) => {
                  const active = currentTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => handleNavClick(tab)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-left transition-all duration-200 relative overflow-hidden ${active
                          ? 'bg-white/95 dark:bg-white/10 text-gray-950 dark:text-white border border-white dark:border-white/20 shadow-[0_0_20px_rgba(163,230,53,0.3)]'
                          : 'text-gray-600 dark:text-zinc-400 hover:text-gray-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5 border border-transparent'
                        }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-[#a3e635] shadow-[0_0_10px_#a3e635]" />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 ${active
                            ? 'text-lime-600 dark:text-[#a3e635] drop-shadow-[0_0_6px_rgba(163,230,53,0.7)]'
                            : 'text-gray-400 dark:text-zinc-500'
                          }`}
                      />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Bottom Controls */}
            <div className="pt-3 border-t border-white/40 dark:border-white/10 space-y-2 relative z-10 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-2xl p-2.5">
              <div className="flex items-center justify-between gap-2">
                {/* Dark Mode Toggle */}
                <button
                  onClick={onToggleDarkMode}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-700 dark:text-zinc-300 text-xs font-semibold border border-white/60 dark:border-white/10 transition-all active:scale-95"
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                      <span>Terang</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Gelap</span>
                    </>
                  )}
                </button>

                {/* Language Toggle */}
                <button
                  onClick={onToggleLanguage}
                  className="px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-white/60 dark:border-white/10 text-[11px] font-bold text-gray-700 dark:text-zinc-300"
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-300/30 dark:border-rose-500/20 transition-all active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.auth.logout}</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
