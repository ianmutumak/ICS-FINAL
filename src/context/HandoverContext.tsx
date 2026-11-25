import React, { createContext, useCallback, useContext, useState } from 'react';
import './storage';
import { useAuth } from './useAuth';
import { useFacility } from './useFacility';
import { useForecastReview } from './useForecastReview';
import { useShift } from './useShift';

export type NavigationTab = 'roster' | 'active-handover' | 'tasks' | 'analytics' | 'archive' | 'admin';

/**
 * Everything the screens can read or do. It is assembled from four modules:
 *   useAuth            the signed-in user and the session
 *   useFacility        zones, workstream categories and incidents
 *   useShift           the open handover, signatures, approval and the archive
 *   useForecastReview  administrator decisions about forecast warnings
 * All records live on the server; these hooks send requests and show the results.
 */
type HandoverContextType =
  & ReturnType<typeof useAuth>
  & ReturnType<typeof useFacility>
  & ReturnType<typeof useShift>
  & ReturnType<typeof useForecastReview>
  & {
    activeTab: NavigationTab;
    setActiveTab: (tab: NavigationTab) => void;
    /** The latest error from the server, shown to the person until they dismiss it or the next action succeeds. */
    notice: string | null;
    dismissNotice: () => void;
    /** A section of the administrator console to open, set by an alert that links to it. */
    adminSection: string | null;
    openAdminSection: (section: string) => void;
    clearAdminSection: () => void;
  };

const HandoverContext = createContext<HandoverContextType | undefined>(undefined);

export const HandoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('active-handover');
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [adminSection, setAdminSection] = useState<string | null>(null);
  const openAdminSection = useCallback((section: string) => {
    setAdminSection(section);
    setActiveTab('admin');
  }, []);
  const clearAdminSection = useCallback(() => setAdminSection(null), []);

  const onSignedIn = useCallback((isAdmin: boolean) => {
    setNotice(null);
    setActiveTab(isAdmin ? 'admin' : 'active-handover');
  }, []);
  const onSignedOut = useCallback(() => {
    setNotice(null);
    setActiveTab('active-handover');
  }, []);

  const auth = useAuth(onSignedIn, onSignedOut);
  const facility = useFacility({ isAuthenticated: auth.isAuthenticated, hasAdminClearance: auth.hasAdminClearance, reportError: setNotice });
  const shift = useShift({
    isAuthenticated: auth.isAuthenticated,
    hasAdminClearance: auth.hasAdminClearance,
    currentUser: auth.currentUser,
    reportError: setNotice,
  });
  const review = useForecastReview(auth.hasAdminClearance, setNotice);

  return (
    <HandoverContext.Provider
      value={{ ...auth, ...facility, ...shift, ...review, activeTab, setActiveTab, notice, dismissNotice, adminSection, openAdminSection, clearAdminSection }}
    >
      {children}
    </HandoverContext.Provider>
  );
};

export const useHandover = () => {
  const context = useContext(HandoverContext);
  if (!context) {
    throw new Error('useHandover must be used within a HandoverProvider');
  }
  return context;
};
