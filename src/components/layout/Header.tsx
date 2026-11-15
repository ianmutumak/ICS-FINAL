import React from 'react';
import { LogOut } from 'lucide-react';
import { useHandover, NavigationTab } from '../../context/HandoverContext';
import { ZamuLogoIcon } from '../common/CustomSvgIcons';

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

export const Header: React.FC = () => {
  const { currentUser, hasAdminClearance, activeTab, setActiveTab, signOutUser } = useHandover();
  const isAdmin = hasAdminClearance && Boolean(currentUser.isAdmin);

  const tabs: { id: NavigationTab; label: string }[] = [
    { id: 'active-handover', label: 'Handover' },
    { id: 'admin', label: 'Admin' },
    { id: 'analytics', label: 'Statistics' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button onClick={() => setActiveTab('active-handover')} className="flex items-center gap-2.5 rounded-lg text-left">
          <ZamuLogoIcon className="h-8 w-8 text-teal-700 dark:text-teal-400" />
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Zamu-Check
          </span>
        </button>

        {isAdmin && (
          <nav aria-label="Main" className="flex items-center gap-1 rounded-full bg-slate-200/70 p-1 dark:bg-slate-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
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

        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{currentUser.name}</p>
            <p className="max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
              {isAdmin ? 'Administrator' : currentUser.role || 'Staff member'}
            </p>
          </div>
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
            {initialsOf(currentUser.name)}
          </span>
          <button
            onClick={signOutUser}
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
