import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';
import { AUDIT_EVENT_LABELS, AuditEventType, buildAuditEvents } from '../../lib/auditTrail';
import { sealHandover } from '../../lib/shiftRules';

type SealState = 'verified' | 'mismatch' | 'none';

/** Read-only record of who did what, with a check that each signed handover still matches its seal. */
export const AuditTrailView: React.FC = () => {
  const { activeHandover, archive, overrideLogs, forecastDecisions } = useHandover();
  const [filter, setFilter] = useState<AuditEventType | 'all'>('all');
  const [seals, setSeals] = useState<Record<string, SealState>>({});

  const shifts = useMemo(() => [activeHandover, ...archive].filter((s) => Boolean(s.handoverCode)), [activeHandover, archive]);
  const events = useMemo(
    () => buildAuditEvents({ shifts, overrides: overrideLogs, decisions: forecastDecisions }),
    [shifts, overrideLogs, forecastDecisions]
  );
  const visible = filter === 'all' ? events : events.filter((event) => event.type === filter);

  // Recompute each signed handover's seal and compare it with the one stored when it was signed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result: Record<string, SealState> = {};
      for (const shift of shifts.filter((s) => s.signoff.incomingConfirmed)) {
        const stored = shift.signoff.verificationHash;
        if (!stored) {
          result[shift.id] = 'none';
          continue;
        }
        result[shift.id] = (await sealHandover(shift)) === stored ? 'verified' : 'mismatch';
      }
      if (!cancelled) setSeals(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [shifts]);

  const mismatches = Object.values(seals).filter((state) => state === 'mismatch').length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Audit trail</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{events.length} recorded actions, newest first. This list cannot be edited.</p>
        </div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          <span className="sr-only">Filter by action</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as AuditEventType | 'all')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="all">All actions</option>
            {Object.entries(AUDIT_EVENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {mismatches > 0 && (
        <p role="alert" className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {mismatches} signed handover{mismatches === 1 ? ' does' : 's do'} not match {mismatches === 1 ? 'its' : 'their'} seal, which means the record changed after signing.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nothing has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                <th scope="col" className="px-5 py-3 font-semibold">When</th>
                <th scope="col" className="px-5 py-3 font-semibold">Action</th>
                <th scope="col" className="px-5 py-3 font-semibold">By</th>
                <th scope="col" className="px-5 py-3 font-semibold">Details</th>
                <th scope="col" className="px-5 py-3 font-semibold">Handover</th>
                <th scope="col" className="px-5 py-3 font-semibold">Seal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((event) => {
                const state = event.type === 'incoming_signed' && event.shiftId ? seals[event.shiftId] : undefined;
                return (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                      {new Date(event.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900 dark:text-white">{AUDIT_EVENT_LABELS[event.type]}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{event.who}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{event.detail}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{event.code ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {state === 'verified' && <span className="inline-flex items-center gap-1 text-teal-800 dark:text-teal-300"><ShieldCheck className="h-4 w-4" /> Matches</span>}
                      {state === 'mismatch' && <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><ShieldAlert className="h-4 w-4" /> Does not match</span>}
                      {state === 'none' && <span className="text-slate-500">No seal</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
