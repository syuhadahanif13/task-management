import React from 'react';
import { AppTab } from '../types';
import { Translations } from '../i18n';
import {
  Sun,
  Moon,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

interface TopBarProps {
  currentTab?: AppTab;
  onBack?: () => void;
  pageTitle: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout?: () => void;
  t: Translations;
  language: 'id' | 'en';
  onToggleLanguage: () => void;
  onOpenNewMeeting?: () => void;
  onOpenAiExtract: () => void;
  onOpenAddTask?: () => void;
  // Mobile: whether to show back button (when in active-meeting)
  showBack?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onBack,
  pageTitle,
  isDarkMode,
  onToggleDarkMode,
  t,
  language,
  onToggleLanguage,
  onOpenAiExtract,
  showBack,
}) => {
  return (
    <header className="lg:hidden sticky top-0 z-30 border-b border-notion-border ios-frosted">
      {/* MOBILE TOPBAR - Dribbble Task Management App Style */}
      <div className="flex items-center justify-between px-4 py-3 min-h-[58px]">
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

        {/* Right: Essential quick mobile actions (AI + Lang + Theme) */}
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
    </header>
  );
};
