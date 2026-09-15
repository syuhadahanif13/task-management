import React from 'react';
import { Calendar, Plus, Sparkles, CheckSquare, Search, BookOpen, LogOut } from 'lucide-react';

interface HeaderProps {
  currentTab: 'meetings' | 'active-meeting' | 'all-tasks';
  onTabChange: (tab: 'meetings' | 'all-tasks') => void;
  onOpenNewMeeting: () => void;
  onOpenAiExtract: () => void;
  onOpenSupabaseModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  meetingCount: number;
  taskCount: number;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  onOpenNewMeeting,
  onOpenAiExtract,
  onOpenSupabaseModal,
  searchQuery,
  onSearchChange,
  meetingCount,
  taskCount,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & System Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9">
              <img
                src="https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/1871f1632174b485181d942f9d5e61b6.png"
                alt="Logo"
                className="w-9 h-9 object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-zinc-900 tracking-tight">
                  Meeting Task Management
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                  Relational Core
                </span>
              </div>
              <p className="text-xs text-zinc-500 hidden md:block">
                Sistem Pengelolaan Notula Rapat & Tindak Lanjut Terstruktur
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              placeholder="Cari rapat, peserta, atau tugas..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-colors"
            />
          </div>

          {/* Action CTA Buttons */}
          <div className="flex items-center gap-2">
            <button
              id="header-ai-extract-btn"
              onClick={onOpenAiExtract}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 rounded-lg border border-zinc-200 transition-colors"
              title="Ekstraksi otomatis 4 data inti dari notula menggunakan AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>AI Parse Notula</span>
            </button>

            <button
              id="header-new-meeting-btn"
              onClick={onOpenNewMeeting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 active:bg-black rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Rapat</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-t border-zinc-100 pt-2 pb-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1">
            <button
              id="nav-tab-meetings"
              onClick={() => onTabChange('meetings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${currentTab === 'meetings' || currentTab === 'active-meeting'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Daftar Rapat & Notula</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${currentTab === 'meetings' || currentTab === 'active-meeting'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-200 text-zinc-700'
                }`}>
                {meetingCount}
              </span>
            </button>

            <button
              id="nav-tab-tasks"
              onClick={() => onTabChange('all-tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${currentTab === 'all-tasks'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Semua Tindak Lanjut (Tasks)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${currentTab === 'all-tasks'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-200 text-zinc-700'
                }`}>
                {taskCount}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
