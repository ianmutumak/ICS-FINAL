import React, { useState } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { EditProfileModal } from '../modals/EditProfileModal';
import { useTheme } from '../../lib/theme';
import { useHandover, NavigationTab } from '../../context/HandoverContext';
import { ZamuLogoIcon } from '../common/CustomSvgIcons';

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

export const Header: React.FC = () => {
  const { currentUser, hasAdminClearance, activeTab, setActiveTab, signOutUser } = useHandover();
  const [profileOpen, setProfileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isAdmin = hasAdminClearance && Boolean(currentUser.isAdmin);

  const tabs: { id: NavigationTab; label: string }[] = [
    { id: 'active-handover', label: 'Handover' },
    { id: 'admin', label: 'Admin' },
    { id: 'analytics', label: 'Statistics' },
  ];

  return (
    <>
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <button onClick={() => setActiveTab('active-handover')} className="flex items-center gap-2.5 rounded-lg text-left">
          <ZamuLogoIcon className="h-8 w-8 text-teal-700 dark:text-teal-400" />
          <span className={`whitespace-nowrap font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-slate-900 dark:text-white ${isAdmin ? 'hidden sm:inline' : ''}`}>
            Zamu-Check
          </span>
        </button>

        {isAdmin && (
          <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5 rounded-full bg-slate-200/70 p-1 dark:bg-slate-800 sm:gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3.5 sm:text-sm ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {/* With the admin navigation in the bar there is less room, so the name appears later. */}
          <div className={`hidden whitespace-nowrap text-right leading-tight ${isAdmin ? 'lg:block' : 'sm:block'}`}>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{currentUser.name}</p>
            <p className="max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
              {isAdmin ? 'Administrator' : currentUser.role || 'Staff member'}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="inline-flex items-center rounded-lg px-2 py-2 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Edit profile"
            title="Edit profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-700 text-sm font-bold text-white ring-offset-2 hover:ring-2 hover:ring-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600 dark:ring-offset-slate-900"
          >
            {currentUser.photo
              ? <img src={currentUser.photo} alt="" className="h-full w-full object-cover" />
              : <span aria-hidden="true">{initialsOf(currentUser.name)}</span>}
          </button>
          <button
            onClick={signOutUser}
            aria-label="Sign out"
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            <span className={`hidden whitespace-nowrap ${isAdmin ? 'lg:inline' : 'sm:inline'}`}>Sign out</span>
          </button>
        </div>
      </div>
    </header>
    {profileOpen && <EditProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  );
};
