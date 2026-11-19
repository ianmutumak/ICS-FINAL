import { describe, expect, it } from 'vitest';
import demoData from '../data/demoData.json';
import { AUDIT_EVENT_LABELS, buildAuditEvents } from './auditTrail';
import { demoForecast } from './forecast';
import { createStatisticsSnapshot, demoStatistics } from './statisticsSnapshot';
import { makeCase, makeShift, makeSignedShift } from './testHelpers';

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, value) => total + value, 0);

describe('createStatisticsSnapshot', () => {
  const empty = { tasks: [], attendanceLogs: [], complianceRecords: [] };

  it('does not count the blank draft that exists before a shift is started', () => {
    const snapshot = createStatisticsSnapshot({ activeHandover: makeShift({ handoverCode: '', cases: [] }), archive: [], ...empty });
    expect(snapshot.handoverCount).toBe(0);
    expect(snapshot.transition.averageMinutes).toBeNull();
  });

  it('counts handovers, complete updates and measured handover times', () => {
    const closed = { ...makeSignedShift(), status: 'completed' as const, transitionDurationMinutes: 12.5, cases: [makeCase(), makeCase({ id: 'c2', background: '' })] };
    const snapshot = createStatisticsSnapshot({ activeHandover: makeShift(), archive: [closed], ...empty });
    expect(snapshot.handoverCount).toBe(2);
    expect(snapshot.handoversByStatus).toEqual({ in_progress: 1, completed: 1 });
    expect(snapshot.sbar).toEqual({ total: 3, complete: 2 });
    expect(snapshot.transition).toMatchObject({ measured: 1, averageMinutes: 12.5, withinTarget: 1 });
  });
});

describe('demo statistics', () => {
  it('are internally consistent', () => {
    expect(demoStatistics.datasetKind).toBe('synthetic');
    expect(sum(demoStatistics.handoversByStatus)).toBe(demoStatistics.handoverCount);
    expect(sum(demoStatistics.handoversByShift)).toBe(demoStatistics.handoverCount);
    expect(sum(demoStatistics.handoversByMonth)).toBe(demoStatistics.handoverCount);
    expect(demoStatistics.transition.measured).toBeLessThanOrEqual(demoStatistics.handoverCount);
    expect(demoStatistics.transition.withinTarget).toBeLessThanOrEqual(demoStatistics.transition.measured);
    expect(demoStatistics.sbar.complete).toBeLessThanOrEqual(demoStatistics.sbar.total);
    expect(demoStatistics.attendance.punctual).toBeLessThanOrEqual(demoStatistics.attendance.total);
    expect(Object.values(demoStatistics.tasksByStatus).every((value) => value >= 0)).toBe(true);
  });
});

describe('exported forecast', () => {
  for (const metric of ['handovers', 'carriedOver'] as const) {
    it(`covers 14 days with ordered ranges and shift values that add up (${metric})`, () => {
      const { forecast, history } = demoForecast[metric];
      expect(forecast).toHaveLength(demoData.meta.horizonDays);
      expect(history.length).toBeGreaterThan(0);
      expect(history.at(-1)!.date < forecast[0].date).toBe(true);
      for (const day of forecast) {
        expect(day.low).toBeLessThanOrEqual(day.value);
        expect(day.value).toBeLessThanOrEqual(day.high);
        expect(day.low).toBeGreaterThanOrEqual(0);
        // Each figure is rounded to one decimal, so the three shifts can differ from the total by up to 0.15.
        expect(Math.abs(day.morning + day.evening + day.night - day.value)).toBeLessThanOrEqual(0.2);
      }
    });
  }
});

describe('buildAuditEvents', () => {
  it('lists signatures, acknowledgements, approvals, overrides and forecast decisions newest first', () => {
    const acknowledged = { ...makeSignedShift(), cases: [makeCase({ isolationOrHazardAlert: 'Wet floor', acknowledgedAt: '2026-11-17T19:59:40.000Z', acknowledgedBy: 'Mary' })] };
    const approved = { ...acknowledged, id: 'hnd-2', status: 'completed' as const, completedAt: '2026-11-17T21:00:00.000Z', approvedBy: 'Admin' };
    const overridden = { ...makeSignedShift(), id: 'hnd-3', status: 'completed' as const, completedAt: '2026-11-17T22:00:00.000Z', isOverridden: true };
    const events = buildAuditEvents({
      shifts: [approved, overridden],
      overrides: [{ id: 'o1', shiftId: 'hnd-3', shiftCode: 'X', departmentName: '', adminName: 'Admin', adminId: 'a', actionType: 'emergency_signoff', reason: 'Lead absent', timestamp: '2026-11-17T22:00:00.000Z' }],
      decisions: [{ id: 'f1', metric: 'handovers', date: '2026-11-19', shift: 'morning', expected: 7.3, decision: 'plan', note: 'Extra lead', by: 'Admin', byId: 'a', at: '2026-11-17T23:00:00.000Z' }],
    });
    const types = events.map((event) => event.type);
    expect(types).toContain('warning_acknowledged');
    expect(types.filter((type) => type === 'approved')).toHaveLength(1);
    expect(types.filter((type) => type === 'override')).toHaveLength(1);
    expect(types).toContain('forecast_decision');
    expect([...events].sort((a, b) => b.at.localeCompare(a.at))).toEqual(events);
    expect(events.every((event) => event.type in AUDIT_EVENT_LABELS)).toBe(true);
  });

  it('ignores a blank draft', () => {
    expect(buildAuditEvents({ shifts: [makeShift({ handoverCode: '' })], overrides: [], decisions: [] })).toEqual([]);
  });
});
