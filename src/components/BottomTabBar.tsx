import React from 'react';
import { AppTab } from '../types';
import { Translations } from '../i18n';
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  CheckSquare,
  Users,
} from 'lucide-react';

interface BottomTabBarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  t: Translations;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentTab,
  onTabChange,
  t,
}) => {
  const tabs = [
    { tab: 'dashboard' as AppTab, label: t.nav.dashboard, icon: LayoutDashboard },
    { tab: 'calendar' as AppTab, label: t.nav.calendar, icon: CalendarDays },
    { tab: 'meetings' as AppTab, label: t.nav.meetings, icon: BookOpen },
    { tab: 'all-tasks' as AppTab, label: t.nav.tasks, icon: CheckSquare },
    { tab: 'team' as AppTab, label: t.nav.team, icon: Users },
  ];

  const isActive = (tab: AppTab) => {
    if (tab === 'meetings') return currentTab === 'meetings' || currentTab === 'active-meeting';
    return currentTab === tab;
  };

  return (
    <nav className="ios-tab-bar lg:hidden">
      {tabs.map(({ tab, label, icon: Icon }) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`ios-tab-item ${isActive(tab) ? 'active' : ''}`}
        >
          <Icon className="tab-icon" />
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
};
