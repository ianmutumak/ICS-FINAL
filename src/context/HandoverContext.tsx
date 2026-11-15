import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  HandoverRecord,
  SbarCase,
  EquipmentItem,
  ShiftActionItem,
  AppThemeConfig,
  UserStaff,
  DepartmentUnit,
  AttendanceAuditLog,
  SignoffComplianceRecord,
  ShiftType,
  IncidentRecord,
  AdminOverrideLog,
  SusEvaluationRecord,
  HandoverEffectivenessIndex,
} from '../types';
import {
  INITIAL_ACTIVE_HANDOVER,
  PAST_HANDOVER_ARCHIVE,
  SEED_STAFF,
  SEED_DEPARTMENTS,
  SEED_TASKS,
  SEED_ATTENDANCE_LOGS,
  SEED_INCIDENTS,
  SEED_OVERRIDE_LOGS,
  SEED_CATEGORIES,
  SEED_SUS_EVALUATIONS,
  UNASSIGNED_STAFF,
} from '../data/seedData';
import {
  saveShiftToFirestore,
  saveTaskToFirestore,
  deleteTaskFromFirestore,
  saveDepartmentToFirestore,
  deleteDepartmentFromFirestore,
  saveIncidentToFirestore,
  saveOverrideToFirestore,
  syncAllToFirestore,
  loadInitialFromFirestore,
  SyncState,
} from '../lib/firestoreService';

export type NavigationTab = 'roster' | 'active-handover' | 'tasks' | 'analytics' | 'archive' | 'admin';

export const MASTER_ADMIN_PASSKEY = 'ZAMU-ADMIN-2026';

const SHIFT_WINDOWS: Record<ShiftType, string> = {
  morning: '07:00 - 15:30',
  evening: '15:00 - 23:30',
  night: '23:00 - 07:30',
};

const NEXT_SHIFT: Record<ShiftType, ShiftType> = {
  morning: 'evening',
  evening: 'night',
  night: 'morning',
};

function makeHandoverCode(shiftType: ShiftType): string {
  return `ZAMU-${new Date().getFullYear()}-${shiftType.toUpperCase().slice(0, 3)}-${Math.floor(Math.random() * 900 + 100)}`;
}

// Calendar date in the device's own time zone (toISOString alone would give the UTC date).
function localDateString(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Whole minutes between two ISO timestamps. 0 means the duration could not be measured.
function minutesBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.max(1, Math.ceil(ms / 60000));
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Staff details that are safe to embed in shared records. The PIN stays in the staff list.
function toPublicStaff(staff: UserStaff): UserStaff {
  const { pin: _pin, ...publicFields } = staff;
  return publicFields;
}

const isClosedShift = (shift: HandoverRecord) => shift.status === 'completed' || shift.status === 'archived';

function readStored<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch {
    return null;
  }
}

export function calculateHEI(shift: HandoverRecord): HandoverEffectivenessIndex {
  const totalCases = shift.cases.length;
  let completedSbarCases = 0;
  shift.cases.forEach((c) => {
    if (c.situation?.trim() && c.assessment?.trim() && c.recommendation?.trim()) {
      completedSbarCases += 1;
    }
  });
  const sbarCompleteness = totalCases > 0 ? Math.round((completedSbarCases / totalCases) * 40) : 40;

  const criticalCases = shift.cases.filter((c) => c.acuity === 'critical' || c.acuity === 'unstable');
  const criticalAlertsTotal = criticalCases.length;
  const criticalAlertsAcknowledged = criticalCases.filter((c) => c.recommendation?.trim().length > 0 || Boolean(c.isolationOrHazardAlert)).length;
  const safetyAck = criticalAlertsTotal > 0 
    ? Math.round((criticalAlertsAcknowledged / criticalAlertsTotal) * 35) 
    : 35;

  const equipmentTotal = shift.equipment.length;
  const equipmentChecked = shift.equipment.filter((e) => e.custodyChecked).length;
  const equipmentCustody = equipmentTotal > 0 
    ? Math.round((equipmentChecked / equipmentTotal) * 25) 
    : 25;

  const unacknowledgedCritical = criticalAlertsTotal - criticalAlertsAcknowledged;
  const penalties = unacknowledgedCritical * 10;

  const rawScore = sbarCompleteness + safetyAck + equipmentCustody - penalties;
  const score = Math.max(0, Math.min(100, rawScore));

  let rating: HandoverEffectivenessIndex['rating'] = 'Deficient';
  if (score >= 85) rating = 'Optimal';
  else if (score >= 70) rating = 'Satisfactory';
  else if (score >= 50) rating = 'At-Risk';

  return {
    score,
    rating,
    breakdown: {
      sbarCompleteness,
      safetyAck,
      equipmentCustody,
      penalties,
    },
    details: {
      totalCases,
      completedSbarCases,
      criticalAlertsTotal,
      criticalAlertsAcknowledged,
      equipmentTotal,
      equipmentChecked,
      dualSignoffReady: shift.signoff.outgoingConfirmed && shift.signoff.incomingConfirmed,
    },
  };
}


interface HandoverContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;

  // Cloud Database Persistence & Status
  dbSyncStatus: SyncState;
  isSyncing: boolean;
  syncWithDatabase: () => Promise<boolean>;
  
  // Authentication & Clearance State
  isAuthenticated: boolean;
  hasAdminClearance: boolean;
  currentUser: UserStaff;
  staffList: UserStaff[];
  signInUser: (staffNumber: string, pin: string, adminPasskey?: string) => { success: boolean; error?: string };
  signUpUser: (userData: Omit<UserStaff, 'id' | 'avatarSeed'>, adminPasskey?: string) => { success: boolean; user?: UserStaff; error?: string };
  switchUser: (userId: string) => void;
  signOutUser: () => void;
  
  // Admin & RBAC Controls
  updateUserRole: (userId: string, newRole: string, isAdmin: boolean) => void;
  updateUserStatus: (userId: string, status: 'active' | 'on_leave' | 'suspended') => void;
  overrideShiftSignoff: (shiftId: string, reason: string) => void;
  incidents: IncidentRecord[];
  resolveIncident: (incidentId: string, notes: string, rootCause: string) => void;
  reportIncident: (incident: Omit<IncidentRecord, 'id' | 'reportedAt' | 'status'>) => void;
  overrideLogs: AdminOverrideLog[];

  // Facility Zones & Multi-Department Roster (Saved to DB)
  departments: DepartmentUnit[];
  selectedDepartmentId: string;
  setSelectedDepartmentId: (deptId: string) => void;
  assignStaffToRoster: (deptId: string, shiftType: ShiftType, staff: UserStaff) => void;
  addDepartment: (dept: { code: string; name: string; building: string; floor: string; capacity: number; headOfDepartment: string }) => DepartmentUnit;
  updateDepartment: (id: string, updatedFields: Partial<DepartmentUnit>) => void;
  deleteDepartment: (id: string) => void;

  // Operational Workstream Categories (Populated by Input / Admin)
  categories: string[];
  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;
  
  // Tasks Hub (Saved to DB)
  tasks: ShiftActionItem[];
  addTask: (task: Omit<ShiftActionItem, 'id' | 'status'>) => void;
  updateTaskStatus: (taskId: string, status: ShiftActionItem['status']) => void;
  toggleTaskStatus: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  
  // Active Handover (Saved to DB)
  activeHandover: HandoverRecord;
  archive: HandoverRecord[];
  updateSummaryNotes: (notes: string) => void;
  addCase: (newCase: Omit<SbarCase, 'id' | 'lastUpdated'>) => void;
  updateCase: (caseId: string, updatedFields: Partial<SbarCase>) => void;
  deleteCase: (caseId: string) => void;
  toggleEquipmentCustody: (itemId: string) => void;
  addEquipmentItem: (item: Omit<EquipmentItem, 'id' | 'custodyChecked'>) => void;
  
  // Sign-off
  signOutgoingLead: () => void;
  signIncomingLead: () => void;
  completeAndArchiveShift: () => void;
  startNewShift: (shiftType: ShiftType, wardName: string) => void;
  
  // Analytics & Audits
  attendanceLogs: AttendanceAuditLog[];
  complianceRecords: SignoffComplianceRecord[];
  
  // Live Handover Effectiveness Index (HEI)
  heiScore: HandoverEffectivenessIndex;

  // System Usability Scale (SUS - Brooke, 1996) Evaluations
  susEvaluations: SusEvaluationRecord[];
  addSusEvaluation: (evaluation: Omit<SusEvaluationRecord, 'id' | 'timestamp'>) => void;

  // Theme & Customization
  themeConfig: AppThemeConfig;
  setThemeConfig: React.Dispatch<React.SetStateAction<AppThemeConfig>>;
}


const HandoverContext = createContext<HandoverContextType | undefined>(undefined);

// Purge legacy storage caches (v1 to v6 templates)
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const legacyVersions = ['_v1', '_v2', '_v3', '_v4', '_v5', '_v6', 'templates'];
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('zamu_') && legacyVersions.some((ver) => key.includes(ver))) {
        localStorage.removeItem(key);
      }
    });
  }
} catch {
  // ignore
}

const STORAGE_ACTIVE_KEY = 'zamu_active_shift_v7';
const STORAGE_TASKS_KEY = 'zamu_tasks_v7';
const STORAGE_USER_KEY = 'zamu_current_user_v7';
const STORAGE_STAFF_KEY = 'zamu_staff_list_v7';
const STORAGE_DEPTS_KEY = 'zamu_departments_v7';
const STORAGE_THEME_KEY = 'zamu_theme_v7';
const STORAGE_INCIDENTS_KEY = 'zamu_incidents_v7';
const STORAGE_OVERRIDES_KEY = 'zamu_overrides_v7';
const STORAGE_AUTH_KEY = 'zamu_is_authenticated_v7';
const STORAGE_CLEARANCE_KEY = 'zamu_admin_clearance_v7';
const STORAGE_CATEGORIES_KEY = 'zamu_categories_v7';
const STORAGE_SUS_KEY = 'zamu_sus_evaluations_v7';
const STORAGE_ARCHIVE_KEY = 'zamu_archive_v7';


export const HandoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('active-handover');
  const [dbSyncStatus, setDbSyncStatus] = useState<SyncState>('synced');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [staffList, setStaffList] = useState<UserStaff[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_STAFF_KEY);
      if (stored) return JSON.parse(stored) as UserStaff[];
    } catch {
      // ignore
    }
    return SEED_STAFF;
  });

  const [currentUser, setCurrentUser] = useState<UserStaff>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (stored) return JSON.parse(stored) as UserStaff;
    } catch {
      // ignore
    }
    return SEED_STAFF[0];
  });

  // Authentication is a session state. Never restore it from browser storage.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [hasAdminClearance, setHasAdminClearance] = useState(false);

  const [departments, setDepartments] = useState<DepartmentUnit[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_DEPTS_KEY);
      if (stored) return (JSON.parse(stored) as DepartmentUnit[]).filter((dept) => dept.id !== 'dept-imp');
    } catch {
      // ignore
    }
    return SEED_DEPARTMENTS;
  });

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CATEGORIES_KEY);
      if (stored) {
        const defaultCategories = new Set([
          'Inbound Staging & Receiving', 'MHE & Equipment Custody', 'Cold Storage & Temperature Vault',
          'Customs & Bonded Freight', 'Hazardous & Dangerous Goods', 'Outbound Marshalling & Dispatch',
          'Facility Safety & Environmental',
        ]);
        return (JSON.parse(stored) as string[]).filter((category) => !defaultCategories.has(category));
      }
    } catch {
      // ignore
    }
    return SEED_CATEGORIES;
  });

  const [tasks, setTasks] = useState<ShiftActionItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TASKS_KEY);
      if (stored) return JSON.parse(stored) as ShiftActionItem[];
    } catch {
      // ignore
    }
    return SEED_TASKS;
  });

  const [incidents, setIncidents] = useState<IncidentRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_INCIDENTS_KEY);
      if (stored) return JSON.parse(stored) as IncidentRecord[];
    } catch {
      // ignore
    }
    return SEED_INCIDENTS;
  });

  const [overrideLogs, setOverrideLogs] = useState<AdminOverrideLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_OVERRIDES_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return SEED_OVERRIDE_LOGS;
  });

  const [activeHandover, setActiveHandover] = useState<HandoverRecord>(() => {
    const stored = readStored<HandoverRecord>(STORAGE_ACTIVE_KEY);
    if (stored && stored.id !== 'hnd-current' && !isClosedShift(stored)) return stored;
    return INITIAL_ACTIVE_HANDOVER;
  });

  const [archive, setArchive] = useState<HandoverRecord[]>(() => {
    const storedArchive = readStored<HandoverRecord[]>(STORAGE_ARCHIVE_KEY) ?? PAST_HANDOVER_ARCHIVE;
    // A handover that an older build completed without archiving still belongs in the archive.
    const storedActive = readStored<HandoverRecord>(STORAGE_ACTIVE_KEY);
    if (storedActive && isClosedShift(storedActive) && !storedArchive.some((shift) => shift.id === storedActive.id)) {
      return [storedActive, ...storedArchive];
    }
    return storedArchive;
  });
  const [attendanceLogs] = useState<AttendanceAuditLog[]>(SEED_ATTENDANCE_LOGS);

  // Sign-off records are derived from the handovers themselves, so they survive a reload.
  const complianceRecords = useMemo<SignoffComplianceRecord[]>(
    () =>
      [activeHandover, ...archive]
        .filter((shift) => shift.signoff.outgoingConfirmed && shift.signoff.incomingConfirmed &&
          shift.signoff.outgoingSignedAt && shift.signoff.incomingSignedAt)
        .map((shift) => {
          const outgoingSignedAt = shift.signoff.outgoingSignedAt as string;
          const incomingSignedAt = shift.signoff.incomingSignedAt as string;
          return {
            id: `cmp-${shift.id}`,
            handoverCode: shift.handoverCode,
            departmentName: shift.wardOrDepartment,
            date: localDateString(new Date(incomingSignedAt)),
            shiftType: shift.shiftType,
            outgoingSigner: shift.signoff.outgoingSignatureText || shift.signoff.outgoingStaffName,
            outgoingSignedAt: formatTime(outgoingSignedAt),
            incomingSigner: shift.signoff.incomingSignatureText || shift.signoff.incomingStaffName,
            incomingSignedAt: formatTime(incomingSignedAt),
            verificationHash: shift.signoff.verificationHash,
            // Every record listed here carries both signatures.
            complianceScore: 100,
            timeDeltaMinutes: minutesBetween(outgoingSignedAt, incomingSignedAt),
          };
        }),
    [activeHandover, archive]
  );

  const [susEvaluations, setSusEvaluations] = useState<SusEvaluationRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SUS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return SEED_SUS_EVALUATIONS;
  });

  const addSusEvaluation = (evaluationData: Omit<SusEvaluationRecord, 'id' | 'timestamp'>) => {
    const newRecord: SusEvaluationRecord = {
      ...evaluationData,
      id: `sus-${Date.now().toString(36)}`,
      timestamp: new Date().toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setSusEvaluations((prev) => [newRecord, ...prev]);
  };

  // Live Handover Effectiveness Index (HEI)
  const heiScore = useMemo(() => calculateHEI(activeHandover), [activeHandover]);

  const [themeConfig, setThemeConfig] = useState<AppThemeConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_THEME_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {
      fontDisplay: 'Plus Jakarta Sans',
      colorTheme: 'industrial-slate',
      sector: 'kq_bonded_freight',
      isDark: false,
    };
  });

  // Local storage cache persistence
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_AUTH_KEY);
      localStorage.removeItem(STORAGE_CLEARANCE_KEY);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(currentUser));
      localStorage.setItem(STORAGE_STAFF_KEY, JSON.stringify(staffList));
      localStorage.setItem(STORAGE_DEPTS_KEY, JSON.stringify(departments));
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories));
      localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
      localStorage.setItem(STORAGE_INCIDENTS_KEY, JSON.stringify(incidents));
      localStorage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(overrideLogs));
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(activeHandover));
      localStorage.setItem(STORAGE_ARCHIVE_KEY, JSON.stringify(archive));
      localStorage.setItem(STORAGE_THEME_KEY, JSON.stringify(themeConfig));
      localStorage.setItem(STORAGE_SUS_KEY, JSON.stringify(susEvaluations));
    } catch {
      // ignore
    }

    document.documentElement.style.setProperty('--font-heading', `'${themeConfig.fontDisplay}', sans-serif`);
    document.documentElement.style.setProperty('--font-sans', `'${themeConfig.fontDisplay}', sans-serif`);

    if (themeConfig.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isAuthenticated, hasAdminClearance, currentUser, staffList, departments, categories, tasks, incidents, overrideLogs, activeHandover, archive, themeConfig, susEvaluations]);


  // Initial cloud database synchronization (non-blocking)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cloudData = await loadInitialFromFirestore();
        if (!isMounted || !cloudData) return;
        if (cloudData.departments && cloudData.departments.length > 0) {
          setDepartments(cloudData.departments);
        }
        if (cloudData.tasks && cloudData.tasks.length > 0) {
          setTasks(cloudData.tasks);
        }
        if (cloudData.incidents && cloudData.incidents.length > 0) {
          setIncidents(cloudData.incidents);
        }
        if (cloudData.shifts && cloudData.shifts.length > 0) {
          const cloudArchive = cloudData.shifts.filter(isClosedShift);
          const cloudClosedIds = new Set(cloudArchive.map((shift) => shift.id));
          if (cloudArchive.length > 0) {
            setArchive((prev) =>
              [...cloudArchive, ...prev.filter((shift) => !cloudClosedIds.has(shift.id))].sort((a, b) =>
                (b.completedAt || '').localeCompare(a.completedAt || '')
              )
            );
          }
          // Resume the most recently started open shift. Blank drafts are ignored.
          const cloudActive = cloudData.shifts
            .filter((shift) => !isClosedShift(shift) && shift.handoverCode)
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
  }, []);

  // Manual Trigger to Sync All Records with Cloud Firestore
  const syncWithDatabase = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    setDbSyncStatus('saving');
    try {
      const ok = await syncAllToFirestore({
        activeHandover,
        tasks,
        departments,
        incidents,
      });
      setDbSyncStatus(ok ? 'synced' : 'offline');
      setIsSyncing(false);
      return ok;
    } catch {
      setDbSyncStatus('error');
      setIsSyncing(false);
      return false;
    }
  }, [activeHandover, tasks, departments, incidents]);

  // Auth functions with secret admin passkey verification
  const signInUser = (staffNumber: string, pin: string, adminPasskey?: string) => {
    const user = staffList.find(
      (s) => s.staffNumber.trim().toLowerCase() === staffNumber.trim().toLowerCase()
    );
    if (!user) {
      return { success: false, error: 'Staff ID not found in institutional roster.' };
    }
    if (user.pin && user.pin !== pin) {
      return { success: false, error: 'Incorrect PIN provided for this staff account.' };
    }
    if (user.status === 'suspended') {
      return { success: false, error: 'This account is suspended. Contact an administrator.' };
    }

    const adminPasskeyProvided = adminPasskey && adminPasskey.trim() === MASTER_ADMIN_PASSKEY;
    const isGrantedAdmin = user.isAdmin || Boolean(adminPasskeyProvided);

    setCurrentUser({
      ...user,
      isAdmin: isGrantedAdmin,
    });
    setIsAuthenticated(true);
    setHasAdminClearance(isGrantedAdmin);
    setActiveTab(isGrantedAdmin ? 'admin' : 'active-handover');

    return { success: true };
  };

  const signUpUser = (userData: Omit<UserStaff, 'id' | 'avatarSeed'>, adminPasskey?: string): { success: boolean; user?: UserStaff; error?: string } => {
    // Duplicate staff number guard
    if (staffList.some((s) => s.staffNumber.trim().toLowerCase() === userData.staffNumber.trim().toLowerCase())) {
      return { success: false, error: 'A worker with this Badge ID already exists in the roster.' };
    }

    const initials = userData.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const isGrantedAdmin = Boolean(adminPasskey && adminPasskey.trim() === MASTER_ADMIN_PASSKEY);

    const newUser: UserStaff = {
      ...userData,
      id: `usr-${Date.now().toString(36)}`,
      avatarSeed: initials || 'RN',
      status: 'active',
      isAdmin: isGrantedAdmin,
    };

    setStaffList((prev) => [newUser, ...prev]);
    setCurrentUser(newUser);
    setIsAuthenticated(true);
    setHasAdminClearance(isGrantedAdmin);
    setActiveTab(isGrantedAdmin ? 'admin' : 'active-handover');

    return { success: true, user: newUser };
  };

  const switchUser = (userId: string) => {
    const target = staffList.find((s) => s.id === userId);
    if (target) {
      setCurrentUser(target);
      setHasAdminClearance(Boolean(target.isAdmin));
    }
  };

  const signOutUser = () => {
    setIsAuthenticated(false);
    setHasAdminClearance(false);
    setActiveTab('active-handover');
  };

  // Admin & RBAC methods
  const updateUserRole = (userId: string, newRole: string, isAdmin: boolean) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === userId ? { ...s, role: newRole, isAdmin } : s))
    );
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, role: newRole, isAdmin }));
      setHasAdminClearance(isAdmin);
    }
  };

  const updateUserStatus = (userId: string, status: 'active' | 'on_leave' | 'suspended') => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === userId ? { ...s, status } : s))
    );
  };

  const overrideShiftSignoff = (shiftId: string, reason: string) => {
    if (!isAuthenticated || !hasAdminClearance || !currentUser.isAdmin || !reason.trim() ||
      shiftId !== activeHandover.id || activeHandover.status !== 'pending_signoff' ||
      !activeHandover.signoff.outgoingConfirmed || !activeHandover.signoff.incomingConfirmed) return;

    const log: AdminOverrideLog = {
      id: `ovr-${Date.now().toString(36)}`,
      shiftId,
      shiftCode: activeHandover.handoverCode,
      departmentName: activeHandover.wardOrDepartment,
      adminName: currentUser.name,
      adminId: currentUser.id,
      actionType: 'emergency_signoff',
      reason: reason.trim(),
      timestamp: new Date().toISOString(),
    };

    setOverrideLogs((prev) => [log, ...prev]);
    saveOverrideToFirestore(log);
    finalizeShift({ reason: reason.trim() });
  };

  const resolveIncident = (incidentId: string, notes: string, rootCause: string) => {
    const incident = incidents.find((inc) => inc.id === incidentId);
    if (!incident) return;
    const resolved: IncidentRecord = {
      ...incident,
      status: 'resolved',
      resolvedBy: currentUser.name,
      resolvedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mitigationNotes: notes,
      rootCause,
    };
    setIncidents((prev) => prev.map((inc) => (inc.id === incidentId ? resolved : inc)));
    saveIncidentToFirestore(resolved);
  };

  const reportIncident = (incidentData: Omit<IncidentRecord, 'id' | 'reportedAt' | 'status'>) => {
    const newInc: IncidentRecord = {
      ...incidentData,
      id: `inc-${Date.now().toString(36)}`,
      status: 'open',
      reportedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setIncidents((prev) => [newInc, ...prev]);
    saveIncidentToFirestore(newInc);
  };

  // Roster rotation
  const assignStaffToRoster = (deptId: string, shiftType: ShiftType, staff: UserStaff) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept || dept.roster[shiftType].some((s) => s.id === staff.id)) return;
    const updatedDept: DepartmentUnit = {
      ...dept,
      roster: {
        ...dept.roster,
        [shiftType]: [...dept.roster[shiftType], toPublicStaff(staff)],
      },
    };
    setDepartments((prev) => prev.map((d) => (d.id === deptId ? updatedDept : d)));
    saveDepartmentToFirestore(updatedDept);
  };

  // Dynamic Facility Zones / Departments Management (Saved to DB)
  const addDepartment = (deptData: { code: string; name: string; building: string; floor: string; capacity: number; headOfDepartment: string }) => {
    const newDept: DepartmentUnit = {
      id: `dept-${Date.now().toString(36)}`,
      code: deptData.code.toUpperCase().trim(),
      name: deptData.name.trim(),
      building: deptData.building.trim(),
      floor: deptData.floor.trim(),
      capacity: Number(deptData.capacity) || 50,
      activeUnits: Math.round((Number(deptData.capacity) || 50) * 0.7),
      headOfDepartment: deptData.headOfDepartment.trim(),
      currentShift: 'morning',
      shiftStatus: 'scheduled',
      roster: {
        morning: [toPublicStaff(currentUser)],
        evening: [],
        night: [],
      },
    };
    setDepartments((prev) => [...prev, newDept]);
    saveDepartmentToFirestore(newDept);
    return newDept;
  };

  const updateDepartment = (id: string, updatedFields: Partial<DepartmentUnit>) => {
    const dept = departments.find((d) => d.id === id);
    if (!dept) return;
    const modified: DepartmentUnit = { ...dept, ...updatedFields };
    setDepartments((prev) => prev.map((d) => (d.id === id ? modified : d)));
    saveDepartmentToFirestore(modified);
  };

  const deleteDepartment = (id: string) => {
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    deleteDepartmentFromFirestore(id);
    if (selectedDepartmentId === id) {
      const remaining = departments.filter((d) => d.id !== id);
      if (remaining.length > 0) setSelectedDepartmentId(remaining[0].id);
    }
  };

  // Operational Workstream Categories (Populated by Input / Admin)
  const addCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    setCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  };

  const deleteCategory = (category: string) => {
    setCategories((prev) => prev.filter((c) => c !== category));
  };

  // Task Hub functions (Saved to DB)
  const addTask = (taskData: Omit<ShiftActionItem, 'id' | 'status'>) => {
    const newTask: ShiftActionItem = {
      ...taskData,
      id: `task-${Date.now().toString(36)}`,
      status: 'pending',
    };
    setTasks((prev) => [newTask, ...prev]);
    saveTaskToFirestore(newTask);

    if (taskData.departmentId === activeHandover.departmentId) {
      const updatedShift = {
        ...activeHandover,
        actions: [newTask, ...activeHandover.actions],
      };
      setActiveHandover(updatedShift);
      saveShiftToFirestore(updatedShift);
    }
  };

  const updateTaskStatus = (taskId: string, status: ShiftActionItem['status']) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const changedTask: ShiftActionItem = { ...task, status };
      setTasks((prev) => prev.map((t) => (t.id === taskId ? changedTask : t)));
      saveTaskToFirestore(changedTask);
    }

    if (activeHandover.actions.some((t) => t.id === taskId)) {
      const updatedShift = {
        ...activeHandover,
        actions: activeHandover.actions.map((t) => (t.id === taskId ? { ...t, status } : t)),
      };
      setActiveHandover(updatedShift);
      saveShiftToFirestore(updatedShift);
    }
  };

  const toggleTaskStatus = (taskId: string) => {
    const current = tasks.find((t) => t.id === taskId)?.status;
    if (!current) return;
    updateTaskStatus(taskId, current === 'pending' ? 'in_progress' : current === 'in_progress' ? 'completed' : 'pending');
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    deleteTaskFromFirestore(taskId);

    const updatedShift = {
      ...activeHandover,
      actions: activeHandover.actions.filter((t) => t.id !== taskId),
    };
    setActiveHandover(updatedShift);
    saveShiftToFirestore(updatedShift);
  };

  // Active Handover functions (Saved to DB)
  const updateSummaryNotes = (notes: string) => {
    const updated = { ...activeHandover, summaryNotes: notes };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  const addCase = (newCaseData: Omit<SbarCase, 'id' | 'lastUpdated'>) => {
    const newCase: SbarCase = {
      ...newCaseData,
      id: `case-${Date.now().toString(36)}`,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = {
      ...activeHandover,
      cases: [newCase, ...activeHandover.cases],
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  const updateCase = (caseId: string, updatedFields: Partial<SbarCase>) => {
    const updated = {
      ...activeHandover,
      cases: activeHandover.cases.map((c) =>
        c.id === caseId
          ? {
              ...c,
              ...updatedFields,
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : c
      ),
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  const deleteCase = (caseId: string) => {
    const updated = {
      ...activeHandover,
      cases: activeHandover.cases.filter((c) => c.id !== caseId),
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  const toggleEquipmentCustody = (itemId: string) => {
    const updated = {
      ...activeHandover,
      equipment: activeHandover.equipment.map((eq) =>
        eq.id === itemId ? { ...eq, custodyChecked: !eq.custodyChecked } : eq
      ),
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  const addEquipmentItem = (itemData: Omit<EquipmentItem, 'id' | 'custodyChecked'>) => {
    const newItem: EquipmentItem = {
      ...itemData,
      id: `eq-${Date.now().toString(36)}`,
      custodyChecked: true,
    };
    const updated = {
      ...activeHandover,
      equipment: [...activeHandover.equipment, newItem],
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  // Each signature belongs to the signed-in account, and one account cannot sign both sides.
  const signOutgoingLead = () => {
    if (!isAuthenticated || hasAdminClearance || !activeHandover.handoverCode ||
      activeHandover.signoff.outgoingConfirmed) return;
    const signer = toPublicStaff(currentUser);
    const updated: HandoverRecord = {
      ...activeHandover,
      leadOutgoing: signer,
      signoff: {
        ...activeHandover.signoff,
        outgoingStaffId: signer.id,
        outgoingStaffName: signer.name,
        outgoingRole: signer.role,
        outgoingConfirmed: true,
        outgoingSignedAt: new Date().toISOString(),
        outgoingSignatureText: signer.name,
      },
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  const signIncomingLead = () => {
    const { signoff } = activeHandover;
    if (!isAuthenticated || hasAdminClearance || !signoff.outgoingConfirmed || signoff.incomingConfirmed ||
      signoff.outgoingStaffId === currentUser.id) return;
    const signer = toPublicStaff(currentUser);
    const nowIso = new Date().toISOString();
    const updated: HandoverRecord = {
      ...activeHandover,
      // Only a handover with both signatures waits for administrator approval.
      status: 'pending_signoff',
      leadIncoming: signer,
      transitionDurationMinutes: minutesBetween(signoff.outgoingSignedAt || nowIso, nowIso),
      signoff: {
        ...signoff,
        incomingStaffId: signer.id,
        incomingStaffName: signer.name,
        incomingRole: signer.role,
        incomingConfirmed: true,
        incomingSignedAt: nowIso,
        incomingSignatureText: signer.name,
      },
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  // Archives the signed handover and opens the next shift with the open items carried over.
  const finalizeShift = (override?: { reason: string }) => {
    const nowIso = new Date().toISOString();
    const finalized: HandoverRecord = {
      ...activeHandover,
      status: 'completed',
      completedAt: nowIso,
      ...(override ? { isOverridden: true, overrideReason: override.reason } : {}),
    };
    setArchive((prev) => [finalized, ...prev.filter((shift) => shift.id !== finalized.id)]);
    saveShiftToFirestore(finalized);

    const pendingActions: ShiftActionItem[] = activeHandover.actions
      .filter((a) => a.status === 'pending' || a.status === 'in_progress' || a.status === 'carried_over')
      .map((a) => ({
        ...a,
        id: `act-roll-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
        status: 'carried_over',
        carriedOverFromPrevious: true,
      }));

    // The staff member who accepted this handover leads the next shift.
    const nextLead = activeHandover.leadIncoming;
    const nextType = NEXT_SHIFT[activeHandover.shiftType];
    const nextShift: HandoverRecord = {
      id: `hnd-${Date.now().toString(36)}`,
      handoverCode: makeHandoverCode(nextType),
      wardOrDepartment: activeHandover.wardOrDepartment,
      departmentId: activeHandover.departmentId,
      sector: activeHandover.sector,
      shiftType: nextType,
      shiftDate: localDateString(),
      shiftWindow: SHIFT_WINDOWS[nextType],
      status: 'in_progress',
      leadOutgoing: nextLead,
      leadIncoming: UNASSIGNED_STAFF,
      attendanceCount: 0,
      transitionDurationMinutes: 0,
      summaryNotes: 'Shift initiated. All unresolved items from prior shift rolled over automatically.',
      cases: activeHandover.cases,
      equipment: activeHandover.equipment.map((eq) => ({ ...eq, custodyChecked: false })),
      actions: pendingActions,
      signoff: {
        outgoingStaffId: nextLead.id,
        outgoingStaffName: nextLead.name,
        outgoingRole: nextLead.role,
        outgoingConfirmed: false,
        incomingStaffId: '',
        incomingStaffName: '',
        incomingRole: '',
        incomingConfirmed: false,
      },
      createdAt: nowIso,
    };

    setActiveHandover(nextShift);
    saveShiftToFirestore(nextShift);
  };

  const completeAndArchiveShift = () => {
    if (!isAuthenticated || !hasAdminClearance || !currentUser.isAdmin ||
      !activeHandover.signoff.outgoingConfirmed || !activeHandover.signoff.incomingConfirmed) return;
    finalizeShift();
  };

  const startNewShift = (shiftType: ShiftType, wardName: string) => {
    const lead = toPublicStaff(currentUser);
    const department = departments.find((d) => d.name === wardName);
    const newRecord: HandoverRecord = {
      id: `hnd-${Date.now().toString(36)}`,
      handoverCode: makeHandoverCode(shiftType),
      wardOrDepartment: wardName,
      departmentId: department?.id || selectedDepartmentId,
      sector: themeConfig.sector,
      shiftType,
      shiftDate: localDateString(),
      shiftWindow: SHIFT_WINDOWS[shiftType],
      status: 'in_progress',
      leadOutgoing: lead,
      leadIncoming: UNASSIGNED_STAFF,
      attendanceCount: 0,
      transitionDurationMinutes: 0,
      summaryNotes: '',
      cases: [],
      equipment: [],
      actions: [],
      signoff: {
        outgoingStaffId: lead.id,
        outgoingStaffName: lead.name,
        outgoingRole: lead.role,
        outgoingConfirmed: false,
        incomingStaffId: '',
        incomingStaffName: '',
        incomingRole: '',
        incomingConfirmed: false,
      },
      createdAt: new Date().toISOString(),
    };

    setActiveHandover(newRecord);
    saveShiftToFirestore(newRecord);
  };

  return (
    <HandoverContext.Provider
      value={{
        activeTab,
        setActiveTab,
        dbSyncStatus,
        isSyncing,
        syncWithDatabase,
        isAuthenticated,
        hasAdminClearance,
        currentUser,
        staffList,
        signInUser,
        signUpUser,
        switchUser,
        signOutUser,
        updateUserRole,
        updateUserStatus,
        overrideShiftSignoff,
        incidents,
        resolveIncident,
        reportIncident,
        overrideLogs,
        departments,
        selectedDepartmentId,
        setSelectedDepartmentId,
        assignStaffToRoster,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        categories,
        addCategory,
        deleteCategory,
        tasks,
        addTask,
        updateTaskStatus,
        toggleTaskStatus,
        deleteTask,
        activeHandover,
        archive,
        updateSummaryNotes,
        addCase,
        updateCase,
        deleteCase,
        toggleEquipmentCustody,
        addEquipmentItem,
        signOutgoingLead,
        signIncomingLead,
        completeAndArchiveShift,
        startNewShift,
        attendanceLogs,
        complianceRecords,
        heiScore,
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
