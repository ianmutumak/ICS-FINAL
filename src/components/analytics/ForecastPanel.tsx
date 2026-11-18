import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { ForecastMetric, demoForecast, forecastMeta } from '../../lib/forecast';

const SHIFTS = ['morning', 'evening', 'night'] as const;

const parseDay = (iso: string) => new Date(`${iso}T00:00:00`);
const shortDate = (iso: string) => parseDay(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
const fullDate = (iso: string) => parseDay(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const oneDecimal = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

// Chart geometry, in SVG units.
const WIDTH = 720;
const HEIGHT = 250;
const PAD = { left: 38, right: 14, top: 18, bottom: 30 };

function niceCeiling(value: number): number {
  const step = value <= 10 ? 2 : value <= 40 ? 10 : 20;
  return Math.max(step, Math.ceil(value / step) * step);
}

interface ForecastPanelProps {
  /** The forecast is trained on the demo dataset, so it is only shown with demo data. */
  showingDemoData: boolean;
}

export const ForecastPanel: React.FC<ForecastPanelProps> = ({ showingDemoData }) => {
  const [metric, setMetric] = useState<ForecastMetric>('handovers');
  const [active, setActive] = useState<number | null>(null);

  if (!showingDemoData) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <TrendingUp className="h-5 w-5 text-teal-700 dark:text-teal-400" /> Workload forecast
        </h3>
        <p className="mt-2 max-w-2xl text-base text-slate-600 dark:text-slate-300">
          There is not enough handover history yet to forecast the coming days.
        </p>
      </section>
    );
  }

  const series = demoForecast[metric];
  const noun = metric === 'handovers' ? 'handovers' : 'tasks carried over';
  const points = [
    ...series.history.map((point) => ({ ...point, low: point.value, high: point.value, isForecast: false })),
    ...series.forecast.map((point) => ({ date: point.date, value: point.value, low: point.low, high: point.high, isForecast: true })),
  ];
  const firstForecast = series.history.length;
  const top = niceCeiling(Math.max(...points.map((point) => point.high)));
  const x = (index: number) => PAD.left + (index / (points.length - 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom);
  const line = (from: number, to: number) =>
    points.slice(from, to).map((point, offset) => `${offset === 0 ? 'M' : 'L'}${x(from + offset).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const band = [
    ...points.slice(firstForecast).map((point, offset) => `${x(firstForecast + offset).toFixed(1)},${y(point.high).toFixed(1)}`),
    ...points.slice(firstForecast).map((point, offset) => `${x(firstForecast + offset).toFixed(1)},${y(point.low).toFixed(1)}`).reverse(),
  ].join(' ');
  const step = (WIDTH - PAD.left - PAD.right) / (points.length - 1);
  const activePoint = active !== null ? points[active] : null;

  // The busiest individual shifts in the coming fortnight.
  const busiest = series.forecast
    .flatMap((day) => SHIFTS.map((shift) => ({ date: day.date, shift, value: day[shift] })))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const segment = (isActive: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
    }`;

  return (
    <section aria-labelledby="forecast-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="forecast-title" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <TrendingUp className="h-5 w-5 text-teal-700 dark:text-teal-400" /> Workload forecast
          </h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Expected {noun} per day for the next {forecastMeta.horizonDays} days, after the last {series.history.length} days recorded
          </p>
        </div>
        <div role="group" aria-label="What to forecast" className="flex shrink-0 gap-1 self-start rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
          <button type="button" aria-pressed={metric === 'handovers'} onClick={() => { setMetric('handovers'); setActive(null); }} className={segment(metric === 'handovers')}>
            Handovers
          </button>
          <button type="button" aria-pressed={metric === 'carriedOver'} onClick={() => { setMetric('carriedOver'); setActive(null); }} className={segment(metric === 'carriedOver')}>
            Tasks carried over
          </button>
        </div>
      </div>

      <div className="relative mt-4" onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Line chart of ${noun} per day: recorded values followed by the forecast. The same figures are in the table below.`} className="w-full">
          {[0, top / 2, top].map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">{tick}</text>
            </g>
          ))}
          {points.map((point, index) => (index % 7 === 0 ? (
            <text key={point.date} x={x(index)} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">{shortDate(point.date)}</text>
          ) : null))}

          {/* Where the records end and the forecast begins */}
          <line x1={x(firstForecast - 1)} x2={x(firstForecast - 1)} y1={PAD.top - 6} y2={HEIGHT - PAD.bottom} className="stroke-slate-400" strokeWidth="1" strokeDasharray="2 3" />
          <text x={x(firstForecast - 1) + 6} y={PAD.top - 6} className="fill-slate-600 text-[11px] font-semibold dark:fill-slate-300">Forecast</text>
          <text x={x(firstForecast - 1) - 6} y={PAD.top - 6} textAnchor="end" className="fill-slate-600 text-[11px] font-semibold dark:fill-slate-300">Recorded</text>

          <polygon points={band} className="fill-teal-600/15 dark:fill-teal-400/20" />
          <path d={line(0, firstForecast)} fill="none" className="stroke-teal-700 dark:stroke-teal-400" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={line(firstForecast - 1, points.length)} fill="none" className="stroke-teal-700 dark:stroke-teal-400" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />

          {activePoint && active !== null && (
            <>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-slate-400" strokeWidth="1" />
              <circle cx={x(active)} cy={y(activePoint.value)} r="4.5" className="fill-teal-700 stroke-white dark:fill-teal-400 dark:stroke-slate-900" strokeWidth="2" />
            </>
          )}
          {points.map((point, index) => (
            <rect key={point.date} x={x(index) - step / 2} y={0} width={step} height={HEIGHT} fill="transparent" onMouseEnter={() => setActive(index)} />
          ))}
        </svg>

        {activePoint && active !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: `${Math.min(Math.max((x(active) / WIDTH) * 100, 12), 88)}%` }}
          >
            <span className="font-semibold">{fullDate(activePoint.date)}</span>
            <span className="ml-2 tabular-nums">
              {oneDecimal(activePoint.value)} {activePoint.isForecast ? `expected (${oneDecimal(activePoint.low)} to ${oneDecimal(activePoint.high)})` : 'recorded'}
            </span>
          </div>
        )}
      </div>

      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <li className="flex items-center gap-2"><span className="h-0.5 w-6 bg-teal-700 dark:bg-teal-400" /> Recorded</li>
        <li className="flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-teal-700 dark:border-teal-400" /> Forecast</li>
        <li className="flex items-center gap-2"><span className="h-3 w-6 rounded-sm bg-teal-600/15 dark:bg-teal-400/20" /> Likely range</li>
      </ul>

      <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Busiest shifts ahead</h4>
          <ol className="mt-2 space-y-1.5">
            {busiest.map((item) => (
              <li key={`${item.date}-${item.shift}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-800 dark:text-slate-200">{fullDate(item.date)}, <span className="capitalize">{item.shift}</span></span>
                <span className="tabular-nums font-semibold text-slate-900 dark:text-white">about {oneDecimal(item.value)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <details className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <summary className="cursor-pointer text-sm font-semibold text-teal-800 dark:text-teal-300">Show the forecast as a table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <th scope="col" className="py-2 pr-4 font-semibold">Day</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Morning</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Evening</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Night</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Day total</th>
                <th scope="col" className="py-2 text-right font-semibold">Likely range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {series.forecast.map((day) => (
                <tr key={day.date}>
                  <th scope="row" className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{fullDate(day.date)}</th>
                  {SHIFTS.map((shift) => (
                    <td key={shift} className="py-2 pr-4 text-right text-slate-700 dark:text-slate-300">{oneDecimal(day[shift])}</td>
                  ))}
                  <td className="py-2 pr-4 text-right font-semibold text-slate-900 dark:text-white">{oneDecimal(day.value)}</td>
                  <td className="py-2 text-right text-slate-600 dark:text-slate-400">{oneDecimal(day.low)} to {oneDecimal(day.high)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
};
