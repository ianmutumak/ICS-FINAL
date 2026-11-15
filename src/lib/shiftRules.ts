import { HandoverEffectivenessIndex, HandoverRecord, ShiftType, UserStaff } from '../types';

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

/** Whole minutes between two ISO timestamps. 0 means the duration could not be measured. */
export function minutesBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.max(1, Math.ceil(ms / 60000));
}

export const formatTime = (date: Date | string = new Date()) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Staff details that are safe to embed in shared records. The PIN stays in the staff list. */
export function toPublicStaff(staff: UserStaff): UserStaff {
  const { pin: _pin, ...publicFields } = staff;
  return publicFields;
}

export const isClosedShift = (shift: HandoverRecord) => shift.status === 'completed' || shift.status === 'archived';

/** Handover Effectiveness Index: SBAR completeness (40), safety acknowledgement (35), equipment custody (25). */
export function calculateHEI(shift: HandoverRecord): HandoverEffectivenessIndex {
  const totalCases = shift.cases.length;
  const completedSbarCases = shift.cases.filter(
    (c) => c.situation?.trim() && c.assessment?.trim() && c.recommendation?.trim()
  ).length;
  const sbarCompleteness = totalCases > 0 ? Math.round((completedSbarCases / totalCases) * 40) : 40;

  const criticalCases = shift.cases.filter((c) => c.acuity === 'critical' || c.acuity === 'unstable');
  const criticalAlertsTotal = criticalCases.length;
  const criticalAlertsAcknowledged = criticalCases.filter(
    (c) => c.recommendation?.trim().length > 0 || Boolean(c.isolationOrHazardAlert)
  ).length;
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
