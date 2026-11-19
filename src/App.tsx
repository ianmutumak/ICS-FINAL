import React, { useState } from 'react';
import { HandoverProvider, useHandover } from './context/HandoverContext';
import { Header } from './components/layout/Header';
import { ActiveHandoverView } from './components/dashboard/ActiveHandoverView';
import { StatisticsAnalyticsView } from './components/analytics/StatisticsAnalyticsView';
import { AdminConsoleView } from './components/admin/AdminConsoleView';
import { AuthGatewayView } from './components/auth/AuthGatewayView';
import { NewCaseModal } from './components/modals/NewCaseModal';
import { SignoffModal } from './components/modals/SignoffModal';
import { NewShiftModal } from './components/modals/NewShiftModal';

function AppContent() {
  const { activeTab, isAuthenticated, hasAdminClearance, currentUser, authReady, notice, dismissNotice } = useHandover();

  const [isSignoffOpen, setIsSignoffOpen] = useState(false);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isNewShiftOpen, setIsNewShiftOpen] = useState(false);

  // While the server is asked whether a session already exists, show nothing that could flash the sign-in screen.
  if (!authReady) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950">Loading…</div>;
  }

  // Dedicated Full-Screen Authentication Gate
  if (!isAuthenticated) {
    return <AuthGatewayView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Header adhering strictly to Top Bar Contract */}
      <Header />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {notice && (
          <div role="alert" className="no-print mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-base text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
            <span>{notice}</span>
            <button type="button" onClick={dismissNotice} className="shrink-0 text-sm font-semibold underline">Dismiss</button>
          </div>
        )}
        {activeTab === 'active-handover' && (
          <ActiveHandoverView
            onOpenNewCase={() => setIsNewCaseOpen(true)}
            onOpenSignoff={() => setIsSignoffOpen(true)}
            onOpenNewShift={() => setIsNewShiftOpen(true)}
          />
        )}

        {activeTab === 'analytics' && hasAdminClearance && <StatisticsAnalyticsView />}

        {activeTab === 'admin' && hasAdminClearance && currentUser.isAdmin && (
          <AdminConsoleView />
        )}
      </main>

      {/* Clean quiet corporate footer */}
      <footer className="no-print mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">ZAMU-CHECK</span>
            <span aria-hidden="true">·</span>
            <span>Shift Handover System</span>
          </div>
          <span className="text-[11px] text-slate-400">Shift records and SBAR handovers</span>
        </div>
      </footer>

      {/* Modals and Drawers */}
      <NewCaseModal isOpen={isNewCaseOpen} onClose={() => setIsNewCaseOpen(false)} />

      <SignoffModal isOpen={isSignoffOpen} onClose={() => setIsSignoffOpen(false)} />

      <NewShiftModal isOpen={isNewShiftOpen} onClose={() => setIsNewShiftOpen(false)} />

    </div>
  );
}

export default function App() {
  return (
    <HandoverProvider>
      <AppContent />
    </HandoverProvider>
  );
}
