import React from 'react';
import { useHandover } from '../../context/HandoverContext';
import { AlertTriangle, FileText, Play, Plus, ShieldCheck, Trash2 } from 'lucide-react';

interface ActiveHandoverViewProps {
  onOpenNewCase: () => void;
  onOpenSignoff: () => void;
  onOpenNewShift: () => void;
}

export const ActiveHandoverView: React.FC<ActiveHandoverViewProps> = ({
  onOpenNewCase,
  onOpenSignoff,
  onOpenNewShift,
}) => {
  const { activeHandover, deleteCase } = useHandover();
  const cases = activeHandover.cases;
  const { signoff } = activeHandover;
  const awaitingIncoming = signoff.outgoingConfirmed && !signoff.incomingConfirmed;
  const awaitingApproval = signoff.outgoingConfirmed && signoff.incomingConfirmed;

  // A handover needs a shift (code, work area, date) before updates can be recorded against it.
  if (!activeHandover.handoverCode) {
    return (
      <main className="max-w-4xl mx-auto">
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <FileText className="mx-auto h-8 w-8 text-slate-400" />
          <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">No shift is open</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Start a shift to record handover updates for the next team.
          </p>
          <button onClick={onOpenNewShift} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
            <Play className="h-4 w-4" /> Start a shift
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">{activeHandover.handoverCode}</span>
              {' · '}{activeHandover.wardOrDepartment}
              {' · '}<span className="capitalize">{activeHandover.shiftType}</span> shift
              {' · '}{activeHandover.shiftDate}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Your shift updates</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Add important updates for the next shift. Use Situation, Background, Assessment and Recommendation to keep each update clear.
            </p>
          </div>
          <button
            onClick={onOpenNewCase}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" /> Add an update
          </button>
        </div>

        {awaitingIncoming && (
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            {signoff.outgoingSignatureText || 'The outgoing staff member'} has signed. Waiting for the incoming staff member to sign.
          </div>
        )}
        {awaitingApproval && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Both staff members have signed. This handover is waiting for administrator approval.
          </div>
        )}
      </section>

      <section aria-labelledby="updates-title" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 id="updates-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Handover updates <span className="text-sm font-normal text-slate-500">({cases.length})</span>
          </h2>
          {cases.length > 0 && (
            <button onClick={onOpenSignoff} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4" /> Review and sign
            </button>
          )}
        </div>

        {cases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <FileText className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">No updates yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Add an update when there is something the next shift needs to know.
            </p>
            <button onClick={onOpenNewCase} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
              <Plus className="h-4 w-4" /> Add your first update
            </button>
          </div>
        ) : (
          cases.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{item.subjectRef}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.lastUpdated}{item.updatedBy ? ` · Added by ${item.updatedBy}` : ''}
                  </p>
                </div>
                <button onClick={() => deleteCase(item.id)} aria-label={`Remove update ${item.subjectRef}`} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {item.isolationOrHazardAlert && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {item.isolationOrHazardAlert}
                </p>
              )}
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {[
                  ['Situation', item.situation],
                  ['Background', item.background],
                  ['Assessment', item.assessment],
                  ['Recommendation', item.recommendation],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">{label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{value || 'Not provided'}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))
        )}
      </section>
    </main>
  );
};
