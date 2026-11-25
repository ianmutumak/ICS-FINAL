import type { AdminOverrideLog, HandoverRecord } from '../types';
import { LATE_GRACE_MINUTES } from './shiftRules';

/** One administrator decision about a forecast warning, kept as a record of human oversight. */
export interface ForecastDecision {
  id: string;
  metric: 'handovers' | 'carriedOver';
  /** The forecast day and shift the decision is about. */
  date: string;
  shift: string;
  expected: number;
  decision: 'plan' | 'dismiss';
  note: string;
  by: string;
  byId: string;
  at: string;
}

export type AuditEventType =
  | 'shift_started'
  | 'outgoing_signed'
  | 'warning_acknowledged'
  | 'incoming_signed'
  | 'approved'
  | 'override'
  | 'forecast_decision';

export interface AuditEvent {
  id: string;
  at: string;
  type: AuditEventType;
  who: string;
  detail: string;
  /** The handover the event belongs to, where there is one. */
  shiftId?: string;
  code?: string;
}

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  shift_started: 'Shift started',
  outgoing_signed: 'Outgoing signature',
  warning_acknowledged: 'Warning acknowledged',
  incoming_signed: 'Incoming signature',
  approved: 'Approved',
  override: 'Override',
  forecast_decision: 'Forecast review',
};

/**
 * Builds a single chronological record of who did what, from the handovers, the override ledger
 * and the forecast decisions. It is derived, never edited: nothing here can change a record.
 */
export function buildAuditEvents(args: {
  shifts: HandoverRecord[];
  overrides: AdminOverrideLog[];
  decisions: ForecastDecision[];
}): AuditEvent[] {
  const events: AuditEvent[] = [];

  for (const shift of args.shifts.filter((s) => Boolean(s.handoverCode))) {
    const base = { shiftId: shift.id, code: shift.handoverCode };
    const { signoff } = shift;
    if (shift.createdAt) {
      // Once someone has started the shift, the entry carries their name, the time they started and any lateness.
      const startedAt = shift.startedAt || undefined;
      const late = shift.lateMinutes ?? 0;
      const timing = startedAt && shift.scheduledStart
        ? late > LATE_GRACE_MINUTES ? `, started ${late} min late` : ', started on time'
        : '';
      events.push({
        ...base, id: `${shift.id}-start`, at: startedAt ?? shift.createdAt, type: 'shift_started',
        who: (startedAt && shift.startedByName) || signoff.outgoingStaffName || shift.leadOutgoing.name,
        detail: `${shift.shiftType} shift in ${shift.wardOrDepartment}${timing}`,
      });
    }
    if (signoff.outgoingConfirmed && signoff.outgoingSignedAt) {
      events.push({
        ...base, id: `${shift.id}-out`, at: signoff.outgoingSignedAt, type: 'outgoing_signed',
        who: signoff.outgoingStaffName, detail: `Signed off ${shift.cases.length} update${shift.cases.length === 1 ? '' : 's'}`,
      });
    }
    for (const update of shift.cases.filter((c) => c.acknowledgedAt)) {
      events.push({
        ...base, id: `${shift.id}-ack-${update.id}`, at: update.acknowledgedAt as string, type: 'warning_acknowledged',
        who: update.acknowledgedBy ?? 'Unknown', detail: `Warning on "${update.subjectRef}"`,
      });
    }
    if (signoff.incomingConfirmed && signoff.incomingSignedAt) {
      events.push({
        ...base, id: `${shift.id}-in`, at: signoff.incomingSignedAt, type: 'incoming_signed',
        who: signoff.incomingStaffName, detail: signoff.verificationHash ? `Sealed ${signoff.verificationHash.slice(0, 12)}…` : 'No seal recorded',
      });
    }
    // An override has its own entry in the override ledger, so it is not listed twice.
    if (shift.completedAt && !shift.isOverridden) {
      events.push({
        ...base, id: `${shift.id}-approved`, at: shift.completedAt, type: 'approved',
        who: shift.approvedBy ?? 'Administrator (not recorded)', detail: 'Approved and closed the shift',
      });
    }
  }

  for (const log of args.overrides) {
    events.push({
      id: log.id, at: log.timestamp, type: 'override', who: log.adminName, shiftId: log.shiftId, code: log.shiftCode,
      detail: `Executive override: ${log.reason}`,
    });
  }

  for (const decision of args.decisions) {
    events.push({
      id: decision.id, at: decision.at, type: 'forecast_decision', who: decision.by,
      detail: `${decision.decision === 'plan' ? 'Planned for' : 'Dismissed'} a busy ${decision.shift} shift on ${decision.date} (about ${decision.expected})${decision.note ? `: ${decision.note}` : ''}`,
    });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}
