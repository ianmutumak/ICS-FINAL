import { useMemo, useState } from 'react';
import {
  AdminOverrideLog,
  AttendanceAuditLog,
  DepartmentUnit,
  EquipmentItem,
  HandoverRecord,
  SbarCase,
  SectorType,
  ShiftActionItem,
  ShiftType,
  SignoffComplianceRecord,
  UserStaff,
} from '../types';
import {
  INITIAL_ACTIVE_HANDOVER,
  PAST_HANDOVER_ARCHIVE,
  SEED_ATTENDANCE_LOGS,
  SEED_OVERRIDE_LOGS,
  SEED_TASKS,
  UNASSIGNED_STAFF,
} from '../data/seedData';
import {
  deleteTaskFromFirestore,
  saveOverrideToFirestore,
  saveShiftToFirestore,
  saveTaskToFirestore,
} from '../lib/firestoreService';
import {
  NEXT_SHIFT,
  SHIFT_WINDOWS,
  calculateHEI,
  formatTime,
  isClosedShift,
  unacknowledgedWarnings,
  localDateString,
  makeHandoverCode,
  minutesBetween,
  sealHandover,
  toPublicStaff,
} from '../lib/shiftRules';
import { STORAGE_KEYS, readStored, usePersistedState } from './storage';

interface ShiftDependencies {
  isAuthenticated: boolean;
  hasAdminClearance: boolean;
  currentUser: UserStaff;
  departments: DepartmentUnit[];
  selectedDepartmentId: string;
  sector: SectorType;
}

const emptySignoff = (outgoing: UserStaff) => ({
  outgoingStaffId: outgoing.id,
  outgoingStaffName: outgoing.name,
  outgoingRole: outgoing.role,
  outgoingConfirmed: false,
  incomingStaffId: '',
  incomingStaffName: '',
  incomingRole: '',
  incomingConfirmed: false,
});

/** The open handover, its updates and tasks, the two signatures, approval and the archive. */
export function useShift({
  isAuthenticated,
  hasAdminClearance,
  currentUser,
  departments,
  selectedDepartmentId,
  sector,
}: ShiftDependencies) {
  const [activeHandover, setActiveHandover] = usePersistedState<HandoverRecord>(STORAGE_KEYS.activeShift, () => {
    const stored = readStored<HandoverRecord>(STORAGE_KEYS.activeShift);
    if (stored && stored.id !== 'hnd-current' && !isClosedShift(stored)) return stored;
    return INITIAL_ACTIVE_HANDOVER;
  });

  const [archive, setArchive] = usePersistedState<HandoverRecord[]>(STORAGE_KEYS.archive, () => {
    const storedArchive = readStored<HandoverRecord[]>(STORAGE_KEYS.archive) ?? PAST_HANDOVER_ARCHIVE;
    // A handover that an older build completed without archiving still belongs in the archive.
    const storedActive = readStored<HandoverRecord>(STORAGE_KEYS.activeShift);
    if (storedActive && isClosedShift(storedActive) && !storedArchive.some((shift) => shift.id === storedActive.id)) {
      return [storedActive, ...storedArchive];
    }
    return storedArchive;
  });

  const [tasks, setTasks] = usePersistedState<ShiftActionItem[]>(
    STORAGE_KEYS.tasks,
    () => readStored<ShiftActionItem[]>(STORAGE_KEYS.tasks) ?? SEED_TASKS
  );
  const [overrideLogs, setOverrideLogs] = usePersistedState<AdminOverrideLog[]>(
    STORAGE_KEYS.overrides,
    () => readStored<AdminOverrideLog[]>(STORAGE_KEYS.overrides) ?? SEED_OVERRIDE_LOGS
  );
  const [attendanceLogs] = useState<AttendanceAuditLog[]>(SEED_ATTENDANCE_LOGS);

  const heiScore = useMemo(() => calculateHEI(activeHandover), [activeHandover]);

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

  /** Applies a change to the open handover and saves it. */
  const updateActive = (updated: HandoverRecord) => {
    setActiveHandover(updated);
    saveShiftToFirestore(updated);
  };

  // ---- Starting a shift ----

  const startNewShift = (shiftType: ShiftType, wardName: string) => {
    const lead = toPublicStaff(currentUser);
    const department = departments.find((d) => d.name === wardName);
    updateActive({
      id: `hnd-${Date.now().toString(36)}`,
      handoverCode: makeHandoverCode(shiftType),
      wardOrDepartment: wardName,
      departmentId: department?.id || selectedDepartmentId,
      sector,
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
      signoff: emptySignoff(lead),
      createdAt: new Date().toISOString(),
    });
  };

  // ---- Handover updates (SBAR cases), notes and equipment ----

  const updateSummaryNotes = (notes: string) => updateActive({ ...activeHandover, summaryNotes: notes });

  // Once the outgoing staff member has signed, the content they signed for cannot change.
  const isLocked = activeHandover.signoff.outgoingConfirmed;

  const addCase = (newCaseData: Omit<SbarCase, 'id' | 'lastUpdated'>) => {
    if (isLocked || !activeHandover.handoverCode) return;
    const newCase: SbarCase = { ...newCaseData, id: `case-${Date.now().toString(36)}`, lastUpdated: formatTime() };
    updateActive({ ...activeHandover, cases: [newCase, ...activeHandover.cases] });
  };

  const updateCase = (caseId: string, updatedFields: Partial<SbarCase>) => {
    if (isLocked) return;
    updateActive({
      ...activeHandover,
      cases: activeHandover.cases.map((c) => (c.id === caseId ? { ...c, ...updatedFields, lastUpdated: formatTime() } : c)),
    });
  };

  const deleteCase = (caseId: string) => {
    if (isLocked) return;
    updateActive({ ...activeHandover, cases: activeHandover.cases.filter((c) => c.id !== caseId) });
  };

  const toggleEquipmentCustody = (itemId: string) => {
    if (isLocked) return;
    updateActive({
      ...activeHandover,
      equipment: activeHandover.equipment.map((eq) => (eq.id === itemId ? { ...eq, custodyChecked: !eq.custodyChecked } : eq)),
    });
  };

  const addEquipmentItem = (itemData: Omit<EquipmentItem, 'id' | 'custodyChecked'>) => {
    if (isLocked || !activeHandover.handoverCode) return;
    // Custody starts unchecked: it is ticked during the joint walk-through.
    const newItem: EquipmentItem = { ...itemData, id: `eq-${Date.now().toString(36)}`, custodyChecked: false };
    updateActive({ ...activeHandover, equipment: [...activeHandover.equipment, newItem] });
  };

  // ---- Tasks ----

  const addTask = (taskData: Omit<ShiftActionItem, 'id' | 'status'>) => {
    const newTask: ShiftActionItem = { ...taskData, id: `task-${Date.now().toString(36)}`, status: 'pending' };
    setTasks((prev) => [newTask, ...prev]);
    saveTaskToFirestore(newTask);
    if (taskData.departmentId === activeHandover.departmentId) {
      updateActive({ ...activeHandover, actions: [newTask, ...activeHandover.actions] });
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
      updateActive({
        ...activeHandover,
        actions: activeHandover.actions.map((t) => (t.id === taskId ? { ...t, status } : t)),
      });
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
    if (activeHandover.actions.some((t) => t.id === taskId)) {
      updateActive({ ...activeHandover, actions: activeHandover.actions.filter((t) => t.id !== taskId) });
    }
  };

  // ---- Signatures ----
  // Each signature belongs to the signed-in account, and one account cannot sign both sides.

  const signOutgoingLead = () => {
    if (!isAuthenticated || hasAdminClearance || !activeHandover.handoverCode ||
      activeHandover.signoff.outgoingConfirmed) return;
    const signer = toPublicStaff(currentUser);
    updateActive({
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
    });
  };

  /** The incoming staff member acknowledges one update's safety warning. */
  const acknowledgeWarning = (caseId: string) => {
    const { signoff } = activeHandover;
    if (!isAuthenticated || hasAdminClearance || !signoff.outgoingConfirmed || signoff.incomingConfirmed ||
      signoff.outgoingStaffId === currentUser.id) return;
    updateActive({
      ...activeHandover,
      cases: activeHandover.cases.map((c) =>
        c.id === caseId && c.isolationOrHazardAlert && !c.acknowledgedAt
          ? { ...c, acknowledgedBy: currentUser.name, acknowledgedById: currentUser.id, acknowledgedAt: new Date().toISOString() }
          : c
      ),
    });
  };

  const signIncomingLead = () => {
    const { signoff } = activeHandover;
    if (!isAuthenticated || hasAdminClearance || !signoff.outgoingConfirmed || signoff.incomingConfirmed ||
      signoff.outgoingStaffId === currentUser.id) return;
    // Every safety warning must have been acknowledged before the handover can be accepted.
    if (unacknowledgedWarnings(activeHandover).length > 0) return;
    const signer = toPublicStaff(currentUser);
    const nowIso = new Date().toISOString();
    const signed: HandoverRecord = {
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
    updateActive(signed);

    // Seal the signed record with a SHA-256 fingerprint as soon as it is computed (a few milliseconds).
    void sealHandover(signed).then((hash) => {
      if (!hash) return;
      setActiveHandover((current) =>
        current.id === signed.id ? { ...current, signoff: { ...current.signoff, verificationHash: hash } } : current
      );
      saveShiftToFirestore({ ...signed, signoff: { ...signed.signoff, verificationHash: hash } });
    });
  };

  // ---- Approval ----

  /** Archives the signed handover and opens the next shift with the open items carried over. */
  const finalizeShift = (override?: { reason: string }) => {
    const nowIso = new Date().toISOString();
    const finalized: HandoverRecord = {
      ...activeHandover,
      status: 'completed',
      completedAt: nowIso,
      approvedBy: currentUser.name,
      approvedById: currentUser.id,
      ...(override ? { isOverridden: true, overrideReason: override.reason } : {}),
    };
    setArchive((prev) => [finalized, ...prev.filter((shift) => shift.id !== finalized.id)]);
    saveShiftToFirestore(finalized);

    const carriedActions: ShiftActionItem[] = activeHandover.actions
      .filter((a) => a.status !== 'completed')
      .map((a) => ({
        ...a,
        id: `act-roll-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
        status: 'carried_over',
        carriedOverFromPrevious: true,
      }));

    // The staff member who accepted this handover leads the next shift.
    const nextLead = activeHandover.leadIncoming;
    const nextType = NEXT_SHIFT[activeHandover.shiftType];
    updateActive({
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
      // Updates carry over, but each safety warning must be acknowledged again by the next incoming staff member.
      cases: activeHandover.cases.map(({ acknowledgedBy: _by, acknowledgedById: _byId, acknowledgedAt: _at, ...rest }) => rest),
      equipment: activeHandover.equipment.map((eq) => ({ ...eq, custodyChecked: false })),
      actions: carriedActions,
      signoff: emptySignoff(nextLead),
      createdAt: nowIso,
    });
  };

  const canApprove = isAuthenticated && hasAdminClearance && Boolean(currentUser.isAdmin) &&
    activeHandover.signoff.outgoingConfirmed && activeHandover.signoff.incomingConfirmed;

  const completeAndArchiveShift = () => {
    if (canApprove) finalizeShift();
  };

  const overrideShiftSignoff = (shiftId: string, reason: string) => {
    if (!canApprove || !reason.trim() || shiftId !== activeHandover.id ||
      activeHandover.status !== 'pending_signoff') return;
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

  return {
    activeHandover,
    setActiveHandover,
    archive,
    setArchive,
    tasks,
    setTasks,
    overrideLogs,
    attendanceLogs,
    complianceRecords,
    heiScore,
    startNewShift,
    updateSummaryNotes,
    addCase,
    updateCase,
    deleteCase,
    toggleEquipmentCustody,
    addEquipmentItem,
    addTask,
    updateTaskStatus,
    toggleTaskStatus,
    deleteTask,
    signOutgoingLead,
    acknowledgeWarning,
    isLocked,
    signIncomingLead,
    completeAndArchiveShift,
    overrideShiftSignoff,
  };
}
