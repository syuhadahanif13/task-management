import React from 'react';
import { AppTab } from '../types';
import { Translations } from '../i18n';
import { Sun, Moon, LogOut, Globe, Menu, ChevronLeft, Settings, Plus, Sparkles, CheckSquare } from 'lucide-react';

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
      <div className="flex items-center h-14 px-4 gap-3">
        {/* Mobile: Logo (shown on lg:hidden) */}
        <div className="lg:hidden flex items-center gap-2 mr-1">
          {showBack ? (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-notion-hover transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-ios-blue" />
            </button>
          ) : (
            <div className="h-7 w-7">
              <img
                src="https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/1871f1632174b485181d942f9d5e61b6.png"
                alt="Logo"
                className="h-7 w-7 object-contain rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Page Title */}
        <h1 className="flex-1 text-base font-bold text-notion-text truncate">{pageTitle}</h1>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* AI Extract — always visible */}
          <button
            onClick={onOpenAiExtract}
            className="notion-btn notion-btn-ghost text-xs px-2.5 py-1.5"
            title="AI Extract Notula"
          >
            <Sparkles className="w-3.5 h-3.5 text-ios-indigo" />
            <span className="hidden sm:inline text-xs">AI</span>
          </button>

          {/* Add Task */}
          {onOpenAddTask && (
            <button
              onClick={onOpenAddTask}
              className="notion-btn bg-indigo-50 dark:bg-indigo-950/40 text-ios-indigo border border-indigo-200/60 dark:border-indigo-800/60 text-xs px-2.5 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 font-medium"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.tasks.addTask}</span>
            </button>
          )}

          {/* New Meeting */}
          <button
            onClick={onOpenNewMeeting}
            className="notion-btn notion-btn-primary text-xs px-3 py-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.meetings.newMeeting}</span>
          </button>

          {/* Language toggle */}
          <button
            onClick={onToggleLanguage}
            className="notion-btn notion-btn-ghost text-xs px-2 py-1.5 border border-notion-border"
            title="Ganti Bahasa / Change Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{language.toUpperCase()}</span>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDarkMode}
            className="notion-btn notion-btn-ghost text-xs px-2 py-1.5"
            title={isDarkMode ? t.settings.lightMode : t.settings.darkMode}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-ios-yellow" />
            ) : (
              <Moon className="w-4 h-4 text-notion-text-secondary" />
            )}
          </button>

          {/* Logout — desktop only */}
          <button
            onClick={onLogout}
            className="hidden lg:flex notion-btn notion-btn-ghost text-xs px-2 py-1.5 text-notion-text-secondary hover:text-red-500"
            title={t.auth.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
