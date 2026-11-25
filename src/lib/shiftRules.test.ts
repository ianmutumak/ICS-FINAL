import { describe, expect, it } from 'vitest';
import {
  APPROVAL_OVERDUE_HOURS,
  LATE_GRACE_MINUTES,
  UNSIGNED_OVERDUE_HOURS,
  calculateHEI,
  handoverAlert,
  latenessAlerts,
  latenessMessage,
  localDateString,
  minutesBetween,
  sealHandover,
  startStatus,
  unacknowledgedWarnings,
} from './shiftRules';
import { makeCase, makeShift, makeSignedShift } from './testHelpers';

describe('minutesBetween', () => {
  it('records to a tenth of a minute', () => {
    expect(minutesBetween('2026-11-17T10:00:00Z', '2026-11-17T10:00:06Z')).toBe(0.1);
    expect(minutesBetween('2026-11-17T10:00:00Z', '2026-11-17T10:00:09Z')).toBe(0.2);
    expect(minutesBetween('2026-11-17T10:00:00Z', '2026-11-17T10:00:01Z')).toBe(0.1);
    expect(minutesBetween('2026-11-17T10:00:00Z', '2026-11-17T10:01:30Z')).toBe(1.5);
    expect(minutesBetween('2026-11-17T10:00:00Z', '2026-11-17T10:20:00Z')).toBe(20);
  });
  it('returns 0 when the time cannot be measured', () => {
    expect(minutesBetween('2026-11-17T10:00:00Z', '2026-11-17T09:00:00Z')).toBe(0);
    expect(minutesBetween('not a date', '2026-11-17T09:00:00Z')).toBe(0);
  });
});

describe('localDateString', () => {
  it('formats as YYYY-MM-DD in the local time zone', () => {
    expect(localDateString(new Date(2026, 10, 17, 23, 30))).toBe('2026-11-17');
    expect(localDateString(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02');
  });
});

describe('sealHandover', () => {
  it('produces a stable 64-character SHA-256 hex string', async () => {
    const seal = await sealHandover(makeSignedShift());
    expect(seal).toMatch(/^[0-9a-f]{64}$/);
    expect(await sealHandover(makeSignedShift())).toBe(seal);
  });
  it('changes when an update, an acknowledgement or equipment changes after signing', async () => {
    const original = await sealHandover(makeSignedShift());
    const edited = makeSignedShift();
    edited.cases[0].situation = 'Changed later';
    expect(await sealHandover(edited)).not.toBe(original);

    const acknowledged = makeSignedShift();
    acknowledged.cases[0].acknowledgedAt = '2026-11-17T19:59:30.000Z';
    expect(await sealHandover(acknowledged)).not.toBe(original);

    const withEquipment = makeSignedShift();
    withEquipment.equipment = [{ id: 'e1', name: 'Reach truck', assetTag: 'RT-1', location: '', status: 'functional', custodyChecked: true }];
    expect(await sealHandover(withEquipment)).not.toBe(original);
  });
  it('ignores fields that change when the handover is approved', async () => {
    const original = await sealHandover(makeSignedShift());
    const approved = { ...makeSignedShift(), status: 'completed' as const, completedAt: '2026-11-17T21:00:00.000Z', approvedBy: 'Admin' };
    expect(await sealHandover(approved)).toBe(original);
  });
});

describe('Handover Effectiveness Index', () => {
  it('is full marks when there is nothing incomplete or unchecked', () => {
    expect(calculateHEI(makeShift()).score).toBe(100);
  });
  it('drops for an incomplete SBAR update', () => {
    const shift = makeShift({ cases: [makeCase(), makeCase({ id: 'c2', recommendation: '' })] });
    const hei = calculateHEI(shift);
    expect(hei.details.completedSbarCases).toBe(1);
    expect(hei.breakdown.sbarCompleteness).toBe(20);
    expect(hei.score).toBe(80);
  });
  it('penalises a safety warning until it is acknowledged', () => {
    const warned = makeShift({ cases: [makeCase({ isolationOrHazardAlert: 'Wet floor' })] });
    expect(calculateHEI(warned).score).toBe(55);
    const acknowledged = makeShift({ cases: [makeCase({ isolationOrHazardAlert: 'Wet floor', acknowledgedAt: '2026-11-17T20:00:00Z' })] });
    expect(calculateHEI(acknowledged).score).toBe(100);
    expect(calculateHEI(acknowledged).details).toMatchObject({ criticalAlertsTotal: 1, criticalAlertsAcknowledged: 1 });
  });
  it('counts equipment custody checks', () => {
    const equipment = [
      { id: 'e1', name: 'A', assetTag: '', location: '', status: 'functional' as const, custodyChecked: true },
      { id: 'e2', name: 'B', assetTag: '', location: '', status: 'faulty' as const, custodyChecked: false },
    ];
    const hei = calculateHEI(makeShift({ equipment }));
    expect(hei.details).toMatchObject({ equipmentTotal: 2, equipmentChecked: 1 });
    expect(hei.breakdown.equipmentCustody).toBe(13);
  });
  it('stays between 0 and 100', () => {
    const many = Array.from({ length: 10 }, (_, i) => makeCase({ id: `c${i}`, situation: '', isolationOrHazardAlert: 'x' }));
    const score = calculateHEI(makeShift({ cases: many })).score;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('unacknowledgedWarnings', () => {
  it('lists only warnings that are not yet acknowledged', () => {
    const shift = makeShift({
      cases: [
        makeCase({ id: 'a' }),
        makeCase({ id: 'b', isolationOrHazardAlert: 'Hazard' }),
        makeCase({ id: 'c', isolationOrHazardAlert: 'Hazard', acknowledgedAt: '2026-11-17T20:00:00Z' }),
        makeCase({ id: 'd', isolationOrHazardAlert: '   ' }),
      ],
    });
    expect(unacknowledgedWarnings(shift).map((c) => c.id)).toEqual(['b']);
  });
});

describe('handoverAlert', () => {
  const start = new Date('2026-11-17T12:00:00.000Z');
  const hoursLater = (hours: number) => new Date(start.getTime() + hours * 3600000);

  it('is quiet for a blank draft and for a recent shift', () => {
    expect(handoverAlert(makeShift({ handoverCode: '' }), hoursLater(48))).toBeNull();
    expect(handoverAlert(makeShift(), hoursLater(UNSIGNED_OVERDUE_HOURS - 0.5))).toBeNull();
  });
  it('flags a shift left unsigned for too long', () => {
    expect(handoverAlert(makeShift(), hoursLater(UNSIGNED_OVERDUE_HOURS + 0.5))?.kind).toBe('unsigned_overdue');
  });
  it('flags a fully signed handover that nobody approved', () => {
    const signed = makeSignedShift('2026-11-17T20:00:00.000Z');
    const signedAt = new Date('2026-11-17T20:00:00.000Z');
    expect(handoverAlert(signed, new Date(signedAt.getTime() + (APPROVAL_OVERDUE_HOURS - 1) * 3600000))).toBeNull();
    expect(handoverAlert(signed, new Date(signedAt.getTime() + (APPROVAL_OVERDUE_HOURS + 1) * 3600000))?.kind).toBe('approval_overdue');
  });
  it('is quiet once the shift is closed', () => {
    expect(handoverAlert(makeShift({ status: 'completed' }), hoursLater(100))).toBeNull();
  });
});

describe('startStatus and lateness alerts', () => {
  const scheduledStart = '2026-11-17T12:00:00.000Z';
  const minutesAfter = (minutes: number) => new Date(new Date(scheduledStart).getTime() + minutes * 60000);
  const started = (lateMinutes: number) => makeShift({ scheduledStart, startedAt: minutesAfter(lateMinutes).toISOString(), startedByName: 'David', lateMinutes });
  const notStarted = makeShift({ scheduledStart, startedAt: null });

  it('has the same grace period as the server', () => {
    expect(LATE_GRACE_MINUTES).toBe(15);
  });

  it('counts a start within the grace period, or early, as on time', () => {
    expect(startStatus(started(0)).kind).toBe('on_time');
    expect(startStatus(started(LATE_GRACE_MINUTES)).kind).toBe('on_time');
  });

  it('flags a start after the grace period as late, with the minutes', () => {
    expect(startStatus(started(LATE_GRACE_MINUTES + 1))).toEqual({ kind: 'late', minutes: LATE_GRACE_MINUTES + 1 });
    expect(startStatus(started(95))).toEqual({ kind: 'late', minutes: 95 });
  });

  it('waits for a shift that has not started, then flags it once the grace period has passed', () => {
    expect(startStatus(notStarted, minutesAfter(-30))).toEqual({ kind: 'waiting', minutes: 0 });
    expect(startStatus(notStarted, minutesAfter(LATE_GRACE_MINUTES)).kind).toBe('waiting');
    expect(startStatus(notStarted, minutesAfter(LATE_GRACE_MINUTES + 5))).toEqual({ kind: 'not_started', minutes: LATE_GRACE_MINUTES + 5 });
  });

  it('says nothing about records made before schedules were recorded, or about the blank draft', () => {
    expect(startStatus(makeShift()).kind).toBe('unknown');
    expect(startStatus(makeShift({ handoverCode: '', scheduledStart })).kind).toBe('unknown');
  });

  it('writes a plain message for an administrator, and none for a shift that is on time', () => {
    const late = started(40);
    expect(latenessMessage(late, startStatus(late))).toMatch(/Evening shift in Import warehouse was started 40 minutes late by David/);
    const missing = latenessMessage(notStarted, startStatus(notStarted, minutesAfter(75)));
    expect(missing).toMatch(/has not been started/);
    expect(missing).toMatch(/1 h 15 min ago/);
    expect(latenessMessage(started(5), startStatus(started(5)))).toBeNull();
  });

  it('lists only late or unstarted shifts, newest first, and leaves out cancelled ones', () => {
    const older = makeShift({ id: 'old', scheduledStart: '2026-11-16T12:00:00.000Z', startedAt: '2026-11-16T13:00:00.000Z', lateMinutes: 60 });
    const cancelled = makeShift({ id: 'gone', status: 'archived', scheduledStart, startedAt: null });
    const list = latenessAlerts([started(40), older, started(2), cancelled, notStarted], minutesAfter(120));
    expect(list.map((alert) => alert.shift.id)).toEqual(['hnd-1', 'hnd-1', 'old']);
    expect(latenessAlerts([started(2)], minutesAfter(120))).toEqual([]);
  });
});
