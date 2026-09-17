import React from 'react';
import { AppTab } from '../types';
import { Translations } from '../i18n';
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  CheckSquare,
  Users,
  Settings,
  Sparkles,
  Plus,
  Sun,
  Moon,
  LogOut,
  Globe,
} from 'lucide-react';

interface SidebarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenNewMeeting: () => void;
  onOpenAddTask: () => void;
  onOpenAiExtract: () => void;
  meetingCount: number;
  taskCount: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  t: Translations;
  language: 'id' | 'en';
  onToggleLanguage: () => void;
}

interface NavItem {
  tab: AppTab;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onOpenNewMeeting,
  onOpenAddTask,
  onOpenAiExtract,
  meetingCount,
  taskCount,
  isDarkMode,
  onToggleDarkMode,
  onLogout,
  t,
  language,
  onToggleLanguage,
}) => {
  const navItems: NavItem[] = [
    { tab: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { tab: 'calendar', label: t.nav.calendar, icon: CalendarDays },
    { tab: 'meetings', label: t.nav.meetings, icon: BookOpen, badge: meetingCount },
    { tab: 'all-tasks', label: t.nav.tasks, icon: CheckSquare, badge: taskCount },
    { tab: 'team', label: t.nav.team, icon: Users },
  ];

  const isActive = (tab: AppTab) => {
    if (tab === 'meetings') return currentTab === 'meetings' || currentTab === 'active-meeting';
    return currentTab === tab;
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 min-h-screen sticky top-0 h-screen overflow-hidden z-20 select-none relative bg-white/60 dark:bg-[#0c0d12]/75 backdrop-blur-2xl border-r border-white/60 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-300">
      {/* ─── NEON BLUR AMBIENT ORBS (Floating behind glass) ─── */}
      <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-[#a3e635]/20 dark:bg-[#a3e635]/15 blur-[65px] pointer-events-none animate-pulse duration-[7000ms]" />
      <div className="absolute top-1/2 -right-16 w-52 h-52 rounded-full bg-[#38bdf8]/20 dark:bg-[#38bdf8]/15 blur-[75px] pointer-events-none" />
      <div className="absolute -bottom-12 -left-8 w-44 h-44 rounded-full bg-[#a855f7]/20 dark:bg-[#818cf8]/15 blur-[65px] pointer-events-none" />

      {/* ─── GLASS HEADER / BRAND ─── */}
      <div className="p-4 border-b border-white/40 dark:border-white/10 relative z-10">
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-md shadow-xs">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-gray-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-950 p-1 flex items-center justify-center shadow-[0_0_16px_rgba(163,230,53,0.3)] border border-lime-400/30">
            <img
              src="https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/1871f1632174b485181d942f9d5e61b6.png"
              alt="Logo"
              className="h-full w-full object-contain rounded-lg"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate tracking-tight">
              TaskManager
            </p>

          </div>
        </div>
      </div>

      {/* ─── QUICK ACTIONS (Neon Glowing Glass Pills) ─── */}
      <div className="p-3 border-b border-white/40 dark:border-white/10 space-y-2 relative z-10">
        {/* New Meeting Button */}
        <button
          onClick={onOpenNewMeeting}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-gray-900/90 hover:bg-black dark:bg-white/10 dark:hover:bg-white/15 text-white text-xs font-semibold border border-white/20 dark:border-white/20 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:shadow-[0_0_20px_rgba(163,230,53,0.15)] hover:shadow-[0_0_24px_rgba(163,230,53,0.3)] active:scale-95 transition-all duration-200 group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#a3e635] flex items-center justify-center text-zinc-950 shadow-[0_0_10px_#a3e635] group-hover:scale-110 transition-transform">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span>{t.meetings.newMeeting}</span>
          </div>
          <span className="text-[10px] text-zinc-400 group-hover:text-white transition-colors">⌘M</span>
        </button>

        {/* Add Task Button */}
        <button
          onClick={onOpenAddTask}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/70 hover:bg-white/90 dark:bg-white/5 dark:hover:bg-white/10 text-gray-900 dark:text-zinc-100 text-xs font-semibold border border-white/80 dark:border-white/10 backdrop-blur-md shadow-xs hover:border-sky-400/50 hover:shadow-[0_0_20px_rgba(56,189,248,0.25)] active:scale-95 transition-all duration-200 group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-sky-500/15 dark:bg-sky-400/20 text-sky-500 dark:text-sky-400 flex items-center justify-center border border-sky-400/30 group-hover:shadow-[0_0_10px_#38bdf8] transition-all">
              <CheckSquare className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <span>{t.tasks.addTask}</span>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-zinc-500 group-hover:text-sky-500 transition-colors">⌘T</span>
        </button>

        {/* AI Extract */}
        <button
          onClick={onOpenAiExtract}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/15 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium border border-purple-300/40 dark:border-purple-500/30 backdrop-blur-md hover:shadow-[0_0_18px_rgba(168,85,247,0.3)] transition-all duration-200 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]" />
          <span>AI Extract Notula</span>
        </button>
      </div>

      {/* ─── NAVIGATION (Glass & Neon Highlight) ─── */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto relative z-10">
        <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
          Menu Navigasi
        </p>

        {navItems.map(({ tab, label, icon: Icon, badge }) => {
          const active = isActive(tab);
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-left transition-all duration-200 relative overflow-hidden ${active
                  ? 'bg-white/95 dark:bg-white/10 text-gray-950 dark:text-white border border-white dark:border-white/20 shadow-[0_0_22px_rgba(163,230,53,0.35)] dark:shadow-[0_0_24px_rgba(163,230,53,0.22)]'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5 border border-transparent hover:border-white/40 dark:hover:border-white/10'
                }`}
            >
              {/* Neon active bar indicator */}
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-[#a3e635] shadow-[0_0_12px_#a3e635]" />
              )}

              <Icon
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${active
                    ? 'text-lime-600 dark:text-[#a3e635] drop-shadow-[0_0_8px_rgba(163,230,53,0.7)]'
                    : 'text-gray-400 dark:text-zinc-500 group-hover:text-gray-700 dark:group-hover:text-zinc-300'
                  }`}
              />

              <span className="flex-1 truncate">{label}</span>

              {badge !== undefined && badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center transition-all ${active
                      ? 'bg-[#a3e635] text-zinc-950 shadow-[0_0_10px_rgba(163,230,53,0.6)]'
                      : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-zinc-400 group-hover:bg-white/30 dark:group-hover:bg-white/15'
                    }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-2 border-t border-white/40 dark:border-white/10 mt-2">
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
            Sistem
          </p>

          <button
            onClick={() => onTabChange('settings')}
            className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-left transition-all duration-200 relative overflow-hidden ${isActive('settings')
                ? 'bg-white/95 dark:bg-white/10 text-gray-950 dark:text-white border border-white dark:border-white/20 shadow-[0_0_22px_rgba(163,230,53,0.35)] dark:shadow-[0_0_24px_rgba(163,230,53,0.22)]'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5 border border-transparent hover:border-white/40 dark:hover:border-white/10'
              }`}
          >
            {isActive('settings') && (
              <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-[#a3e635] shadow-[0_0_12px_#a3e635]" />
            )}
            <Settings
              className={`w-4 h-4 shrink-0 transition-transform group-hover:rotate-45 ${isActive('settings')
                  ? 'text-lime-600 dark:text-[#a3e635] drop-shadow-[0_0_8px_rgba(163,230,53,0.7)]'
                  : 'text-gray-400 dark:text-zinc-500 group-hover:text-gray-700 dark:group-hover:text-zinc-300'
                }`}
            />
            <span className="flex-1 truncate">{t.nav.settings}</span>
          </button>
        </div>
      </nav>

      {/* ─── BOTTOM CONTROLS (Glass Pills) ─── */}
      <div className="p-3 border-t border-white/40 dark:border-white/10 space-y-1.5 relative z-10 bg-white/20 dark:bg-black/20 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-1.5">
          {/* Language Toggle */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-700 dark:text-zinc-300 text-xs font-semibold border border-white/60 dark:border-white/10 transition-all active:scale-95"
            title="Ganti Bahasa"
          >
            <Globe className="w-3.5 h-3.5 text-sky-500" />
            <span>{language.toUpperCase()}</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-700 dark:text-zinc-300 text-xs font-semibold border border-white/60 dark:border-white/10 transition-all active:scale-95"
            title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
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
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-300/30 dark:border-rose-500/20 transition-all active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t.auth.logout}</span>
        </button>
      </div>
    </aside>
  );
};
