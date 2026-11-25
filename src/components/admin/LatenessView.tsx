import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';
import { LATE_GRACE_MINUTES, formatTime, localDateString, startStatus, type StartStatus } from '../../lib/shiftRules';

const chip = 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold';

function StatusChip({ status }: { status: StartStatus }) {
  switch (status.kind) {
    case 'on_time':
      return <span className={`${chip} bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200`}>On time</span>;
    case 'late':
      return <span className={`${chip} bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200`}>Late by {status.minutes} min</span>;
    case 'not_started':
      return <span className={`${chip} bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200`}>Not started, {status.minutes} min past</span>;
    case 'waiting':
      return <span className={`${chip} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`}>Waiting to start</span>;
    default:
      return <span className={`${chip} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400`}>No schedule</span>;
  }
}

/** When each shift was meant to start, when it did, and which ones were late. This is about timing, not workload. */
export const LatenessView: React.FC = () => {
  const { activeHandover, archive } = useHandover();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(
    () =>
      [activeHandover, ...archive]
        .filter((shift) => shift.handoverCode && shift.scheduledStart && shift.status !== 'archived')
        .map((shift) => ({ shift, status: startStatus(shift, now) }))
        .sort((a, b) => (b.shift.scheduledStart as string).localeCompare(a.shift.scheduledStart as string)),
    [activeHandover, archive, now],
  );

  const late = rows.filter((row) => row.status.kind === 'late' || row.status.kind === 'not_started');
  const started = rows.filter((row) => row.status.kind === 'on_time' || row.status.kind === 'late');
  const onTime = started.filter((row) => row.status.kind === 'on_time').length;
  const lateStarted = started.filter((row) => row.status.kind === 'late');
  const averageLate = lateStarted.length ? Math.round(lateStarted.reduce((sum, row) => sum + row.status.minutes, 0) / lateStarted.length) : 0;

  return (
    <section aria-label="Shift start times" className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white"><Clock className="h-5 w-5 text-teal-700" /> Shift start times</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Each shift records when it was started and how far that was from its scheduled time. A start up to {LATE_GRACE_MINUTES} minutes late counts as on time.
          This is separate from the workload forecast.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <dt className="text-sm text-slate-600 dark:text-slate-300">Late or not started</dt>
          <dd className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{late.length}</dd>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <dt className="text-sm text-slate-600 dark:text-slate-300">Started on time</dt>
          <dd className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{started.length ? `${Math.round((100 * onTime) / started.length)}%` : '-'}</dd>
          <p className="text-sm text-slate-500 dark:text-slate-400">{onTime} of {started.length} started shifts</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <dt className="text-sm text-slate-600 dark:text-slate-300">Average lateness</dt>
          <dd className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{lateStarted.length ? `${averageLate} min` : '-'}</dd>
          <p className="text-sm text-slate-500 dark:text-slate-400">across the late starts</p>
        </div>
      </dl>

      {rows.length === 0 ? (
        <p className="border-t border-slate-200 px-5 py-8 text-center text-base text-slate-600 dark:border-slate-800 dark:text-slate-300">
          No shift has a recorded schedule yet. Start times appear here as shifts are started.
        </p>
      ) : (
        <div className="relative overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Shift</th>
                <th scope="col" className="px-3 py-3 font-semibold">Due</th>
                <th scope="col" className="px-3 py-3 font-semibold">Started</th>
                <th scope="col" className="px-3 py-3 font-semibold">By</th>
                <th scope="col" className="px-5 py-3 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(({ shift, status }) => (
                <tr key={shift.id}>
                  <td className="px-5 py-3">
                    <span className="font-mono text-slate-900 dark:text-slate-100">{shift.handoverCode}</span>
                    <span className="block text-slate-500 dark:text-slate-400"><span className="capitalize">{shift.shiftType}</span>, {shift.wardOrDepartment}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-800 dark:text-slate-200">{localDateString(new Date(shift.scheduledStart as string))} {formatTime(shift.scheduledStart as string)}</td>
                  <td className="px-3 py-3 text-slate-800 dark:text-slate-200">{shift.startedAt ? formatTime(shift.startedAt) : 'Not yet'}</td>
                  <td className="px-3 py-3 text-slate-800 dark:text-slate-200">{shift.startedByName || '-'}</td>
                  <td className="px-5 py-3"><StatusChip status={status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
