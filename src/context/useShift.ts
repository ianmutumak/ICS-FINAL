import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminOverrideLog, EquipmentItem, HandoverRecord, SbarCase, ShiftActionItem, ShiftType, SignoffComplianceRecord, UserStaff,
} from '../types';
import { INITIAL_ACTIVE_HANDOVER } from '../data/seedData';
import { api, errorMessage } from '../lib/api';
import { calculateHEI, formatTime, localDateString, minutesBetween } from '../lib/shiftRules';

interface ShiftDependencies {
  isAuthenticated: boolean;
  hasAdminClearance: boolean;
  currentUser: UserStaff;
  /** Shows a message to the person, or clears it with null. */
  reportError: (message: string | null) => void;
}

type NewUpdate = Pick<SbarCase, 'subjectRef' | 'situation' | 'background' | 'assessment' | 'recommendation' | 'isolationOrHazardAlert'>;

// How often the screen asks the server for changes made by other people, such as the other staff member's signature.
const REFRESH_SECONDS = 8;

/**
 * The open handover, its updates, the two signatures, approval and the archive.
 * The server owns the record and decides what is allowed; this hook sends requests and shows the result.
 */
export function useShift({ isAuthenticated, hasAdminClearance, currentUser, reportError }: ShiftDependencies) {
  const [activeHandover, setActiveHandover] = useState<HandoverRecord>(INITIAL_ACTIVE_HANDOVER);
  const [archive, setArchive] = useState<HandoverRecord[]>([]);
  const [overrideLogs, setOverrideLogs] = useState<AdminOverrideLog[]>([]);

  const refresh = useCallback(async () => {
    try {
      const active = await api<HandoverRecord | null>('GET', '/shifts/active');
      setActiveHandover(active ?? INITIAL_ACTIVE_HANDOVER);
      if (hasAdminClearance) {
        const [closed, overrides] = await Promise.all([
          api<HandoverRecord[]>('GET', '/shifts/archive'),
          api<AdminOverrideLog[]>('GET', '/overrides'),
        ]);
        setArchive(closed);
        setOverrideLogs(overrides);
      }
    } catch {
      // A missed refresh is not worth interrupting anyone for; the next one tries again.
    }
  }, [hasAdminClearance]);

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveHandover(INITIAL_ACTIVE_HANDOVER);
      setArchive([]);
      setOverrideLogs([]);
      return undefined;
    }
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_SECONDS * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, refresh]);

  /** Runs a request, shows any error, and reloads the record so the screen matches the server. */
  const act = useCallback(async (request: () => Promise<void>): Promise<boolean> => {
    try {
      await request();
      reportError(null);
      return true;
    } catch (error) {
      reportError(errorMessage(error));
      await refresh();
      return false;
    }
  }, [refresh, reportError]);

  const heiScore = useMemo(() => calculateHEI(activeHandover), [activeHandover]);

  // Sign-off records are derived from the handovers themselves.
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

  // Follow-up work is recorded on the shifts, so the task lists are drawn from them.
  const tasks = useMemo<ShiftActionItem[]>(() => {
    const byId = new Map<string, ShiftActionItem>();
    [activeHandover, ...archive].forEach((shift) => shift.actions.forEach((action) => byId.set(action.id, action)));
    return [...byId.values()];
  }, [activeHandover, archive]);

  const shiftPath = `/shifts/${activeHandover.id}`;
  const apply = (shift: HandoverRecord) => setActiveHandover(shift);

  // ---- Starting a shift and recording updates

  const startNewShift = (shiftType: ShiftType, workArea: string) =>
    act(async () => apply(await api<HandoverRecord>('POST', '/shifts', { shiftType, workArea })));

  // A shift that opened after the last approval has no start time until someone checks in (or adds the first update).
  const checkInToShift = () =>
    act(async () => apply(await api<HandoverRecord>('POST', `${shiftPath}/start`)));

  const addCase = (update: NewUpdate) =>
    act(async () => apply(await api<HandoverRecord>('POST', `${shiftPath}/cases`, update)));

  const deleteCase = (caseId: string) =>
    act(async () => apply(await api<HandoverRecord>('DELETE', `${shiftPath}/cases/${caseId}`)));

  const addEquipmentItem = (item: Pick<EquipmentItem, 'name' | 'assetTag' | 'status'>) =>
    act(async () => apply(await api<HandoverRecord>('POST', `${shiftPath}/equipment`, item)));

  const toggleEquipmentCustody = (itemId: string) => {
    const item = activeHandover.equipment.find((entry) => entry.id === itemId);
    if (!item) return Promise.resolve(false);
    return act(async () => apply(await api<HandoverRecord>('PATCH', `${shiftPath}/equipment/${itemId}`, { custodyChecked: !item.custodyChecked })));
  };

  // ---- Signatures: the server decides who may sign and in what order

  const signOutgoingLead = () =>
    act(async () => apply(await api<HandoverRecord>('POST', `${shiftPath}/sign/outgoing`)));

  const acknowledgeWarning = (caseId: string) =>
    act(async () => apply(await api<HandoverRecord>('POST', `${shiftPath}/cases/${caseId}/acknowledge`)));

  const signIncomingLead = () =>
    act(async () => apply(await api<HandoverRecord>('POST', `${shiftPath}/sign/incoming`)));

  // ---- Approval (administrators)

  const closeAndOpenNext = async (path: string, body?: unknown) => {
    const { closed, next } = await api<{ closed: HandoverRecord; next: HandoverRecord }>('POST', path, body);
    setActiveHandover(next);
    setArchive((previous) => [closed, ...previous.filter((shift) => shift.id !== closed.id)]);
    setOverrideLogs((await api<AdminOverrideLog[]>('GET', '/overrides').catch(() => overrideLogs)));
  };

  const completeAndArchiveShift = () => act(() => closeAndOpenNext(`${shiftPath}/approve`));

  const overrideShiftSignoff = (shiftId: string, reason: string) =>
    act(() => closeAndOpenNext(`/shifts/${shiftId}/override`, { reason }));

  const cancelShift = (shiftId: string, reason: string) =>
    act(async () => {
      await api('POST', `/shifts/${shiftId}/cancel`, { reason });
      await refresh();
    });

  // Once the outgoing staff member has signed, the content they signed for cannot change.
  const isLocked = activeHandover.signoff.outgoingConfirmed;

  return {
    activeHandover,
    archive,
    overrideLogs,
    attendanceLogs: [] as never[],
    complianceRecords,
    tasks,
    heiScore,
    isLocked,
    currentUserId: currentUser.id,
    startNewShift,
    checkInToShift,
    addCase,
    deleteCase,
    addEquipmentItem,
    toggleEquipmentCustody,
    signOutgoingLead,
    acknowledgeWarning,
    signIncomingLead,
    completeAndArchiveShift,
    overrideShiftSignoff,
    cancelShift,
    refreshShifts: refresh,
  };
}
