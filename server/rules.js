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

/** When each shift is meant to begin, as a local clock time. */
export const SHIFT_STARTS = { morning: '07:00', evening: '15:00', night: '23:00' };
/** A start up to this many minutes after the scheduled time is on time. Must equal LATE_GRACE_MINUTES in src/lib/shiftRules.ts. */
export const LATE_GRACE_MINUTES = 15;

/** How far a time zone is ahead of UTC at a given moment, in milliseconds. */
function zoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - date.getTime();
}

/** The moment that a local date and clock time ('2026-11-19', '07:00') fall on in a time zone. */
function zonedInstant(dateString, clock, timeZone) {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute] = clock.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wallClockAsUtc;
  for (let pass = 0; pass < 2; pass += 1) guess = wallClockAsUtc - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/**
 * The scheduled start of a shift that is being opened at `now`: the occurrence of that shift's start time
 * (yesterday's, today's or tomorrow's) that is closest to `now`. A shift opened a little before its time is early,
 * and one opened long after it is late, so the night shift opened at 00:30 is measured against 23:00 the day before.
 */
export function scheduledStartFor(shiftType, now, timeZone) {
  const today = localDateString(now, timeZone);
  const [year, month, day] = today.split('-').map(Number);
  const candidates = [-1, 0, 1].map((shift) => {
    const date = new Date(Date.UTC(year, month - 1, day + shift)).toISOString().slice(0, 10);
    return zonedInstant(date, SHIFT_STARTS[shiftType], timeZone);
  });
  return candidates.reduce((best, c) => (Math.abs(c - now) < Math.abs(best - now) ? c : best)).toISOString();
}

/** Whole minutes that a start was after the scheduled time. Zero for an early or on-time start. */
export function lateMinutesFor(startedAtIso, scheduledStartIso) {
  const ms = new Date(startedAtIso).getTime() - new Date(scheduledStartIso).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0;
}

/** Records who started the shift and when. Does nothing if the shift has already been started. */
export function checkIn(shift, user, now) {
  if (shift.startedAt) return shift;
  shift.startedAt = now.toISOString();
  shift.startedById = user.id;
  shift.startedByName = user.name;
  shift.lateMinutes = shift.scheduledStart ? lateMinutesFor(shift.startedAt, shift.scheduledStart) : 0;
  return shift;
}

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

/**
 * A new shift. When `startedBy` is given the shift is checked in at once (a person pressed Start shift). A shift that
 * opens by itself after an approval has no start time until someone starts it or adds the first update.
 */
export function newShift({ shiftType, workArea, departmentId, lead, now, timeZone, startedBy }) {
  const shift = {
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
    scheduledStart: scheduledStartFor(shiftType, now, timeZone),
    startedAt: null,
    lateMinutes: 0,
  };
  if (startedBy) checkIn(shift, startedBy, now);
  return shift;
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
