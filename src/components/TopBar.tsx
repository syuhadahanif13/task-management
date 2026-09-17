import React from 'react';
import { AppTab } from '../types';
import { Translations } from '../i18n';
import {
  Sun,
  Moon,
  LogOut,
  Globe,
  ChevronLeft,
  Plus,
  Sparkles,
  CheckSquare,
} from 'lucide-react';

interface TopBarProps {
  currentTab: AppTab;
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
  // Mobile: whether to show back button (when in active-meeting)
  showBack?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
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
  showBack,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-notion-border ios-frosted">
      {/* ────────────────────────────────────────────────────────────
          MOBILE TOPBAR (lg:hidden) - Dribbble Task Management App Style
          Clean, spacious, uncrowded: App Brand / Back + Title + Quick Actions
         ──────────────────────────────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 min-h-[58px]">
        {/* Left: Back button or Logo + Contextual Subtitle */}
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          {showBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1 -ml-1.5 p-2 rounded-xl text-ios-blue hover:bg-notion-hover active:scale-95 transition-all"
              aria-label="Kembali"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              <span className="text-sm font-semibold truncate max-w-[140px]">{t.common.back}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white dark:bg-zinc-800 p-1 shadow-sm border border-notion-border flex items-center justify-center shrink-0">
                <img
                  src="https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/1871f1632174b485181d942f9d5e61b6.png"
                  alt="Logo"
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-notion-text leading-tight truncate">
                  {pageTitle}
                </h1>
                <p className="text-[11px] text-notion-text-secondary font-medium tracking-tight">
                  Meeting & Task Hub
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Only the 2 most essential, beautiful mobile icons (AI + Theme) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* AI Extract Assistant */}
          <button
            onClick={onOpenAiExtract}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-ios-indigo border border-indigo-200/50 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-95 transition-all shadow-xs"
            title="AI Extract Notula"
            aria-label="AI Extract"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Quick Language Toggle */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center justify-center h-9 px-2.5 rounded-xl border border-notion-border bg-notion-bg text-notion-text-secondary hover:text-notion-text text-[11px] font-bold active:scale-95 transition-all"
            title="Ganti Bahasa / Change Language"
          >
            {language.toUpperCase()}
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-notion-border bg-notion-bg text-notion-text-secondary hover:text-notion-text active:scale-95 transition-all"
            title={isDarkMode ? t.settings.lightMode : t.settings.darkMode}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-ios-yellow" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          DESKTOP TOPBAR (hidden lg:flex) - macOS Window Style
          Clean typography, breadcrumb style, full action bar
         ──────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex items-center h-14 px-6 gap-4">
        {/* Page Title & Breadcrumb */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-xl text-ios-blue hover:bg-notion-hover transition-colors"
              title="Kembali"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-base font-bold text-notion-text truncate">{pageTitle}</h1>
        </div>

        {/* Desktop Actions */}
        <div className="flex items-center gap-2">
          {/* AI Extract */}
          <button
            onClick={onOpenAiExtract}
            className="notion-btn notion-btn-ghost text-xs px-3 py-1.5 text-ios-indigo hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            title="AI Extract Notula"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-semibold">AI Extract</span>
          </button>

          {/* Add Task */}
          {onOpenAddTask && (
            <button
              onClick={onOpenAddTask}
              className="notion-btn bg-indigo-50 dark:bg-indigo-950/40 text-ios-indigo border border-indigo-200/60 dark:border-indigo-800/60 text-xs px-3 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 font-semibold"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{t.tasks.addTask}</span>
            </button>
          )}

          {/* New Meeting */}
          <button
            onClick={onOpenNewMeeting}
            className="notion-btn notion-btn-primary text-xs px-3.5 py-1.5 shadow-sm font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.meetings.newMeeting}</span>
          </button>

          <div className="h-4 w-px bg-notion-border mx-1" />

          {/* Language toggle */}
          <button
            onClick={onToggleLanguage}
            className="notion-btn notion-btn-ghost text-xs px-2.5 py-1.5 border border-notion-border"
            title="Ganti Bahasa / Change Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{language.toUpperCase()}</span>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDarkMode}
            className="notion-btn notion-btn-ghost text-xs p-2"
            title={isDarkMode ? t.settings.lightMode : t.settings.darkMode}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-ios-yellow" />
            ) : (
              <Moon className="w-4 h-4 text-notion-text-secondary" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="notion-btn notion-btn-ghost text-xs p-2 text-notion-text-secondary hover:text-red-500"
            title={t.auth.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
