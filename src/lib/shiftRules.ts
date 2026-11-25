import { HandoverEffectivenessIndex, HandoverRecord, SbarCase, ShiftType } from '../types';

export const SHIFT_WINDOWS: Record<ShiftType, string> = {
  morning: '07:00 - 15:30',
  evening: '15:00 - 23:30',
  night: '23:00 - 07:30',
};

export const NEXT_SHIFT: Record<ShiftType, ShiftType> = {
  morning: 'evening',
  evening: 'night',
  night: 'morning',
};

export function makeHandoverCode(shiftType: ShiftType): string {
  return `ZAMU-${new Date().getFullYear()}-${shiftType.toUpperCase().slice(0, 3)}-${Math.floor(Math.random() * 900 + 100)}`;
}

/** Calendar date in the device's own time zone (toISOString alone would give the UTC date). */
export function localDateString(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Minutes between two ISO timestamps, to a tenth of a minute. 0 means the duration could not be measured. */
export function minutesBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.max(0.1, Math.round(ms / 6000) / 10);
}

/**
 * A SHA-256 fingerprint of a signed handover: its updates, the two signers and the two signing
 * times. Changing any of those afterwards gives a different fingerprint, so the stored value shows
 * whether the record is still the one that was signed. Returns undefined where the browser has no
 * Web Crypto (an insecure page).
 */
export async function sealHandover(shift: HandoverRecord): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
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
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const formatTime = (date: Date | string = new Date()) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const isClosedShift = (shift: HandoverRecord) => shift.status === 'completed' || shift.status === 'archived';

export const hasSafetyWarning = (c: SbarCase) => Boolean(c.isolationOrHazardAlert?.trim());
export const isCompleteSbar = (c: SbarCase) =>
  Boolean(c.situation?.trim() && c.background?.trim() && c.assessment?.trim() && c.recommendation?.trim());

/** Updates whose safety warning the incoming staff member has not yet acknowledged. */
export const unacknowledgedWarnings = (shift: HandoverRecord) =>
  shift.cases.filter((c) => hasSafetyWarning(c) && !c.acknowledgedAt);

/** A shift lasts 8.5 hours, so a handover still unsigned well after that is overdue. */
export const UNSIGNED_OVERDUE_HOURS = 9.5;
/** An administrator should approve a fully signed handover within this time. */
export const APPROVAL_OVERDUE_HOURS = 4;

export interface HandoverAlert {
  kind: 'unsigned_overdue' | 'approval_overdue';
  hours: number;
  message: string;
}

/** Flags a handover that has been waiting too long for its signatures or for approval. */
export function handoverAlert(shift: HandoverRecord, now: Date = new Date()): HandoverAlert | null {
  if (!shift.handoverCode || isClosedShift(shift)) return null;
  const hoursSince = (iso?: string) => (iso ? (now.getTime() - new Date(iso).getTime()) / 3600000 : 0);
  if (shift.signoff.incomingConfirmed) {
    const hours = hoursSince(shift.signoff.incomingSignedAt);
    return hours > APPROVAL_OVERDUE_HOURS
      ? { kind: 'approval_overdue', hours, message: `Signed by both staff ${Math.floor(hours)} hours ago and still waiting for administrator approval.` }
      : null;
  }
  const hours = hoursSince(shift.createdAt);
  return hours > UNSIGNED_OVERDUE_HOURS
    ? { kind: 'unsigned_overdue', hours, message: `This shift started ${Math.floor(hours)} hours ago and has not been signed by both staff members.` }
    : null;
}

/** A start up to this many minutes after the scheduled time counts as on time. Must equal LATE_GRACE_MINUTES in server/rules.js. */
export const LATE_GRACE_MINUTES = 15;

export type StartStatus =
  /** The shift was started within the grace period (or early). */
  | { kind: 'on_time'; minutes: number }
  /** The shift was started after the grace period. */
  | { kind: 'late'; minutes: number }
  /** Not started yet, and still before the grace period has run out. */
  | { kind: 'waiting'; minutes: number }
  /** Not started, and the grace period has run out. */
  | { kind: 'not_started'; minutes: number }
  /** The record has no schedule (made before start times were recorded). */
  | { kind: 'unknown'; minutes: 0 };

/** Whether a shift started on time, started late, or has still not started, measured against its scheduled start. */
export function startStatus(shift: HandoverRecord, now: Date = new Date()): StartStatus {
  if (!shift.handoverCode || !shift.scheduledStart) return { kind: 'unknown', minutes: 0 };
  if (shift.startedAt) {
    const minutes = shift.lateMinutes ?? 0;
    return { kind: minutes > LATE_GRACE_MINUTES ? 'late' : 'on_time', minutes };
  }
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(shift.scheduledStart).getTime()) / 60000));
  return { kind: minutes > LATE_GRACE_MINUTES ? 'not_started' : 'waiting', minutes };
}

const hoursAndMinutes = (minutes: number) =>
  minutes < 60 ? `${minutes} minutes` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;

export interface LatenessAlert {
  shift: HandoverRecord;
  status: StartStatus;
  message: string;
}

/** The sentence an administrator reads about a late start, or null when the shift is not late. */
export function latenessMessage(shift: HandoverRecord, status: StartStatus): string | null {
  const name = `${shift.shiftType[0].toUpperCase()}${shift.shiftType.slice(1)} shift`;
  const where = shift.wardOrDepartment ? ` in ${shift.wardOrDepartment}` : '';
  const scheduled = shift.scheduledStart ? formatTime(shift.scheduledStart) : '';
  if (status.kind === 'late') {
    return `${name}${where} was started ${hoursAndMinutes(status.minutes)} late by ${shift.startedByName || 'a staff member'}. It was due at ${scheduled}.`;
  }
  if (status.kind === 'not_started') {
    return `${name}${where} has not been started. It was due at ${scheduled}, ${hoursAndMinutes(status.minutes)} ago.`;
  }
  return null;
}

/**
 * Shifts that started late or have not started, newest first. Lateness is separate from the workload forecast:
 * it is about when work began, not how much work there is.
 */
export function latenessAlerts(shifts: HandoverRecord[], now: Date = new Date()): LatenessAlert[] {
  return shifts
    .filter((shift) => shift.handoverCode && shift.status !== 'archived')
    .map((shift) => ({ shift, status: startStatus(shift, now) }))
    .flatMap(({ shift, status }) => {
      const message = latenessMessage(shift, status);
      return message ? [{ shift, status, message }] : [];
    })
    .sort((a, b) => (b.shift.scheduledStart ?? '').localeCompare(a.shift.scheduledStart ?? ''));
}

/** Handover Effectiveness Index: SBAR completeness (40), safety acknowledgement (35), equipment custody (25). */
export function calculateHEI(shift: HandoverRecord): HandoverEffectivenessIndex {
  const totalCases = shift.cases.length;
  const completedSbarCases = shift.cases.filter(isCompleteSbar).length;
  const sbarCompleteness = totalCases > 0 ? Math.round((completedSbarCases / totalCases) * 40) : 40;

  // Safety warnings are the high-risk items. One counts as handled once the incoming staff member has acknowledged it.
  const criticalCases = shift.cases.filter(hasSafetyWarning);
  const criticalAlertsTotal = criticalCases.length;
  const criticalAlertsAcknowledged = criticalCases.filter((c) => Boolean(c.acknowledgedAt)).length;
  const safetyAck = criticalAlertsTotal > 0 ? Math.round((criticalAlertsAcknowledged / criticalAlertsTotal) * 35) : 35;

  const equipmentTotal = shift.equipment.length;
  const equipmentChecked = shift.equipment.filter((e) => e.custodyChecked).length;
  const equipmentCustody = equipmentTotal > 0 ? Math.round((equipmentChecked / equipmentTotal) * 25) : 25;

  const penalties = (criticalAlertsTotal - criticalAlertsAcknowledged) * 10;
  const score = Math.max(0, Math.min(100, sbarCompleteness + safetyAck + equipmentCustody - penalties));

  let rating: HandoverEffectivenessIndex['rating'] = 'Deficient';
  if (score >= 85) rating = 'Optimal';
  else if (score >= 70) rating = 'Satisfactory';
  else if (score >= 50) rating = 'At-Risk';

  return {
    score,
    rating,
    breakdown: { sbarCompleteness, safetyAck, equipmentCustody, penalties },
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
