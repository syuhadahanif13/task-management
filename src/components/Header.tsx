import React from 'react';
import { Plus, Sparkles, BookOpen, LogOut, CheckSquare, Sun, Moon, Users } from 'lucide-react';

interface HeaderProps {
  currentTab: 'meetings' | 'active-meeting' | 'all-tasks' | 'settings';
  onTabChange: (tab: 'meetings' | 'all-tasks' | 'settings') => void;
  onOpenNewMeeting: () => void;
  onOpenAiExtract: () => void;
  onOpenAddTask?: () => void;
  meetingCount: number;
  taskCount: number;
  onLogout?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  onOpenNewMeeting,
  onOpenAiExtract,
  onOpenAddTask,
  meetingCount,
  taskCount,
  onLogout,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-notion-border bg-notion-bg/90 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-8 w-8 object-contain"
              />
            </div>
            <span className="text-sm font-semibold text-notion-text">Meeting Task Management</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {onToggleDarkMode && (
              <button
                onClick={onToggleDarkMode}
                className="notion-btn notion-btn-ghost text-xs"
                title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              >
                {isDarkMode ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            <button
              onClick={onOpenAiExtract}
              className="notion-btn notion-btn-ghost text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI Parse</span>
            </button>

            <button
              onClick={onOpenNewMeeting}
              className="notion-btn notion-btn-primary text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Meeting</span>
            </button>

            {onOpenAddTask && (
              <button
                onClick={onOpenAddTask}
                className="notion-btn notion-btn-primary text-xs"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tambah Task</span>
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="notion-btn notion-btn-ghost text-xs"
                title="Keluar"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-notion-border py-2">
          <nav className="flex items-center gap-1">
            <button
              onClick={() => onTabChange('meetings')}
              className={`notion-btn text-xs ${
                currentTab === 'meetings' || currentTab === 'active-meeting'
                  ? 'bg-notion-hover text-notion-text'
                  : 'text-notion-text-secondary hover:bg-notion-hover'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Meetings</span>
              <span className="ml-1 rounded-md bg-notion-hover px-1.5 py-0.5 text-[10px] font-medium">
                {meetingCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange('all-tasks')}
              className={`notion-btn text-xs ${
                currentTab === 'all-tasks'
                  ? 'bg-notion-hover text-notion-text'
                  : 'text-notion-text-secondary hover:bg-notion-hover'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Tasks</span>
              <span className="ml-1 rounded-md bg-notion-hover px-1.5 py-0.5 text-[10px] font-medium">
                {taskCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange('settings')}
              className={`notion-btn text-xs ${
                currentTab === 'settings'
                  ? 'bg-notion-hover text-notion-text'
                  : 'text-notion-text-secondary hover:bg-notion-hover'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};