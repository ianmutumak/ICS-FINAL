import React from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';
import { ZamuLogoIcon } from '../common/CustomSvgIcons';

export const Header: React.FC = () => {
  const { currentUser, hasAdminClearance, setActiveTab, signOutUser } = useHandover();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <button onClick={() => setActiveTab('active-handover')} className="flex items-center gap-2.5 text-left">
          <ZamuLogoIcon className="h-7 w-7 text-teal-600 dark:text-teal-400" />
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">ZAMU-CHECK</span>
        </button>
        <div className="flex items-center gap-3">
          {hasAdminClearance && currentUser.isAdmin && (
            <>
              <button onClick={() => setActiveTab('active-handover')} className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300">Handover</button>
              <button onClick={() => setActiveTab('admin')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <ShieldCheck className="h-4 w-4" /> Admin
              </button>
              <button onClick={() => setActiveTab('analytics')} className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300">Statistics</button>
            </>
          )}
          <span className="hidden text-sm text-slate-600 dark:text-slate-300 sm:block">{currentUser.name}</span>
          <button onClick={signOutUser} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Sign out">
            <LogOut className="h-4 w-4" /><span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
