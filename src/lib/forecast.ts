import demoData from '../data/demoData.json';

/**
 * The workload forecast produced by the Python model in ml/.
 * The app only displays it; training and evaluation happen in ml/train_forecast.py.
 */

export interface ForecastDay {
  date: string;
  /** Predicted total for the day, with an 80% range. */
  value: number;
  low: number;
  high: number;
  morning: number;
  evening: number;
  night: number;
}

export interface ForecastSeries {
  label: string;
  model: string;
  trainingRows: number;
  evaluation: {
    testDays: number;
    /** Average error per shift on the held-back test weeks, for the model and for the baseline. */
    maeModel: number;
    maeBaseline: number;
    improvementPercent: number;
  };
  history: { date: string; value: number }[];
  forecast: ForecastDay[];
}

export type ForecastMetric = 'handovers' | 'carriedOver';

export const demoForecast = demoData.forecast as unknown as Record<ForecastMetric, ForecastSeries>;

export const forecastMeta = demoData.meta as {
  source: string;
  historyFrom: string;
  historyTo: string;
  historyRows: number;
  horizonDays: number;
};
