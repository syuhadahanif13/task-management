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
    <aside className="mac-sidebar hidden lg:flex flex-col w-60 shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto">
      {/* Logo / Brand */}
      <div className="p-4 border-b border-notion-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0">
            <img
              src="https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/1871f1632174b485181d942f9d5e61b6.png"
              alt="Logo"
              className="h-8 w-8 object-contain rounded-lg"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-notion-text leading-tight">Meeting Hub</p>
            <p className="text-[10px] text-notion-text-secondary">Task Management</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-notion-border space-y-1.5">
        <button
          onClick={onOpenNewMeeting}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-ios-blue text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>{t.meetings.newMeeting}</span>
        </button>
        <button
          onClick={onOpenAddTask}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-ios-indigo border border-indigo-200/60 dark:border-indigo-800/60 text-sm font-semibold transition-all hover:bg-indigo-100 dark:hover:bg-indigo-900/40 active:scale-95"
        >
          <CheckSquare className="w-4 h-4 shrink-0" />
          <span>{t.tasks.addTask}</span>
        </button>
        <button
          onClick={onOpenAiExtract}
          className="w-full mac-sidebar-item gap-2.5 text-xs py-1.5"
        >
          <Sparkles className="w-4 h-4 shrink-0 text-ios-indigo" />
          <span>AI Extract Notula</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="mac-section-header mt-1 mb-1">Workspace</p>
        {navItems.map(({ tab, label, icon: Icon, badge }) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`mac-sidebar-item w-full text-left ${isActive(tab) ? 'active' : ''}`}
          >
            <Icon className="sidebar-icon" />
            <span className="flex-1 text-sm">{label}</span>
            {badge !== undefined && badge > 0 && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  isActive(tab)
                    ? 'bg-ios-blue/20 text-ios-blue'
                    : 'bg-notion-border text-notion-text-secondary'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        ))}

        <div className="pt-3 border-t border-notion-border mt-3">
          <p className="mac-section-header mb-1">Pengaturan</p>
          <button
            onClick={() => onTabChange('settings')}
            className={`mac-sidebar-item w-full text-left ${isActive('settings') ? 'active' : ''}`}
          >
            <Settings className="sidebar-icon" />
            <span className="text-sm">{t.nav.settings}</span>
          </button>
        </div>
      </nav>

      {/* Bottom: Toggles + Logout */}
      <div className="p-3 border-t border-notion-border space-y-1">
        {/* Language toggle */}
        <button
          onClick={onToggleLanguage}
          className="mac-sidebar-item w-full"
          title="Toggle Language"
        >
          <Globe className="sidebar-icon" />
          <span className="text-sm">{language === 'id' ? 'Bahasa Indonesia' : 'English'}</span>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={onToggleDarkMode}
          className="mac-sidebar-item w-full"
          title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
        >
          {isDarkMode ? (
            <Sun className="sidebar-icon text-ios-yellow" />
          ) : (
            <Moon className="sidebar-icon" />
          )}
          <span className="text-sm">{isDarkMode ? t.settings.lightMode : t.settings.darkMode}</span>
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="mac-sidebar-item w-full text-notion-danger hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <LogOut className="sidebar-icon" />
          <span className="text-sm">{t.auth.logout}</span>
        </button>
      </div>
    </aside>
  );
};
