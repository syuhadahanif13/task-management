import React from 'react';
import { AppTab } from '../types';
import { Translations } from '../i18n';
import {
  Home,
  ClipboardList,
  Calendar,
  User,
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
    {
      tab: 'dashboard' as AppTab,
      label: 'Home',
      icon: Home,
      isActive: currentTab === 'dashboard',
    },
    {
      tab: 'all-tasks' as AppTab,
      label: 'Tugas',
      icon: ClipboardList,
      isActive: currentTab === 'all-tasks' || currentTab === 'meetings' || currentTab === 'active-meeting',
    },
    {
      tab: 'calendar' as AppTab,
      label: 'Calendar',
      icon: Calendar,
      isActive: currentTab === 'calendar',
    },
    {
      tab: 'team' as AppTab,
      label: 'Profile',
      icon: User,
      isActive: currentTab === 'team' || currentTab === 'settings',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 py-2 px-6 shadow-2xl flex items-center justify-around lg:hidden">
      {tabs.map(({ tab, label, icon: Icon, isActive }) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex flex-col items-center justify-center transition-all ${
            isActive ? 'scale-105' : 'opacity-60 hover:opacity-90'
          }`}
        >
          <div
            className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-2xl transition-all ${
              isActive
                ? 'bg-[#18191d] dark:bg-white text-white dark:text-black shadow-md'
                : 'text-gray-500 dark:text-zinc-400'
            }`}
          >
            <Icon className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-extrabold mt-0.5 tracking-tight">
              {label}
            </span>
          </div>
        </button>
      ))}
    </nav>
  );
};
