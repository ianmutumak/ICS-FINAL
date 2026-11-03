import React from 'react';
import { useHandover } from '../../context/HandoverContext';
import { ZamuLogoIcon } from '../common/CustomSvgIcons';
import { SlidersHorizontal, Moon, Sun, Lock, LogOut } from 'lucide-react';

interface HeaderProps {
  onOpenPersonalization: () => void;
  onOpenSignoff: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenPersonalization,
  onOpenSignoff,
  onOpenAuthModal,
}) => {
  const {
    activeTab,
    setActiveTab,
    activeHandover,
    themeConfig,
    setThemeConfig,
    currentUser,
    hasAdminClearance,
    signOutUser,
  } = useHandover();

  const isSigned =
    activeHandover.signoff.outgoingConfirmed && activeHandover.signoff.incomingConfirmed;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          {/* Zone 1: Brand Wordmark (Single element) */}
          <button
            onClick={() => setActiveTab('roster')}
            className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
          >
            <div className="text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
              <ZamuLogoIcon className="w-8 h-8" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap block leading-none">
                ZAMU-CHECK
              </span>
              <span className="text-[10px] tracking-wider text-slate-400 dark:text-slate-500 font-mono uppercase block pt-0.5">
                Shift Turnover & Governance
              </span>
            </div>
          </button>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
            <button
              onClick={() => setActiveTab('roster')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 text-sm ${
                activeTab === 'roster'
                  ? 'text-teal-700 dark:text-teal-400 font-semibold border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Roster & Rotation
            </button>
            <button
              onClick={() => setActiveTab('active-handover')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 text-sm ${
                activeTab === 'active-handover'
                  ? 'text-teal-700 dark:text-teal-400 font-semibold border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Active Handover
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 text-sm ${
                activeTab === 'tasks'
                  ? 'text-teal-700 dark:text-teal-400 font-semibold border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Task Manager
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 text-sm ${
                activeTab === 'analytics'
                  ? 'text-teal-700 dark:text-teal-400 font-semibold border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Analytics & Audits
            </button>
            <button
              onClick={() => setActiveTab('archive')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 text-sm ${
                activeTab === 'archive'
                  ? 'text-teal-700 dark:text-teal-400 font-semibold border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Shift Archive
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action + Utility Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Authenticated Staff Button */}
            <button
              onClick={onOpenAuthModal}
              title="Click to switch staff profile or view credentials"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer text-left"
            >
              <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-[10px] font-bold flex items-center justify-center font-mono">
                {currentUser.avatarSeed}
              </div>
              <div className="hidden xl:block">
                <span className="text-xs font-semibold text-slate-900 dark:text-white block leading-none truncate max-w-[110px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-400 block pt-0.5 truncate max-w-[110px]">
                  {hasAdminClearance && currentUser.isAdmin ? 'Verified Admin' : currentUser.role}
                </span>
              </div>
            </button>

            {/* Sign Out Button to return to Auth Gateway */}
            <button
              onClick={signOutUser}
              title="Sign out of ZAMU-CHECK"
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Quick Personalization trigger */}
            <button
              onClick={onOpenPersonalization}
              title="Customize Fonts & Theme Palettes"
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Dark / Circadian Mode Toggle */}
            <button
              onClick={() => setThemeConfig((prev) => ({ ...prev, isDark: !prev.isDark }))}
              title={themeConfig.isDark ? 'Switch to Day Mode' : 'Switch to Circadian Night Mode'}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {themeConfig.isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Primary Action Button */}
            <button
              onClick={onOpenSignoff}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                isSigned
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-teal-700 hover:bg-teal-800 text-white shadow-xs dark:bg-teal-600 dark:hover:bg-teal-500'
              }`}
            >
              {isSigned ? 'View Sign-Off Seal' : 'Sign Handover'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
