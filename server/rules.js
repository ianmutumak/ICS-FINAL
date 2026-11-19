import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * The handover rules, enforced on the server. The browser shows what is allowed, but this is what decides.
 * The seal and the index follow the same formulas as src/lib/shiftRules.ts; a test checks they agree.
 */

export const SHIFT_TYPES = ['morning', 'evening', 'night'];
export const SHIFT_WINDOWS = { morning: '07:00 - 15:30', evening: '15:00 - 23:30', night: '23:00 - 07:30' };
export const NEXT_SHIFT = { morning: 'evening', evening: 'night', night: 'morning' };
export const CLOSED_STATUSES = ['completed', 'archived'];
export const EQUIPMENT_STATUSES = ['functional', 'in_use', 'inspection_due', 'faulty'];

export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

export function localDateString(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export const clockTime = (date, timeZone) =>
  date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });

export function makeHandoverCode(shiftType, date, timeZone) {
  const year = localDateString(date, timeZone).slice(0, 4);
  return `ZAMU-${year}-${shiftType.toUpperCase().slice(0, 3)}-${randomInt(100, 1000)}`;
}

/** Minutes between two ISO times, to a tenth of a minute. 0 means the time could not be measured. */
export function minutesBetween(fromIso, toIso) {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.max(0.1, Math.round(ms / 6000) / 10);
}

export const hasSafetyWarning = (update) => Boolean(update.isolationOrHazardAlert?.trim());
export const unacknowledgedWarnings = (shift) => shift.cases.filter((update) => hasSafetyWarning(update) && !update.acknowledgedAt);
export const isClosed = (shift) => CLOSED_STATUSES.includes(shift.status);

/** The staff details that are safe to embed in a shared record. */
export const embedStaff = (user) => ({
  id: user.id,
  staffNumber: user.staffNumber,
  name: user.name,
  role: user.role || '',
  department: user.department || '',
  qualification: user.qualification || '',
  avatarSeed: user.avatarSeed || '',
});

export const UNASSIGNED = { id: '', staffNumber: '', name: 'Not yet assigned', role: '', department: '', qualification: '', avatarSeed: '' };

/** SHA-256 fingerprint of a signed handover. Must match sealHandover in src/lib/shiftRules.ts. */
export function sealHandover(shift) {
  const { signoff } = shift;
  const content = JSON.stringify({
    code: shift.handoverCode,
    date: shift.shiftDate,
    shift: shift.shiftType,
    area: shift.wardOrDepartment,
    updates: shift.cases.map((c) => [c.subjectRef, c.situation, c.background, c.assessment, c.recommendation, c.isolationOrHazardAlert ?? '', c.acknowledgedById ?? '', c.acknowledgedAt ?? '']),
    equipment: shift.equipment.map((e) => [e.name, e.assetTag, e.status, e.custodyChecked]),
    outgoing: [signoff.outgoingStaffId, signoff.outgoingSignedAt],
    incoming: [signoff.incomingStaffId, signoff.incomingSignedAt],
  });
  return createHash('sha256').update(content).digest('hex');
}

const emptySignoff = (lead) => ({
  outgoingStaffId: lead.id,
  outgoingStaffName: lead.name,
  outgoingRole: lead.role,
  outgoingConfirmed: false,
  incomingStaffId: '',
  incomingStaffName: '',
  incomingRole: '',
  incomingConfirmed: false,
});

export function newShift({ shiftType, workArea, departmentId, lead, now, timeZone }) {
  return {
    _id: newId('hnd'),
    rev: 0,
    handoverCode: makeHandoverCode(shiftType, now, timeZone),
    wardOrDepartment: workArea,
    departmentId: departmentId || '',
    sector: 'kq_bonded_freight',
    shiftType,
    shiftDate: localDateString(now, timeZone),
    shiftWindow: SHIFT_WINDOWS[shiftType],
    status: 'in_progress',
    leadOutgoing: lead,
    leadIncoming: UNASSIGNED,
    attendanceCount: 0,
    transitionDurationMinutes: 0,
    summaryNotes: '',
    cases: [],
    equipment: [],
    actions: [],
    signoff: emptySignoff(lead),
    createdAt: now.toISOString(),
  };
}

/**
 * Closes a fully signed handover and opens the next shift with the open items carried over.
 * Returns both records; the caller stores them.
 */
export function finalizeShift(shift, { approver, override, now, timeZone }) {
  const closed = {
    ...shift,
    status: 'completed',
    completedAt: now.toISOString(),
    approvedBy: approver.name,
    approvedById: approver.id,
    ...(override ? { isOverridden: true, overrideReason: override } : {}),
  };

  const nextType = NEXT_SHIFT[shift.shiftType];
  const lead = shift.leadIncoming;
  const next = {
    ...newShift({ shiftType: nextType, workArea: shift.wardOrDepartment, departmentId: shift.departmentId, lead, now, timeZone }),
    sector: shift.sector,
    summaryNotes: 'Shift initiated. All unresolved items from prior shift rolled over automatically.',
    // Updates carry over, but each safety warning must be acknowledged again by the next incoming staff member.
    cases: shift.cases.map(({ acknowledgedBy, acknowledgedById, acknowledgedAt, ...rest }) => rest),
    equipment: shift.equipment.map((item) => ({ ...item, custodyChecked: false })),
    actions: shift.actions
      .filter((action) => action.status !== 'completed')
      .map((action) => ({ ...action, id: newId('act'), status: 'carried_over', carriedOverFromPrevious: true })),
  };
  return { closed, next };
}
