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
  SEED_COMPLIANCE_RECORDS,
  SEED_INCIDENTS,
  SEED_OVERRIDE_LOGS,
  SEED_CATEGORIES,
  SEED_SUS_EVALUATIONS,
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
  signOutgoingLead: (signatureName: string) => void;
  signIncomingLead: (signatureName: string) => void;
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


export const HandoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('roster');
  const [dbSyncStatus, setDbSyncStatus] = useState<SyncState>('synced');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [staffList, setStaffList] = useState<UserStaff[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_STAFF_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return SEED_STAFF;
  });

  const [currentUser, setCurrentUser] = useState<UserStaff>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return SEED_STAFF[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_AUTH_KEY);
      if (stored !== null) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return false;
  });

  const [hasAdminClearance, setHasAdminClearance] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CLEARANCE_KEY);
      if (stored !== null) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return false;
  });

  const [departments, setDepartments] = useState<DepartmentUnit[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_DEPTS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return SEED_DEPARTMENTS;
  });

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('dept-imp');

  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CATEGORIES_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return SEED_CATEGORIES;
  });

  const [tasks, setTasks] = useState<ShiftActionItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TASKS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return SEED_TASKS;
  });

  const [incidents, setIncidents] = useState<IncidentRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_INCIDENTS_KEY);
      if (stored) return JSON.parse(stored);
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
    try {
      const stored = localStorage.getItem(STORAGE_ACTIVE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return INITIAL_ACTIVE_HANDOVER;
  });

  const [archive, setArchive] = useState<HandoverRecord[]>(PAST_HANDOVER_ARCHIVE);
  const [attendanceLogs] = useState<AttendanceAuditLog[]>(SEED_ATTENDANCE_LOGS);
  const [complianceRecords, setComplianceRecords] = useState<SignoffComplianceRecord[]>(SEED_COMPLIANCE_RECORDS);

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
      localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(isAuthenticated));
      localStorage.setItem(STORAGE_CLEARANCE_KEY, JSON.stringify(hasAdminClearance));
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(currentUser));
      localStorage.setItem(STORAGE_STAFF_KEY, JSON.stringify(staffList));
      localStorage.setItem(STORAGE_DEPTS_KEY, JSON.stringify(departments));
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories));
      localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
      localStorage.setItem(STORAGE_INCIDENTS_KEY, JSON.stringify(incidents));
      localStorage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(overrideLogs));
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(activeHandover));
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
  }, [isAuthenticated, hasAdminClearance, currentUser, staffList, departments, categories, tasks, incidents, overrideLogs, activeHandover, themeConfig, susEvaluations]);


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
          const active = cloudData.shifts.find((s) => s.status !== 'completed' && s.status !== 'archived');
          if (active) setActiveHandover(active);
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

    const adminPasskeyProvided = adminPasskey && adminPasskey.trim() === MASTER_ADMIN_PASSKEY;
    const isGrantedAdmin = user.isAdmin || Boolean(adminPasskeyProvided);

    setCurrentUser({
      ...user,
      isAdmin: isGrantedAdmin,
    });
    setIsAuthenticated(true);
    setHasAdminClearance(isGrantedAdmin);
    setActiveTab(isGrantedAdmin ? 'admin' : 'roster');

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
    setActiveTab(isGrantedAdmin ? 'admin' : 'roster');

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
    setActiveTab('roster');
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
    const nowIso = new Date().toISOString();
    const hash = `SHA256:ADMIN-OVR-${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}`;

    const log: AdminOverrideLog = {
      id: `ovr-${Date.now().toString(36)}`,
      shiftId,
      shiftCode: activeHandover.handoverCode,
      departmentName: activeHandover.wardOrDepartment,
      adminName: currentUser.name,
      adminId: currentUser.id,
      actionType: 'emergency_signoff',
      reason,
      timestamp: nowIso,
    };

    setOverrideLogs((prev) => [log, ...prev]);
    saveOverrideToFirestore(log);

    const updatedShift: HandoverRecord = {
      ...activeHandover,
      status: 'completed',
      completedAt: nowIso,
      isOverridden: true,
      overrideReason: reason,
      signoff: {
        ...activeHandover.signoff,
        outgoingConfirmed: true,
        outgoingSignatureText: `${activeHandover.signoff.outgoingSignatureText || activeHandover.leadOutgoing.name} [Admin Overridden]`,
        incomingConfirmed: true,
        incomingSignatureText: `${currentUser.name} [Executive Administrative Override]`,
        verificationHash: hash,
      },
    };

    setActiveHandover(updatedShift);
    saveShiftToFirestore(updatedShift);
  };

  const resolveIncident = (incidentId: string, notes: string, rootCause: string) => {
    let resolvedItem: IncidentRecord | null = null;
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId) {
          const item: IncidentRecord = {
            ...inc,
            status: 'resolved',
            resolvedBy: currentUser.name,
            resolvedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mitigationNotes: notes,
            rootCause,
          };
          resolvedItem = item;
          return item;
        }
        return inc;
      })
    );
    if (resolvedItem) {
      saveIncidentToFirestore(resolvedItem);
    }
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
    let updatedDept: DepartmentUnit | null = null;
    setDepartments((prev) =>
      prev.map((d) => {
        if (d.id !== deptId) return d;
        const currentList = d.roster[shiftType];
        if (currentList.some((s) => s.id === staff.id)) return d;
        const dUpdated: DepartmentUnit = {
          ...d,
          roster: {
            ...d.roster,
            [shiftType]: [...currentList, staff],
          },
        };
        updatedDept = dUpdated;
        return dUpdated;
      })
    );
    if (updatedDept) {
      saveDepartmentToFirestore(updatedDept);
    }
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
        morning: [currentUser],
        evening: [],
        night: [],
      },
    };
    setDepartments((prev) => [...prev, newDept]);
    saveDepartmentToFirestore(newDept);
    return newDept;
  };

  const updateDepartment = (id: string, updatedFields: Partial<DepartmentUnit>) => {
    let modified: DepartmentUnit | null = null;
    setDepartments((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          const u = { ...d, ...updatedFields };
          modified = u;
          return u;
        }
        return d;
      })
    );
    if (modified) {
      saveDepartmentToFirestore(modified);
    }
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
    let changedTask: ShiftActionItem | null = null;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const item = { ...t, status };
          changedTask = item;
          return item;
        }
        return t;
      })
    );
    if (changedTask) {
      saveTaskToFirestore(changedTask);
    }

    const updatedShift = {
      ...activeHandover,
      actions: activeHandover.actions.map((t) => (t.id === taskId ? { ...t, status } : t)),
    };
    setActiveHandover(updatedShift);
    saveShiftToFirestore(updatedShift);
  };

  const toggleTaskStatus = (taskId: string) => {
    let next: ShiftActionItem['status'] = 'in_progress';
    let changedTask: ShiftActionItem | null = null;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (t.status === 'pending') next = 'in_progress';
        else if (t.status === 'in_progress') next = 'completed';
        else next = 'pending';
        const updated = { ...t, status: next };
        changedTask = updated;
        return updated;
      })
    );
    if (changedTask) {
      saveTaskToFirestore(changedTask);
    }

    const updatedShift = {
      ...activeHandover,
      actions: activeHandover.actions.map((t) => (t.id === taskId ? { ...t, status: next } : t)),
    };
    setActiveHandover(updatedShift);
    saveShiftToFirestore(updatedShift);
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

  const signOutgoingLead = (signatureName: string) => {
    const nowIso = new Date().toISOString();
    const updated: HandoverRecord = {
      ...activeHandover,
      status: activeHandover.signoff.incomingConfirmed ? 'completed' : 'pending_signoff',
      signoff: {
        ...activeHandover.signoff,
        outgoingConfirmed: true,
        outgoingSignedAt: nowIso,
        outgoingSignatureText: signatureName,
      },
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  const signIncomingLead = (signatureName: string) => {
    const nowIso = new Date().toISOString();
    const hash = `SHA256:${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}${Math.random().toString(16).substring(2, 10)}`;
    const updated: HandoverRecord = {
      ...activeHandover,
      status: activeHandover.signoff.outgoingConfirmed ? 'completed' : 'pending_signoff',
      signoff: {
        ...activeHandover.signoff,
        incomingConfirmed: true,
        incomingSignedAt: nowIso,
        incomingSignatureText: signatureName,
        verificationHash: hash,
      },
    };
    setActiveHandover(updated);
    saveShiftToFirestore(updated);

    const newCompliance: SignoffComplianceRecord = {
      id: `cmp-${Date.now().toString(36)}`,
      handoverCode: activeHandover.handoverCode,
      departmentName: activeHandover.wardOrDepartment,
      date: new Date().toISOString().split('T')[0],
      shiftType: activeHandover.shiftType,
      outgoingSigner: activeHandover.signoff.outgoingSignatureText || activeHandover.leadOutgoing.name,
      outgoingSignedAt: new Date(activeHandover.signoff.outgoingSignedAt || nowIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      incomingSigner: signatureName,
      incomingSignedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      verificationHash: hash,
      complianceScore: 100,
      timeDeltaMinutes: 8,
    };
    setComplianceRecords((prev) => [newCompliance, ...prev]);
  };

  const completeAndArchiveShift = () => {
    const nowIso = new Date().toISOString();
    const finalized: HandoverRecord = {
      ...activeHandover,
      status: 'completed',
      completedAt: nowIso,
    };
    setArchive((prev) => [finalized, ...prev]);
    saveShiftToFirestore(finalized);

    const pendingActions: ShiftActionItem[] = activeHandover.actions
      .filter((a) => a.status === 'pending' || a.status === 'in_progress' || a.status === 'carried_over')
      .map((a) => ({
        ...a,
        id: `act-roll-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
        status: 'carried_over',
        carriedOverFromPrevious: true,
      }));

    const nextCode = `KQ-${new Date().getFullYear()}-CARGO-${activeHandover.shiftType === 'night' ? 'DAY' : 'NIGHT'}-${Math.floor(Math.random() * 90 + 10)}`;
    const nextShift: HandoverRecord = {
      id: `hnd-${Date.now().toString(36)}`,
      handoverCode: nextCode,
      wardOrDepartment: activeHandover.wardOrDepartment,
      departmentId: activeHandover.departmentId,
      sector: activeHandover.sector,
      shiftType: activeHandover.shiftType === 'night' ? 'morning' : 'night',
      shiftDate: new Date().toISOString().split('T')[0],
      shiftWindow: activeHandover.shiftType === 'night' ? '07:00 - 19:30 EAT' : '19:00 - 07:30 EAT',
      status: 'in_progress',
      leadOutgoing: activeHandover.leadIncoming,
      leadIncoming: SEED_STAFF[1] || SEED_STAFF[0],
      attendanceCount: 1,
      transitionDurationMinutes: 0,
      summaryNotes: 'Shift initiated. All unresolved items from prior shift rolled over automatically.',
      cases: activeHandover.cases.map((c) => ({ ...c, lastUpdated: '07:05 AM' })),
      equipment: activeHandover.equipment.map((eq) => ({ ...eq, custodyChecked: false })),
      actions: pendingActions,
      signoff: {
        outgoingStaffId: activeHandover.leadIncoming.id,
        outgoingStaffName: activeHandover.leadIncoming.name,
        outgoingRole: activeHandover.leadIncoming.role,
        outgoingConfirmed: false,
        incomingStaffId: SEED_STAFF[1]?.id || SEED_STAFF[0].id,
        incomingStaffName: SEED_STAFF[1]?.name || SEED_STAFF[0].name,
        incomingRole: SEED_STAFF[1]?.role || SEED_STAFF[0].role,
        incomingConfirmed: false,
      },
      createdAt: nowIso,
    };

    setActiveHandover(nextShift);
    saveShiftToFirestore(nextShift);
  };

  const startNewShift = (shiftType: ShiftType, wardName: string) => {
    const nowIso = new Date().toISOString();
    const code = `ZAMU-${new Date().getFullYear()}-${shiftType.toUpperCase().slice(0, 3)}-${Math.floor(Math.random() * 900 + 100)}`;
    const newRecord: HandoverRecord = {
      id: `hnd-${Date.now().toString(36)}`,
      handoverCode: code,
      wardOrDepartment: wardName,
      departmentId: selectedDepartmentId,
      sector: themeConfig.sector,
      shiftType: shiftType,
      shiftDate: new Date().toISOString().split('T')[0],
      shiftWindow: shiftType === 'morning' ? '07:00 - 15:30' : shiftType === 'evening' ? '15:00 - 23:30' : '23:00 - 07:30',
      status: 'in_progress',
      leadOutgoing: currentUser,
      leadIncoming: SEED_STAFF[1] || SEED_STAFF[0],
      attendanceCount: 4,
      transitionDurationMinutes: 12,
      summaryNotes: `Fresh shift handover initiated for ${wardName}. Direct input active.`,
      cases: [],
      equipment: [
        { id: 'eq-new-1', name: 'High-Lift Reach Truck', assetTag: 'MHE-RT-01', location: wardName, status: 'functional', batteryPercent: 92, custodyChecked: true },
        { id: 'eq-new-2', name: 'Barcode RF Scanner #04', assetTag: 'RF-SCAN-04', location: wardName, status: 'functional', batteryPercent: 100, custodyChecked: true },
      ],
      actions: [],
      signoff: {
        outgoingStaffId: currentUser.id,
        outgoingStaffName: currentUser.name,
        outgoingRole: currentUser.role,
        outgoingConfirmed: false,
        incomingStaffId: SEED_STAFF[1]?.id || 'usr-002',
        incomingStaffName: SEED_STAFF[1]?.name || 'David Kiprop',
        incomingRole: SEED_STAFF[1]?.role || 'Duty Lead',
        incomingConfirmed: false,
      },
      createdAt: nowIso,
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
