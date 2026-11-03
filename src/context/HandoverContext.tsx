import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  HandoverRecord,
  SbarCase,
  EquipmentItem,
  ShiftActionItem,
  AppThemeConfig,
  SectorType,
  UserStaff,
  DepartmentUnit,
  AttendanceAuditLog,
  SignoffComplianceRecord,
  ShiftType,
  IncidentRecord,
  AdminOverrideLog,
  OperationalTemplate,
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
  SEED_TEMPLATES,
  SEED_CATEGORIES,
} from '../data/seedData';

export type NavigationTab = 'roster' | 'active-handover' | 'tasks' | 'analytics' | 'archive' | 'admin';

export const MASTER_ADMIN_PASSKEY = 'ZAMU-ADMIN-2026';

interface HandoverContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  
  // Authentication & Clearance State
  isAuthenticated: boolean;
  hasAdminClearance: boolean;
  currentUser: UserStaff;
  staffList: UserStaff[];
  signInUser: (staffNumber: string, pin: string, adminPasskey?: string) => { success: boolean; error?: string };
  signUpUser: (userData: Omit<UserStaff, 'id' | 'avatarSeed'>, adminPasskey?: string) => UserStaff;
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

  // Facility Zones & Multi-Department Roster
  departments: DepartmentUnit[];
  selectedDepartmentId: string;
  setSelectedDepartmentId: (deptId: string) => void;
  assignStaffToRoster: (deptId: string, shiftType: ShiftType, staff: UserStaff) => void;
  addDepartment: (dept: { code: string; name: string; building: string; floor: string; capacity: number; headOfDepartment: string }) => DepartmentUnit;
  updateDepartment: (id: string, updatedFields: Partial<DepartmentUnit>) => void;
  deleteDepartment: (id: string) => void;

  // Operational Templates & SBAR Categories (Populated by Admin)
  templates: OperationalTemplate[];
  addTemplate: (template: Omit<OperationalTemplate, 'id'>) => OperationalTemplate;
  updateTemplate: (id: string, updatedFields: Partial<OperationalTemplate>) => void;
  deleteTemplate: (id: string) => void;
  categories: string[];
  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;
  
  // Tasks Hub
  tasks: ShiftActionItem[];
  addTask: (task: Omit<ShiftActionItem, 'id' | 'status'>) => void;
  updateTaskStatus: (taskId: string, status: ShiftActionItem['status']) => void;
  toggleTaskStatus: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  
  // Active Handover
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
  
  // Theme & Customization
  themeConfig: AppThemeConfig;
  setThemeConfig: React.Dispatch<React.SetStateAction<AppThemeConfig>>;
}

const HandoverContext = createContext<HandoverContextType | undefined>(undefined);

// Purge legacy storage caches (v1, v2, v3, v4) to prevent outdated medical presets from persisting in user browser
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const legacyVersions = ['_v1', '_v2', '_v3', '_v4'];
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('zamu_') && legacyVersions.some((ver) => key.includes(ver))) {
        localStorage.removeItem(key);
      }
    });
  }
} catch {
  // ignore
}

const STORAGE_ACTIVE_KEY = 'zamu_active_shift_v5';
const STORAGE_TASKS_KEY = 'zamu_tasks_v5';
const STORAGE_USER_KEY = 'zamu_current_user_v5';
const STORAGE_STAFF_KEY = 'zamu_staff_list_v5';
const STORAGE_DEPTS_KEY = 'zamu_departments_v5';
const STORAGE_THEME_KEY = 'zamu_theme_v5';
const STORAGE_INCIDENTS_KEY = 'zamu_incidents_v5';
const STORAGE_OVERRIDES_KEY = 'zamu_overrides_v5';
const STORAGE_AUTH_KEY = 'zamu_is_authenticated_v5';
const STORAGE_CLEARANCE_KEY = 'zamu_admin_clearance_v5';
const STORAGE_TEMPLATES_KEY = 'zamu_templates_v5';
const STORAGE_CATEGORIES_KEY = 'zamu_categories_v5';

export const HandoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('roster');

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
    return false; // Default to full-screen auth gate
  });

  const [hasAdminClearance, setHasAdminClearance] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CLEARANCE_KEY);
      if (stored !== null) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return false; // Hidden admin until passkey unlocked
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

  const [templates, setTemplates] = useState<OperationalTemplate[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TEMPLATES_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return SEED_TEMPLATES;
  });

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

  // Local storage persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(isAuthenticated));
      localStorage.setItem(STORAGE_CLEARANCE_KEY, JSON.stringify(hasAdminClearance));
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(currentUser));
      localStorage.setItem(STORAGE_STAFF_KEY, JSON.stringify(staffList));
      localStorage.setItem(STORAGE_DEPTS_KEY, JSON.stringify(departments));
      localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(templates));
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories));
      localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
      localStorage.setItem(STORAGE_INCIDENTS_KEY, JSON.stringify(incidents));
      localStorage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(overrideLogs));
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(activeHandover));
      localStorage.setItem(STORAGE_THEME_KEY, JSON.stringify(themeConfig));
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
  }, [isAuthenticated, hasAdminClearance, currentUser, staffList, departments, tasks, incidents, overrideLogs, activeHandover, themeConfig]);

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

    // Verify secret passkey if requested or if user has supervisor role
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

  const signUpUser = (userData: Omit<UserStaff, 'id' | 'avatarSeed'>, adminPasskey?: string) => {
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

    return newUser;
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

    setActiveHandover((prev) => ({
      ...prev,
      status: 'completed',
      completedAt: nowIso,
      isOverridden: true,
      overrideReason: reason,
      signoff: {
        ...prev.signoff,
        outgoingConfirmed: true,
        outgoingSignatureText: `${prev.signoff.outgoingSignatureText || prev.leadOutgoing.name} [Admin Overridden]`,
        incomingConfirmed: true,
        incomingSignatureText: `${currentUser.name} [Executive Administrative Override]`,
        verificationHash: hash,
      },
    }));
  };

  const resolveIncident = (incidentId: string, notes: string, rootCause: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              status: 'resolved',
              resolvedBy: currentUser.name,
              resolvedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              mitigationNotes: notes,
              rootCause,
            }
          : inc
      )
    );
  };

  const reportIncident = (incidentData: Omit<IncidentRecord, 'id' | 'reportedAt' | 'status'>) => {
    const newInc: IncidentRecord = {
      ...incidentData,
      id: `inc-${Date.now().toString(36)}`,
      status: 'open',
      reportedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setIncidents((prev) => [newInc, ...prev]);
  };

  // Roster rotation
  const assignStaffToRoster = (deptId: string, shiftType: ShiftType, staff: UserStaff) => {
    setDepartments((prev) =>
      prev.map((d) => {
        if (d.id !== deptId) return d;
        const currentList = d.roster[shiftType];
        if (currentList.some((s) => s.id === staff.id)) return d;
        return {
          ...d,
          roster: {
            ...d.roster,
            [shiftType]: [...currentList, staff],
          },
        };
      })
    );
  };

  // Dynamic Facility Zones / Departments Management (Admin Configured)
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
    return newDept;
  };

  const updateDepartment = (id: string, updatedFields: Partial<DepartmentUnit>) => {
    setDepartments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updatedFields } : d))
    );
  };

  const deleteDepartment = (id: string) => {
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    if (selectedDepartmentId === id) {
      const remaining = departments.filter((d) => d.id !== id);
      if (remaining.length > 0) setSelectedDepartmentId(remaining[0].id);
    }
  };

  // Dynamic SBAR Operational Templates & Categories (Admin Configured)
  const addTemplate = (templateData: Omit<OperationalTemplate, 'id'>) => {
    const newTmpl: OperationalTemplate = {
      ...templateData,
      id: `tmpl-${Date.now().toString(36)}`,
    };
    setTemplates((prev) => [newTmpl, ...prev]);
    return newTmpl;
  };

  const updateTemplate = (id: string, updatedFields: Partial<OperationalTemplate>) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updatedFields } : t))
    );
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const addCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    setCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  };

  const deleteCategory = (category: string) => {
    setCategories((prev) => prev.filter((c) => c !== category));
  };

  // Task Hub functions
  const addTask = (taskData: Omit<ShiftActionItem, 'id' | 'status'>) => {
    const newTask: ShiftActionItem = {
      ...taskData,
      id: `task-${Date.now().toString(36)}`,
      status: 'pending',
    };
    setTasks((prev) => [newTask, ...prev]);
    if (taskData.departmentId === activeHandover.departmentId) {
      setActiveHandover((prev) => ({
        ...prev,
        actions: [newTask, ...prev.actions],
      }));
    }
  };

  const updateTaskStatus = (taskId: string, status: ShiftActionItem['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
    setActiveHandover((prev) => ({
      ...prev,
      actions: prev.actions.map((t) => (t.id === taskId ? { ...t, status } : t)),
    }));
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        let next: ShiftActionItem['status'] = 'in_progress';
        if (t.status === 'pending') next = 'in_progress';
        else if (t.status === 'in_progress') next = 'completed';
        else next = 'pending';
        return { ...t, status: next };
      })
    );
    setActiveHandover((prev) => ({
      ...prev,
      actions: prev.actions.map((t) => {
        if (t.id !== taskId) return t;
        let next: ShiftActionItem['status'] = 'in_progress';
        if (t.status === 'pending') next = 'in_progress';
        else if (t.status === 'in_progress') next = 'completed';
        else next = 'pending';
        return { ...t, status: next };
      }),
    }));
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setActiveHandover((prev) => ({
      ...prev,
      actions: prev.actions.filter((t) => t.id !== taskId),
    }));
  };

  // Active Handover functions
  const updateSummaryNotes = (notes: string) => {
    setActiveHandover((prev) => ({ ...prev, summaryNotes: notes }));
  };

  const addCase = (newCaseData: Omit<SbarCase, 'id' | 'lastUpdated'>) => {
    const newCase: SbarCase = {
      ...newCaseData,
      id: `case-${Date.now().toString(36)}`,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setActiveHandover((prev) => ({
      ...prev,
      cases: [newCase, ...prev.cases],
    }));
  };

  const updateCase = (caseId: string, updatedFields: Partial<SbarCase>) => {
    setActiveHandover((prev) => ({
      ...prev,
      cases: prev.cases.map((c) =>
        c.id === caseId
          ? {
              ...c,
              ...updatedFields,
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : c
      ),
    }));
  };

  const deleteCase = (caseId: string) => {
    setActiveHandover((prev) => ({
      ...prev,
      cases: prev.cases.filter((c) => c.id !== caseId),
    }));
  };

  const toggleEquipmentCustody = (itemId: string) => {
    setActiveHandover((prev) => ({
      ...prev,
      equipment: prev.equipment.map((eq) =>
        eq.id === itemId ? { ...eq, custodyChecked: !eq.custodyChecked } : eq
      ),
    }));
  };

  const addEquipmentItem = (itemData: Omit<EquipmentItem, 'id' | 'custodyChecked'>) => {
    const newItem: EquipmentItem = {
      ...itemData,
      id: `eq-${Date.now().toString(36)}`,
      custodyChecked: true,
    };
    setActiveHandover((prev) => ({
      ...prev,
      equipment: [...prev.equipment, newItem],
    }));
  };

  const signOutgoingLead = (signatureName: string) => {
    const nowIso = new Date().toISOString();
    setActiveHandover((prev) => ({
      ...prev,
      status: prev.signoff.incomingConfirmed ? 'completed' : 'pending_signoff',
      signoff: {
        ...prev.signoff,
        outgoingConfirmed: true,
        outgoingSignedAt: nowIso,
        outgoingSignatureText: signatureName,
      },
    }));
  };

  const signIncomingLead = (signatureName: string) => {
    const nowIso = new Date().toISOString();
    const hash = `SHA256:${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}${Math.random().toString(16).substring(2, 10)}`;
    setActiveHandover((prev) => ({
      ...prev,
      status: prev.signoff.outgoingConfirmed ? 'completed' : 'pending_signoff',
      signoff: {
        ...prev.signoff,
        incomingConfirmed: true,
        incomingSignedAt: nowIso,
        incomingSignatureText: signatureName,
        verificationHash: hash,
      },
    }));

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
      leadIncoming: SEED_STAFF[2] || SEED_STAFF[0],
      attendanceCount: 6,
      transitionDurationMinutes: 15,
      summaryNotes: 'Shift initiated. All unresolved items from prior shift rolled over automatically.',
      cases: activeHandover.cases.map((c) => ({ ...c, lastUpdated: '07:05 AM' })),
      equipment: activeHandover.equipment.map((eq) => ({ ...eq, custodyChecked: false })),
      actions: pendingActions,
      signoff: {
        outgoingStaffId: activeHandover.leadIncoming.id,
        outgoingStaffName: activeHandover.leadIncoming.name,
        outgoingRole: activeHandover.leadIncoming.role,
        outgoingConfirmed: false,
        incomingStaffId: SEED_STAFF[2]?.id || 'usr-003',
        incomingStaffName: SEED_STAFF[2]?.name || 'Brian Mutua',
        incomingRole: SEED_STAFF[2]?.role || 'Operations Lead',
        incomingConfirmed: false,
      },
      createdAt: nowIso,
    };

    setActiveHandover(nextShift);
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
      leadIncoming: staffList.find((s) => s.id !== currentUser.id) || SEED_STAFF[1],
      attendanceCount: 5,
      transitionDurationMinutes: 14,
      summaryNotes: 'Initial shift briefing session.',
      cases: [],
      equipment: [
        {
          id: 'eq-new-1',
          name: 'Zebra TC57 Rugged Android RF Scanner & Charging Cradle',
          assetTag: 'RF-SCAN-GEN-01',
          location: wardName,
          status: 'functional',
          batteryPercent: 100,
          custodyChecked: false,
        },
      ],
      actions: tasks.filter((t) => t.departmentId === selectedDepartmentId && t.status !== 'completed'),
      signoff: {
        outgoingStaffId: currentUser.id,
        outgoingStaffName: currentUser.name,
        outgoingRole: currentUser.role,
        outgoingConfirmed: false,
        incomingStaffId: staffList.find((s) => s.id !== currentUser.id)?.id || 'usr-002',
        incomingStaffName: staffList.find((s) => s.id !== currentUser.id)?.name || 'David Kiprop',
        incomingRole: staffList.find((s) => s.id !== currentUser.id)?.role || 'Incoming Operations Lead',
        incomingConfirmed: false,
      },
      createdAt: nowIso,
    };
    setActiveHandover(newRecord);
  };

  return (
    <HandoverContext.Provider
      value={{
        activeTab,
        setActiveTab,
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
        templates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
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
