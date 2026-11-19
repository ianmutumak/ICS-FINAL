import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { TimingRun, comparePaired, summarizeMethod } from '../../lib/timingStudy';

const TASKS = ['Full shift handover', 'Record one update', 'Hand over a safety warning'];
const METHOD_LABELS = { paper: 'Paper logbook', app: 'Zamu-Check' } as const;

const minutes = (value: number | null, digits = 1) => (value === null ? '—' : value.toFixed(digits));
const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

/** Records timed handovers on paper and in the app, and compares them: the baseline measurement for the study. */
export const TimingStudyView: React.FC = () => {
  const [runs, setRuns] = useState<TimingRun[]>([]);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<'paper' | 'app'>('paper');
  const [task, setTask] = useState(TASKS[0]);
  const [participant, setParticipant] = useState('');
  const [seconds, setSeconds] = useState('');
  const [note, setNote] = useState('');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setRuns(await api<TimingRun[]>('GET', '/timing-runs'));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const startStopwatch = () => {
    startedAt.current = Date.now();
    setElapsed(0);
    timer.current = setInterval(() => setElapsed(Math.round((Date.now() - (startedAt.current as number)) / 1000)), 250);
  };
  const stopStopwatch = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const total = Math.max(1, Math.round((Date.now() - (startedAt.current as number)) / 1000));
    setSeconds(String(total));
    setElapsed(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const saved = await api<TimingRun>('POST', '/timing-runs', { method, task, participant, seconds: Number(seconds), note });
      setRuns((previous) => [saved, ...previous]);
      setSeconds('');
      setNote('');
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  };

  const remove = async (id: string) => {
    try {
      await api('DELETE', `/timing-runs/${id}`);
      setRuns((previous) => previous.filter((entry) => entry.id !== id));
    } catch (removeError) {
      setError(errorMessage(removeError));
    }
  };

  const paper = summarizeMethod(runs.filter((entry) => entry.method === 'paper'));
  const app = summarizeMethod(runs.filter((entry) => entry.method === 'app'));
  const paired = comparePaired(runs);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Timing study</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Time the same handover task on the paper logbook and in Zamu-Check, with the same people. Use a label such as P1 for each participant, never a name.
        </p>

        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Method
            <select value={method} onChange={(event) => setMethod(event.target.value as 'paper' | 'app')} className={`${field} mt-1`}>
              <option value="paper">{METHOD_LABELS.paper}</option>
              <option value="app">{METHOD_LABELS.app}</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Task
            <select value={task} onChange={(event) => setTask(event.target.value)} className={`${field} mt-1`}>
              {TASKS.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Participant
            <input required maxLength={20} value={participant} onChange={(event) => setParticipant(event.target.value)} placeholder="P1" className={`${field} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Time in seconds
            <span className="mt-1 flex gap-2">
              <input required type="number" min={1} max={7200} value={seconds} onChange={(event) => setSeconds(event.target.value)} className={field} />
              {elapsed === null ? (
                <button type="button" onClick={startStopwatch} aria-label="Start the stopwatch" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Play className="h-4 w-4" /> Start</button>
              ) : (
                <button type="button" onClick={stopStopwatch} aria-label="Stop the stopwatch" className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white"><Square className="h-4 w-4" /> {elapsed}s</button>
              )}
            </span>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2 lg:col-span-3">Note (optional)
            <input maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} className={`${field} mt-1`} />
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Save run</button>
          </div>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      </section>

      <section aria-label="Results" className="grid gap-4 lg:grid-cols-3">
        {([['paper', paper], ['app', app]] as const).map(([key, summary]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{METHOD_LABELS[key]}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{minutes(summary.meanMinutes)} min</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {summary.runs} run{summary.runs === 1 ? '' : 's'}; median {minutes(summary.medianMinutes)}; spread (SD) {minutes(summary.sdMinutes)}
            </p>
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Time saved with Zamu-Check</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {paired.meanDifferenceMinutes === null ? '—' : `${minutes(paired.meanDifferenceMinutes)} min`}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {paired.pairs === 0
              ? 'Needs the same participant and task timed with both methods.'
              : `${paired.pairs} matched pair${paired.pairs === 1 ? '' : 's'}${paired.percentFaster !== null ? `; ${paired.percentFaster.toFixed(0)}% of the paper time` : ''}`}
          </p>
          {paired.ci95Minutes && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              95% interval {minutes(paired.ci95Minutes[0])} to {minutes(paired.ci95Minutes[1])} min. {paired.clearlyFaster ? 'The saving is unlikely to be chance.' : 'The interval includes zero, so more runs are needed.'}
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {runs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No runs recorded yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                  <th scope="col" className="px-5 py-3 font-semibold">Method</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Task</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Participant</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Time</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Note</th>
                  <th scope="col" className="px-5 py-3"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {runs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-3 text-slate-900 dark:text-white">{METHOD_LABELS[entry.method]}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{entry.task}</td>
                    <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-300">{entry.participant}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-900 dark:text-white">{Math.floor(entry.seconds / 60)}:{String(entry.seconds % 60).padStart(2, '0')}</td>
                    <td className="px-5 py-3 text-slate-500">{entry.note}</td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" onClick={() => remove(entry.id)} aria-label={`Remove run by ${entry.participant}`} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
