import React, { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';
import { createStatisticsSnapshot, demoStatistics } from '../../lib/statisticsSnapshot';
import { ForecastPanel } from './ForecastPanel';
import { BarList, ChartCard, ChartDatum, ColumnChart, StatTile } from './Charts';

const DEMO_DATA_KEY = 'zamu_statistics_demo_data_v7';

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In progress',
  pending_signoff: 'Awaiting approval',
  completed: 'Completed',
  scheduled: 'Scheduled',
  archived: 'Archived',
};
const TASK_LABELS: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  pending: 'Pending',
  carried_over: 'Carried over',
};
const SHIFT_LABELS: Record<string, string> = { morning: 'Morning', evening: 'Evening', night: 'Night' };

/** Turns a count map into chart rows in a fixed, meaningful order. */
function toRows(counts: Record<string, number>, labels: Record<string, string>): ChartDatum[] {
  const known = Object.keys(labels).filter((key) => key in counts);
  const other = Object.keys(counts).filter((key) => !(key in labels));
  return [...known, ...other].map((key) => ({ key, label: labels[key] ?? key.replace(/_/g, ' '), value: counts[key] }));
}

const percent = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—');

type SectionId = 'forecast' | 'trend' | 'shifts' | 'status' | 'tasks';
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'trend', label: 'Monthly trend' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'status', label: 'Status' },
  { id: 'tasks', label: 'Tasks' },
];

export const StatisticsAnalyticsView: React.FC = () => {
  const { archive, activeHandover, attendanceLogs, complianceRecords, tasks } = useHandover();

  const [view, setView] = useState<'overview' | 'records'>('overview');
  const [hidden, setHidden] = useState<Set<SectionId>>(new Set());
  const [useDemoData, setUseDemoData] = useState(() => {
    try {
      return localStorage.getItem(DEMO_DATA_KEY) === 'on';
    } catch {
      return false;
    }
  });

  const chooseDataSource = (demo: boolean) => {
    setUseDemoData(demo);
    try {
      localStorage.setItem(DEMO_DATA_KEY, demo ? 'on' : 'off');
    } catch {
      // The choice simply will not be remembered.
    }
  };

  const toggleSection = (id: SectionId) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const appStatistics = useMemo(
    () => createStatisticsSnapshot({ activeHandover, archive, tasks, attendanceLogs, complianceRecords }),
    [activeHandover, archive, tasks, attendanceLogs, complianceRecords]
  );
  // Every number, chart and assistant answer on this page comes from this one object.
  const stats = useDemoData ? demoStatistics : appStatistics;

  const monthly: ChartDatum[] = Object.keys(stats.handoversByMonth).sort().map((month) => {
    const date = new Date(`${month}-01T00:00:00`);
    return {
      key: month,
      label: date.toLocaleDateString([], { month: 'short' }),
      detail: date.toLocaleDateString([], { month: 'long', year: 'numeric' }),
      value: stats.handoversByMonth[month],
    };
  });
  const awaitingApproval = stats.handoversByStatus.pending_signoff ?? 0;
  const taskTotal = Object.values(stats.tasksByStatus).reduce((sum, count) => sum + count, 0);
  const { transition } = stats;

  const show = (id: SectionId) => !hidden.has(id);
  const segment = (active: boolean) =>
    `rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
      active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
    }`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Statistics</h1>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-300">
            {stats.handoverCount.toLocaleString()} handovers
            {stats.dateRange.from ? ` · ${stats.dateRange.from} to ${stats.dateRange.to}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Data source" className="flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            <button type="button" aria-pressed={!useDemoData} onClick={() => chooseDataSource(false)} className={segment(!useDemoData)}>
              Live data
            </button>
            <button type="button" aria-pressed={useDemoData} onClick={() => chooseDataSource(true)} className={`${segment(useDemoData)} inline-flex items-center gap-1.5`}>
              <FlaskConical className="h-4 w-4" /> Demo data
            </button>
          </div>
          <div role="tablist" aria-label="View" className="flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            <button type="button" role="tab" aria-selected={view === 'overview'} onClick={() => setView('overview')} className={segment(view === 'overview')}>
              Overview
            </button>
            <button type="button" role="tab" aria-selected={view === 'records'} onClick={() => setView('records')} className={segment(view === 'records')}>
              Sign-off records
            </button>
          </div>
        </div>
      </header>

      {useDemoData && (
        <p role="status" className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <span className="font-bold">Demo data is on. </span>
            These figures are {stats.handoverCount.toLocaleString()} generated handovers covering the past year, for testing and presentations.
            They are not real records and nothing is saved to the database.
          </span>
        </p>
      )}

      {view === 'overview' ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Handovers"
              value={stats.handoverCount.toLocaleString()}
              note={`${(stats.handoversByStatus.completed ?? 0).toLocaleString()} completed`}
            />
            <StatTile
              label="Awaiting approval"
              value={awaitingApproval.toLocaleString()}
              note={awaitingApproval === 0 ? 'Nothing is waiting' : 'Signed by both, not yet approved'}
            />
            <StatTile
              label="Average handover time"
              value={transition.averageMinutes !== null ? `${transition.averageMinutes} min` : '—'}
              note={transition.measured > 0
                ? `${percent(transition.withinTarget, transition.measured)} within the ${transition.targetMinutes}-minute target`
                : 'Measured between the two signatures'}
            />
            <StatTile
              label="Complete SBAR updates"
              value={percent(stats.sbar.complete, stats.sbar.total)}
              note={stats.sbar.total > 0
                ? `${stats.sbar.complete.toLocaleString()} of ${stats.sbar.total.toLocaleString()} updates`
                : 'No updates recorded yet'}
            />
          </div>

          <div role="group" aria-label="Sections shown" className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Show:</span>
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                aria-pressed={show(section.id)}
                onClick={() => toggleSection(section.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  show(section.id)
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {show('forecast') && (
              <div className="lg:col-span-2">
                <ForecastPanel showingDemoData={useDemoData} />
              </div>
            )}
            {show('trend') && (
              <div className="lg:col-span-2">
                <ChartCard title="Handovers per month" subtitle="Hover or tab to a bar for the exact count">
                  <ColumnChart data={monthly} valueNoun="handovers" emptyMessage="No handovers have been recorded yet." />
                </ChartCard>
              </div>
            )}
            {show('shifts') && (
              <ChartCard title="Handovers by shift" subtitle="How the workload is spread across the day">
                <BarList data={toRows(stats.handoversByShift, SHIFT_LABELS)} emptyMessage="No handovers have been recorded yet." />
                {Object.keys(transition.averageByShift).length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                    <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Average handover time</p>
                    <BarList data={toRows(transition.averageByShift, SHIFT_LABELS)} unit=" min" showShare={false} emptyMessage="" />
                  </div>
                )}
              </ChartCard>
            )}
            {show('status') && (
              <ChartCard title="Where handovers stand" subtitle="Each handover is in exactly one of these stages">
                <BarList data={toRows(stats.handoversByStatus, STATUS_LABELS)} emptyMessage="No handovers have been recorded yet." />
              </ChartCard>
            )}
            {show('tasks') && (
              <ChartCard
                title="Tasks"
                subtitle={taskTotal > 0
                  ? `${percent(stats.tasksByStatus.carried_over ?? 0, taskTotal)} of ${taskTotal.toLocaleString()} tasks were carried over to the next shift`
                  : 'Follow-up work recorded against shifts'}
              >
                <BarList data={toRows(stats.tasksByStatus, TASK_LABELS)} emptyMessage="No tasks have been recorded yet." />
              </ChartCard>
            )}
          </div>
        </>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sign-off records</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Handovers signed by both the outgoing and the incoming staff member.</p>
          </div>
          {useDemoData ? (
            <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Demo data only generates totals, so there are no individual records to list. Switch to live data to see them.
            </p>
          ) : complianceRecords.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No handover has been signed by both staff members yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                    <th scope="col" className="px-5 py-3 font-semibold">Handover</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Work area</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Outgoing</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Incoming</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Time taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {complianceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-5 py-3">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">{record.handoverCode}</span>
                        <span className="block text-xs text-slate-500">{record.date} · <span className="capitalize">{record.shiftType}</span></span>
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{record.departmentName}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{record.outgoingSigner}<span className="block text-xs text-slate-500">{record.outgoingSignedAt}</span></td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{record.incomingSigner}<span className="block text-xs text-slate-500">{record.incomingSignedAt}</span></td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-900 dark:text-white">{record.timeDeltaMinutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
