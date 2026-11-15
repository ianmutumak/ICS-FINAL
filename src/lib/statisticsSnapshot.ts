import { HandoverRecord, ShiftActionItem, AttendanceAuditLog, SignoffComplianceRecord } from '../types';

export interface StatisticsSnapshot {
  datasetKind: 'application' | 'synthetic';
  dataNote: string;
  handoverCount: number;
  dateRange: { from: string | null; to: string | null };
  handoversByStatus: Record<string, number>;
  handoversByShift: Record<string, number>;
  handoversByMonth: Record<string, number>;
  averageTransitionMinutes: number | null;
  sbar: { total: number; complete: number; incomplete: number; completePercent: number | null };
  tasksByStatus: Record<string, number>;
  attendance: { total: number; punctual: number; punctualPercent: number | null };
  signoffs: { total: number; averageCompliancePercent: number | null };
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item) || 'unspecified';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

export function createStatisticsSnapshot(args: {
  activeHandover: HandoverRecord;
  archive: HandoverRecord[];
  tasks: ShiftActionItem[];
  attendanceLogs: AttendanceAuditLog[];
  complianceRecords: SignoffComplianceRecord[];
}): StatisticsSnapshot {
  const handovers = [args.activeHandover, ...args.archive].filter((shift) =>
    shift.handoverCode || shift.cases.length > 0 || shift.status === 'completed' || shift.status === 'archived'
  );
  const dates = handovers.map((shift) => shift.shiftDate).filter(Boolean).sort();
  const cases = handovers.flatMap((shift) => shift.cases);
  const completeCases = cases.filter((item) =>
    Boolean(item.situation?.trim() && item.background?.trim() && item.assessment?.trim() && item.recommendation?.trim())
  ).length;
  const durations = handovers.filter((shift) => shift.status === 'completed' && shift.transitionDurationMinutes > 0);
  const punctual = args.attendanceLogs.filter((log) => log.punctual).length;
  const complianceTotal = args.complianceRecords.reduce((sum, record) => sum + record.complianceScore, 0);

  return {
    datasetKind: 'application',
    dataNote: 'Aggregated counts from the handover records currently loaded in the app. No names or SBAR text are included.',
    handoverCount: handovers.length,
    dateRange: { from: dates[0] || null, to: dates[dates.length - 1] || null },
    handoversByStatus: countBy(handovers, (shift) => shift.status),
    handoversByShift: countBy(handovers, (shift) => shift.shiftType),
    handoversByMonth: countBy(handovers.filter((shift) => Boolean(shift.shiftDate)), (shift) => shift.shiftDate.slice(0, 7)),
    averageTransitionMinutes: durations.length
      ? Math.round(durations.reduce((sum, shift) => sum + shift.transitionDurationMinutes, 0) / durations.length)
      : null,
    sbar: {
      total: cases.length,
      complete: completeCases,
      incomplete: cases.length - completeCases,
      completePercent: cases.length ? Math.round((completeCases / cases.length) * 100) : null,
    },
    tasksByStatus: countBy(args.tasks, (task) => task.status),
    attendance: {
      total: args.attendanceLogs.length,
      punctual,
      punctualPercent: args.attendanceLogs.length ? Math.round((punctual / args.attendanceLogs.length) * 100) : null,
    },
    signoffs: {
      total: args.complianceRecords.length,
      averageCompliancePercent: args.complianceRecords.length
        ? Math.round(complianceTotal / args.complianceRecords.length)
        : null,
    },
  };
}

export function createSyntheticStatisticsSnapshot(handoverCount = 5000, seed = 144861): StatisticsSnapshot {
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
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 364);
  let durationTotal = 0;
  let durationCount = 0;
  let sbarTotal = 0;
  let sbarComplete = 0;
  let attendanceTotal = 0;
  let punctualTotal = 0;
  let signoffTotal = 0;
  let complianceTotal = 0;

  for (let index = 0; index < handoverCount; index += 1) {
    const dayOffset = Math.floor(random() * 365);
    const shiftDate = new Date(start);
    shiftDate.setUTCDate(start.getUTCDate() + dayOffset);
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

    if (status === 'completed') {
      durationTotal += 12 + Math.floor(random() * 25);
      durationCount += 1;
      signoffTotal += 1;
      complianceTotal += 90 + Math.floor(random() * 11);
    }
  }

  return {
    datasetKind: 'synthetic',
    dataNote: `${handoverCount.toLocaleString()} generated fictional handovers across the last 365 days. This sample is not stored in the database.`,
    handoverCount,
    dateRange: { from: start.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) },
    handoversByStatus,
    handoversByShift,
    handoversByMonth,
    averageTransitionMinutes: durationCount ? Math.round(durationTotal / durationCount) : null,
    sbar: {
      total: sbarTotal,
      complete: sbarComplete,
      incomplete: sbarTotal - sbarComplete,
      completePercent: sbarTotal ? Math.round((sbarComplete / sbarTotal) * 100) : null,
    },
    tasksByStatus,
    attendance: {
      total: attendanceTotal,
      punctual: punctualTotal,
      punctualPercent: attendanceTotal ? Math.round((punctualTotal / attendanceTotal) * 100) : null,
    },
    signoffs: {
      total: signoffTotal,
      averageCompliancePercent: signoffTotal ? Math.round(complianceTotal / signoffTotal) : null,
    },
  };
}
