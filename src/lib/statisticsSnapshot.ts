import demoData from '../data/demoData.json';
import type { HandoverRecord, ShiftActionItem, AttendanceAuditLog, SignoffComplianceRecord } from '../types';

/** A handover should take no longer than this between the two signatures. */
export const TRANSITION_TARGET_MINUTES = 20;

/**
 * Aggregate figures for the statistics page and the assistant.
 * It holds counts only: no names and no SBAR text ever leave the browser.
 */
export interface StatisticsSnapshot {
  datasetKind: 'application' | 'synthetic';
  handoverCount: number;
  dateRange: { from: string | null; to: string | null };
  handoversByStatus: Record<string, number>;
  handoversByShift: Record<string, number>;
  handoversByMonth: Record<string, number>;
  /** Minutes between the outgoing and incoming signatures, for handovers where both exist. */
  transition: {
    measured: number;
    averageMinutes: number | null;
    withinTarget: number;
    targetMinutes: number;
    averageByShift: Record<string, number>;
  };
  sbar: { total: number; complete: number };
  tasksByStatus: Record<string, number>;
  attendance: { total: number; punctual: number };
  signoffs: { total: number };
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item) || 'unspecified';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

/** Running totals of handover durations, overall and per shift. */
class DurationTally {
  private total = 0;
  private count = 0;
  private withinTarget = 0;
  private byShift: Record<string, { total: number; count: number }> = {};

  add(shiftType: string, minutes: number) {
    this.total += minutes;
    this.count += 1;
    if (minutes <= TRANSITION_TARGET_MINUTES) this.withinTarget += 1;
    const shift = (this.byShift[shiftType] ??= { total: 0, count: 0 });
    shift.total += minutes;
    shift.count += 1;
  }

  summary(): StatisticsSnapshot['transition'] {
    return {
      measured: this.count,
      averageMinutes: this.count ? Math.round((this.total / this.count) * 10) / 10 : null,
      withinTarget: this.withinTarget,
      targetMinutes: TRANSITION_TARGET_MINUTES,
      averageByShift: Object.fromEntries(
        Object.entries(this.byShift).map(([shift, { total, count }]) => [shift, Math.round((total / count) * 10) / 10])
      ),
    };
  }
}

export function createStatisticsSnapshot(args: {
  activeHandover: HandoverRecord;
  archive: HandoverRecord[];
  tasks: ShiftActionItem[];
  attendanceLogs: AttendanceAuditLog[];
  complianceRecords: SignoffComplianceRecord[];
}): StatisticsSnapshot {
  // The blank draft that exists before a shift is started is not a handover.
  const handovers = [args.activeHandover, ...args.archive].filter((shift) => Boolean(shift.handoverCode));
  const dates = handovers.map((shift) => shift.shiftDate).filter(Boolean).sort();
  const cases = handovers.flatMap((shift) => shift.cases);
  const completeCases = cases.filter((item) =>
    Boolean(item.situation?.trim() && item.background?.trim() && item.assessment?.trim() && item.recommendation?.trim())
  ).length;

  const durations = new DurationTally();
  handovers
    .filter((shift) => shift.transitionDurationMinutes > 0)
    .forEach((shift) => durations.add(shift.shiftType, shift.transitionDurationMinutes));

  // Tasks rolled into a shift are tracked on the shift; standalone tasks are tracked in the task list.
  const shiftTaskIds = new Set(handovers.flatMap((shift) => shift.actions.map((action) => action.id)));
  const allTasks = [
    ...handovers.flatMap((shift) => shift.actions),
    ...args.tasks.filter((task) => !shiftTaskIds.has(task.id)),
  ];

  return {
    datasetKind: 'application',
    handoverCount: handovers.length,
    dateRange: { from: dates[0] || null, to: dates[dates.length - 1] || null },
    handoversByStatus: countBy(handovers, (shift) => shift.status),
    handoversByShift: countBy(handovers, (shift) => shift.shiftType),
    handoversByMonth: countBy(handovers.filter((shift) => Boolean(shift.shiftDate)), (shift) => shift.shiftDate.slice(0, 7)),
    transition: durations.summary(),
    sbar: { total: cases.length, complete: completeCases },
    tasksByStatus: countBy(allTasks, (task) => task.status),
    attendance: {
      total: args.attendanceLogs.length,
      punctual: args.attendanceLogs.filter((log) => log.punctual).length,
    },
    signoffs: { total: args.complianceRecords.length },
  };
}

/**
 * Demo figures for testing and presentations: the most recent year of the generated history.
 * They come from the same dataset the forecast is trained on (see ml/), so the two always agree.
 * Nothing here is written to the database.
 */
export const demoStatistics = demoData.snapshot as unknown as StatisticsSnapshot;
