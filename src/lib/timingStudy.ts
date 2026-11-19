/** One timed handover task, on paper or in the app. */
export interface TimingRun {
  id: string;
  method: 'paper' | 'app';
  task: string;
  /** A label such as P1, never a name. */
  participant: string;
  seconds: number;
  note?: string;
  recordedBy?: string;
  at: string;
}

export interface MethodSummary {
  runs: number;
  meanMinutes: number | null;
  sdMinutes: number | null;
  medianMinutes: number | null;
}

export interface PairedComparison {
  /** Participant and task combinations timed with both methods. */
  pairs: number;
  /** Paper minus app: positive means the app was faster. */
  meanDifferenceMinutes: number | null;
  ci95Minutes: [number, number] | null;
  /** The saving as a share of the paper mean time. */
  percentFaster: number | null;
  /** True when the whole 95% interval is above zero, so the saving is unlikely to be chance. */
  clearlyFaster: boolean;
}

// Two-sided 95% critical values of Student's t, for 1 to 30 degrees of freedom.
const T_95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

export const tCritical95 = (degreesOfFreedom: number) =>
  degreesOfFreedom <= 30 ? T_95[degreesOfFreedom - 1] : degreesOfFreedom <= 60 ? 2.0 : 1.96;

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sd = (values: number[]) => {
  const centre = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - centre) ** 2, 0) / (values.length - 1));
};
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const toMinutes = (seconds: number) => seconds / 60;

export function summarizeMethod(runs: TimingRun[]): MethodSummary {
  const minutes = runs.map((run) => toMinutes(run.seconds));
  if (minutes.length === 0) return { runs: 0, meanMinutes: null, sdMinutes: null, medianMinutes: null };
  return {
    runs: minutes.length,
    meanMinutes: mean(minutes),
    sdMinutes: minutes.length > 1 ? sd(minutes) : null,
    medianMinutes: median(minutes),
  };
}

/**
 * Compares the two methods on the same people doing the same task. Several runs by one person on one task with one
 * method are averaged first, so each pair counts once.
 */
export function comparePaired(runs: TimingRun[]): PairedComparison {
  const cells = new Map<string, { paper: number[]; app: number[] }>();
  for (const run of runs) {
    const key = `${run.participant.trim().toLowerCase()}|${run.task.trim().toLowerCase()}`;
    const cell = cells.get(key) ?? { paper: [], app: [] };
    cell[run.method].push(toMinutes(run.seconds));
    cells.set(key, cell);
  }
  const differences = [...cells.values()]
    .filter((cell) => cell.paper.length > 0 && cell.app.length > 0)
    .map((cell) => mean(cell.paper) - mean(cell.app));
  const paperMean = summarizeMethod(runs.filter((run) => run.method === 'paper')).meanMinutes;

  if (differences.length === 0) {
    return { pairs: 0, meanDifferenceMinutes: null, ci95Minutes: null, percentFaster: null, clearlyFaster: false };
  }
  const difference = mean(differences);
  const percentFaster = paperMean ? (difference / paperMean) * 100 : null;
  if (differences.length < 2) {
    return { pairs: 1, meanDifferenceMinutes: difference, ci95Minutes: null, percentFaster, clearlyFaster: false };
  }
  const margin = tCritical95(differences.length - 1) * (sd(differences) / Math.sqrt(differences.length));
  return {
    pairs: differences.length,
    meanDifferenceMinutes: difference,
    ci95Minutes: [difference - margin, difference + margin],
    percentFaster,
    clearlyFaster: difference - margin > 0,
  };
}
