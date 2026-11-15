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
      averageMinutes: this.count ? Math.round(this.total / this.count) : null,
      withinTarget: this.withinTarget,
      targetMinutes: TRANSITION_TARGET_MINUTES,
      averageByShift: Object.fromEntries(
        Object.entries(this.byShift).map(([shift, { total, count }]) => [shift, Math.round(total / count)])
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

let cachedSynthetic: { key: string; snapshot: StatisticsSnapshot } | null = null;

/**
 * Generated sample figures for testing and demonstrations.
 * A fixed seed gives the same data on every device on a given day. Nothing is written to the database.
 */
export function createSyntheticStatisticsSnapshot(handoverCount = 5000, seed = 144861): StatisticsSnapshot {
  const today = new Date();
  const cacheKey = `${handoverCount}:${seed}:${today.toISOString().slice(0, 10)}`;
  if (cachedSynthetic?.key === cacheKey) return cachedSynthetic.snapshot;

  // mulberry32: a small, repeatable random number generator.
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const handoversByStatus: Record<string, number> = { completed: 0, pending_signoff: 0, in_progress: 0 };
  const handoversByShift: Record<string, number> = { morning: 0, evening: 0, night: 0 };
  const handoversByMonth: Record<string, number> = {};
  const tasksByStatus: Record<string, number> = { completed: 0, pending: 0, in_progress: 0, carried_over: 0 };
  const durations = new DurationTally();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 364);
  let sbarTotal = 0;
  let sbarComplete = 0;
  let attendanceTotal = 0;
  let punctualTotal = 0;
  let signoffTotal = 0;

  for (let index = 0; index < handoverCount; index += 1) {
    const shiftDate = new Date(start);
    shiftDate.setUTCDate(start.getUTCDate() + Math.floor(random() * 365));
    const month = shiftDate.toISOString().slice(0, 7);
    const statusDraw = random();
    const status = statusDraw < 0.72 ? 'completed' : statusDraw < 0.91 ? 'pending_signoff' : 'in_progress';
    const shiftType = ['morning', 'evening', 'night'][Math.floor(random() * 3)];
    handoversByStatus[status] += 1;
    handoversByShift[shiftType] += 1;
    handoversByMonth[month] = (handoversByMonth[month] || 0) + 1;

    const caseCount = 1 + Math.floor(random() * 5);
    sbarTotal += caseCount;
    for (let caseIndex = 0; caseIndex < caseCount; caseIndex += 1) {
      if (random() < 0.84) sbarComplete += 1;
    }

    const taskCount = Math.floor(random() * 6);
    for (let taskIndex = 0; taskIndex < taskCount; taskIndex += 1) {
      const taskDraw = random();
      const taskStatus = taskDraw < 0.62 ? 'completed' : taskDraw < 0.79 ? 'pending' : taskDraw < 0.93 ? 'in_progress' : 'carried_over';
      tasksByStatus[taskStatus] += 1;
    }

    const staffCount = 3 + Math.floor(random() * 6);
    attendanceTotal += staffCount;
    for (let staffIndex = 0; staffIndex < staffCount; staffIndex += 1) {
      if (random() < 0.88) punctualTotal += 1;
    }

    // Both signatures exist once a handover is awaiting approval or completed.
    if (status !== 'in_progress') {
      signoffTotal += 1;
      // Night handovers run a little longer, as tired crews do.
      durations.add(shiftType, 8 + Math.floor(random() * 22) + (shiftType === 'night' ? 4 : 0));
    }
  }

  const snapshot: StatisticsSnapshot = {
    datasetKind: 'synthetic',
    handoverCount,
    dateRange: { from: start.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) },
    handoversByStatus,
    handoversByShift,
    handoversByMonth,
    transition: durations.summary(),
    sbar: { total: sbarTotal, complete: sbarComplete },
    tasksByStatus,
    attendance: { total: attendanceTotal, punctual: punctualTotal },
    signoffs: { total: signoffTotal },
  };
  cachedSynthetic = { key: cacheKey, snapshot };
  return snapshot;
}
