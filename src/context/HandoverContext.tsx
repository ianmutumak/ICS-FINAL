import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppThemeConfig, SusEvaluationRecord } from '../types';
import { INITIAL_ACTIVE_HANDOVER, SEED_SUS_EVALUATIONS } from '../data/seedData';
import { SyncState, loadInitialFromFirestore, syncAllToFirestore } from '../lib/firestoreService';
import { isClosedShift } from '../lib/shiftRules';
import { STORAGE_KEYS, readStored, usePersistedState } from './storage';
import { useAuth } from './useAuth';
import { useFacility } from './useFacility';
import { useShift } from './useShift';

export { MASTER_ADMIN_PASSKEY } from './useAuth';
export { calculateHEI } from '../lib/shiftRules';

export type NavigationTab = 'roster' | 'active-handover' | 'tasks' | 'analytics' | 'archive' | 'admin';

/**
 * Everything the screens can read or do. It is assembled from three modules:
 *   useAuth      staff accounts and the current session
 *   useFacility  zones, workstream categories and incidents
 *   useShift     the open handover, tasks, signatures, approval and the archive
 */
type HandoverContextType =
  & Omit<ReturnType<typeof useAuth>, never>
  & Omit<ReturnType<typeof useFacility>, 'setDepartments' | 'setIncidents'>
  & Omit<ReturnType<typeof useShift>, 'setActiveHandover' | 'setArchive' | 'setTasks'>
  & {
    activeTab: NavigationTab;
    setActiveTab: (tab: NavigationTab) => void;

    // Cloud database status
    dbSyncStatus: SyncState;
    isSyncing: boolean;
    syncWithDatabase: () => Promise<boolean>;

    // System Usability Scale evaluations (Brooke, 1996)
    susEvaluations: SusEvaluationRecord[];
    addSusEvaluation: (evaluation: Omit<SusEvaluationRecord, 'id' | 'timestamp'>) => void;

    themeConfig: AppThemeConfig;
    setThemeConfig: React.Dispatch<React.SetStateAction<AppThemeConfig>>;
  };

const HandoverContext = createContext<HandoverContextType | undefined>(undefined);

const DEFAULT_THEME: AppThemeConfig = {
  fontDisplay: 'Plus Jakarta Sans',
  colorTheme: 'industrial-slate',
  sector: 'kq_bonded_freight',
  isDark: false,
};

export const HandoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('active-handover');
  const [dbSyncStatus, setDbSyncStatus] = useState<SyncState>('synced');
  const [isSyncing, setIsSyncing] = useState(false);

  const [themeConfig, setThemeConfig] = usePersistedState<AppThemeConfig>(
    STORAGE_KEYS.theme,
    () => readStored<AppThemeConfig>(STORAGE_KEYS.theme) ?? DEFAULT_THEME
  );
  const [susEvaluations, setSusEvaluations] = usePersistedState<SusEvaluationRecord[]>(
    STORAGE_KEYS.susEvaluations,
    () => readStored<SusEvaluationRecord[]>(STORAGE_KEYS.susEvaluations) ?? SEED_SUS_EVALUATIONS
  );

  const auth = useAuth(
    (isAdmin) => setActiveTab(isAdmin ? 'admin' : 'active-handover'),
    () => setActiveTab('active-handover')
  );
  const { setDepartments, setIncidents, ...facility } = useFacility(auth.currentUser);
  const { setActiveHandover, setArchive, setTasks, ...shift } = useShift({
    isAuthenticated: auth.isAuthenticated,
    hasAdminClearance: auth.hasAdminClearance,
    currentUser: auth.currentUser,
    departments: facility.departments,
    selectedDepartmentId: facility.selectedDepartmentId,
    sector: themeConfig.sector,
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeConfig.isDark);
  }, [themeConfig.isDark]);

  // Load the shared records from Firestore once, without blocking the first render.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cloudData = await loadInitialFromFirestore();
        if (!isMounted || !cloudData) return;
        if (cloudData.departments?.length) setDepartments(cloudData.departments);
        if (cloudData.tasks?.length) setTasks(cloudData.tasks);
        if (cloudData.incidents?.length) setIncidents(cloudData.incidents);
        if (cloudData.shifts?.length) {
          const cloudArchive = cloudData.shifts.filter(isClosedShift);
          const cloudClosedIds = new Set(cloudArchive.map((s) => s.id));
          if (cloudArchive.length > 0) {
            setArchive((prev) =>
              [...cloudArchive, ...prev.filter((s) => !cloudClosedIds.has(s.id))].sort((a, b) =>
                (b.completedAt || '').localeCompare(a.completedAt || '')
              )
            );
          }
          // Resume the most recently started open shift. Blank drafts are ignored.
          const cloudActive = cloudData.shifts
            .filter((s) => !isClosedShift(s) && s.handoverCode)
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
          setActiveHandover((prev) => {
            if (!cloudActive) return cloudClosedIds.has(prev.id) ? INITIAL_ACTIVE_HANDOVER : prev;
            const localIsNewer = prev.id !== cloudActive.id && Boolean(prev.handoverCode) &&
              !cloudClosedIds.has(prev.id) && (prev.createdAt || '') > (cloudActive.createdAt || '');
            return localIsNewer ? prev : cloudActive;
          });
        }
        setDbSyncStatus('synced');
      } catch {
        setDbSyncStatus('offline');
      }
    })();
    return () => {
      isMounted = false;
    };
    // Runs once on start-up; the setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { activeHandover, tasks } = shift;
  const { departments, incidents } = facility;
  const syncWithDatabase = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    setDbSyncStatus('saving');
    try {
      const ok = await syncAllToFirestore({ activeHandover, tasks, departments, incidents });
      setDbSyncStatus(ok ? 'synced' : 'offline');
      return ok;
    } catch {
      setDbSyncStatus('error');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [activeHandover, tasks, departments, incidents]);

  const addSusEvaluation = (evaluation: Omit<SusEvaluationRecord, 'id' | 'timestamp'>) => {
    const record: SusEvaluationRecord = {
      ...evaluation,
      id: `sus-${Date.now().toString(36)}`,
      timestamp: new Date().toLocaleString([], {
        year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }),
    };
    setSusEvaluations((prev) => [record, ...prev]);
  };

  return (
    <HandoverContext.Provider
      value={{
        ...auth,
        ...facility,
        ...shift,
        activeTab,
        setActiveTab,
        dbSyncStatus,
        isSyncing,
        syncWithDatabase,
        susEvaluations,
        addSusEvaluation,
        themeConfig,
        setThemeConfig,
      }}
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
