import React, { useState } from 'react';
import { HandoverProvider, useHandover } from './context/HandoverContext';
import { Header } from './components/layout/Header';
import { RosterRotationView } from './components/roster/RosterRotationView';
import { ActiveHandoverView } from './components/dashboard/ActiveHandoverView';
import { TaskManagerView } from './components/tasks/TaskManagerView';
import { StatisticsAnalyticsView } from './components/analytics/StatisticsAnalyticsView';
import { ArchiveView } from './components/dashboard/ArchiveView';
import { AdminConsoleView } from './components/admin/AdminConsoleView';
import { AuthGatewayView } from './components/auth/AuthGatewayView';
import { AuthModal } from './components/auth/AuthModal';
import { NewCaseModal } from './components/modals/NewCaseModal';
import { SignoffModal } from './components/modals/SignoffModal';
import { PersonalizationDrawer } from './components/customization/PersonalizationDrawer';
import { NewShiftModal } from './components/modals/NewShiftModal';

function AppContent() {
  const { activeTab, isAuthenticated, hasAdminClearance, currentUser } = useHandover();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [isSignoffOpen, setIsSignoffOpen] = useState(false);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isNewShiftOpen, setIsNewShiftOpen] = useState(false);

  // Dedicated Full-Screen Authentication Gate
  if (!isAuthenticated) {
    return <AuthGatewayView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Header adhering strictly to Top Bar Contract */}
      <Header
        onOpenPersonalization={() => setIsPersonalizationOpen(true)}
        onOpenSignoff={() => setIsSignoffOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'roster' && (
          <RosterRotationView
            onOpenNewShift={() => setIsNewShiftOpen(true)}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'active-handover' && (
          <ActiveHandoverView
            onOpenNewCase={() => setIsNewCaseOpen(true)}
            onOpenSignoff={() => setIsSignoffOpen(true)}
          />
        )}

        {activeTab === 'tasks' && <TaskManagerView />}

        {activeTab === 'analytics' && <StatisticsAnalyticsView />}

        {activeTab === 'archive' && (
          <ArchiveView onStartNewShiftClick={() => setIsNewShiftOpen(true)} />
        )}

        {activeTab === 'admin' && hasAdminClearance && currentUser.isAdmin && (
          <AdminConsoleView />
        )}
      </main>

      {/* Clean quiet corporate footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">ZAMU-CHECK</span>
            <span aria-hidden="true">·</span>
            <span>Kenya Airways Cargo & Freight Hub · Shift Turnover System</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            <span>Non-Repudiation SBAR Protocol Ledger</span>
          </div>
        </div>
      </footer>

      {/* Modals and Drawers */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <NewCaseModal isOpen={isNewCaseOpen} onClose={() => setIsNewCaseOpen(false)} />

      <SignoffModal isOpen={isSignoffOpen} onClose={() => setIsSignoffOpen(false)} />

      <PersonalizationDrawer
        isOpen={isPersonalizationOpen}
        onClose={() => setIsPersonalizationOpen(false)}
      />

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
