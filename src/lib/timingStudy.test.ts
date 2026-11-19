import { describe, expect, it } from 'vitest';
import { TimingRun, comparePaired, summarizeMethod, tCritical95 } from './timingStudy';

const run = (method: 'paper' | 'app', participant: string, seconds: number, task = 'Full handover'): TimingRun => ({
  id: `${method}-${participant}-${seconds}`, method, task, participant, seconds, at: '2026-11-19T10:00:00Z',
});

describe('summarizeMethod', () => {
  it('reports mean, spread and median in minutes', () => {
    const summary = summarizeMethod([run('paper', 'P1', 300), run('paper', 'P2', 600), run('paper', 'P3', 900)]);
    expect(summary).toMatchObject({ runs: 3, meanMinutes: 10, medianMinutes: 10 });
    expect(summary.sdMinutes).toBeCloseTo(5, 6);
  });
  it('handles no runs and a single run', () => {
    expect(summarizeMethod([])).toEqual({ runs: 0, meanMinutes: null, sdMinutes: null, medianMinutes: null });
    expect(summarizeMethod([run('app', 'P1', 120)])).toMatchObject({ runs: 1, meanMinutes: 2, sdMinutes: null });
  });
});

describe('comparePaired', () => {
  it('needs both methods for the same participant and task', () => {
    expect(comparePaired([run('paper', 'P1', 600), run('app', 'P2', 300)]).pairs).toBe(0);
  });

  it('computes the saving and a 95% interval from the paired differences', () => {
    // Differences (paper minus app) of 2, 4, 3 and 5 minutes: mean 3.5, SD 1.29, t(3) = 3.182.
    const runs = [
      run('paper', 'P1', 600), run('app', 'P1', 480),
      run('paper', 'P2', 720), run('app', 'P2', 480),
      run('paper', 'P3', 660), run('app', 'P3', 480),
      run('paper', 'P4', 780), run('app', 'P4', 480),
    ];
    const result = comparePaired(runs);
    expect(result.pairs).toBe(4);
    expect(result.meanDifferenceMinutes).toBeCloseTo(3.5, 6);
    const margin = (3.182 * Math.sqrt(5 / 3)) / 2;
    expect(result.ci95Minutes![0]).toBeCloseTo(3.5 - margin, 2);
    expect(result.ci95Minutes![1]).toBeCloseTo(3.5 + margin, 2);
    // The paper times are 10, 12, 11 and 13 minutes, so their mean is 11.5.
    expect(result.percentFaster).toBeCloseTo((3.5 / 11.5) * 100, 4);
    expect(result.clearlyFaster).toBe(true);
  });

  it('averages repeated runs so each pair counts once', () => {
    const runs = [run('paper', 'P1', 600), run('paper', 'P1', 800), run('app', 'P1', 300), run('app', 'P1', 500)];
    const result = comparePaired(runs);
    expect(result.pairs).toBe(1);
    expect(result.meanDifferenceMinutes).toBeCloseTo(5, 6);
    expect(result.ci95Minutes).toBeNull();
  });

  it('does not call a result clear when the interval includes zero', () => {
    const runs = [
      run('paper', 'P1', 300), run('app', 'P1', 360),
      run('paper', 'P2', 420), run('app', 'P2', 300),
      run('paper', 'P3', 300), run('app', 'P3', 330),
    ];
    expect(comparePaired(runs).clearlyFaster).toBe(false);
  });
});

describe('tCritical95', () => {
  it('matches the t table', () => {
    expect(tCritical95(1)).toBe(12.706);
    expect(tCritical95(9)).toBe(2.262);
    expect(tCritical95(30)).toBe(2.042);
    expect(tCritical95(1000)).toBe(1.96);
  });
});
