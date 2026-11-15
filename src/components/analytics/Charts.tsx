import React from 'react';

/**
 * Small dependency-free charts. Each shows one series in one colour, with the values
 * written out, so nothing depends on telling colours apart.
 */

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  /** Extra text for the hover tooltip and for screen readers. */
  detail?: string;
}

const formatNumber = (value: number) => value.toLocaleString();

export const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
    {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

export const EmptyChart: React.FC<{ message: string }> = ({ message }) => (
  <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
    {message}
  </p>
);

/** Horizontal bars for comparing a handful of named groups. Every bar carries its value. */
export const BarList: React.FC<{ data: ChartDatum[]; unit?: string; showShare?: boolean; emptyMessage: string }> = ({
  data,
  unit = '',
  showShare = true,
  emptyMessage,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(...data.map((item) => item.value), 0);
  if (max === 0) return <EmptyChart message={emptyMessage} />;

  return (
    <ul className="space-y-3.5">
      {data.map((item) => (
        <li key={item.key} title={item.detail}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">{formatNumber(item.value)}{unit}</span>
              {showShare && total > 0 && <span className="ml-2 text-slate-500">{Math.round((item.value / total) * 100)}%</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-teal-600 transition-[width] duration-500 dark:bg-teal-400"
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 1.5 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

/** Vertical bars over time. The exact value shows on hover or focus; the peak is always labelled. */
export const ColumnChart: React.FC<{ data: ChartDatum[]; emptyMessage: string; valueNoun: string }> = ({
  data,
  emptyMessage,
  valueNoun,
}) => {
  const max = Math.max(...data.map((item) => item.value), 0);
  if (max === 0) return <EmptyChart message={emptyMessage} />;
  const peakKey = data.reduce((best, item) => (item.value > best.value ? item : best), data[0]).key;

  return (
    <div>
      <ol
        className="flex h-52 items-end gap-1 border-b border-slate-200 dark:border-slate-700 sm:gap-2"
        aria-label={`${valueNoun} over time`}
      >
        {data.map((item) => (
          <li
            key={item.key}
            tabIndex={0}
            aria-label={`${item.detail ?? item.label}: ${formatNumber(item.value)} ${valueNoun}`}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-t-md outline-offset-2"
          >
            <span
              className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                item.key === peakKey
                  ? 'text-slate-700 group-hover:bg-slate-900 group-hover:text-white group-focus:bg-slate-900 group-focus:text-white dark:text-slate-200'
                  : 'bg-slate-900 text-white opacity-0 group-hover:opacity-100 group-focus:opacity-100'
              }`}
              style={{ bottom: `calc(${(item.value / max) * 100}% + 4px)` }}
            >
              {formatNumber(item.value)}
            </span>
            <div
              className="w-full max-w-12 rounded-t-[4px] bg-teal-600 transition-[height] duration-500 group-hover:bg-teal-700 dark:bg-teal-400"
              style={{ height: `${Math.max((item.value / max) * 100, item.value > 0 ? 1 : 0)}%` }}
            />
          </li>
        ))}
      </ol>
      <ol aria-hidden="true" className="mt-2 flex gap-1 sm:gap-2">
        {data.map((item) => (
          <li key={item.key} className="min-w-0 flex-1 truncate text-center text-xs text-slate-500 dark:text-slate-400">
            {item.label}
          </li>
        ))}
      </ol>
    </div>
  );
};

/** One headline number with a short explanation underneath. */
export const StatTile: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
    <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    {note && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{note}</p>}
  </div>
);
