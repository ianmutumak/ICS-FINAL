import React from 'react';
import { useHandover } from '../../context/HandoverContext';
import { AlertTriangle, Check, ClipboardList, Play, Plus, ShieldCheck, Trash2 } from 'lucide-react';

interface ActiveHandoverViewProps {
  onOpenNewCase: () => void;
  onOpenSignoff: () => void;
  onOpenNewShift: () => void;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const SBAR_PARTS = [
  { letter: 'S', label: 'Situation', key: 'situation' },
  { letter: 'B', label: 'Background', key: 'background' },
  { letter: 'A', label: 'Assessment', key: 'assessment' },
  { letter: 'R', label: 'Recommendation', key: 'recommendation' },
] as const;

const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-800';

export const ActiveHandoverView: React.FC<ActiveHandoverViewProps> = ({
  onOpenNewCase,
  onOpenSignoff,
  onOpenNewShift,
}) => {
  const { activeHandover, currentUser, hasAdminClearance, deleteCase } = useHandover();
  const cases = activeHandover.cases;
  const { signoff } = activeHandover;
  const firstName = currentUser.name.split(' ')[0];

  // A handover needs a shift (code, work area, date) before updates can be recorded against it.
  if (!activeHandover.handoverCode) {
    return (
      <div className="mx-auto max-w-2xl py-6 sm:py-12">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            <ClipboardList className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-3xl font-bold text-slate-900 dark:text-white">{greeting()}, {firstName}</h1>
          <p className="mx-auto mt-2 max-w-md text-base text-slate-600 dark:text-slate-300">
            No shift is open yet. Start one, then record updates for the next team as things happen.
          </p>
          <button onClick={onOpenNewShift} className={`${primaryButton} mt-6`}>
            <Play className="h-5 w-5" /> Start a shift
          </button>
        </section>
      </div>
    );
  }

  // The four stages every handover moves through, and the one that needs attention now.
  const steps = [
    { label: 'Record updates', done: cases.length > 0 },
    { label: 'Outgoing signs', done: signoff.outgoingConfirmed },
    { label: 'Incoming signs', done: signoff.incomingConfirmed },
    { label: 'Admin approves', done: false },
  ];
  const currentStep = steps.findIndex((step) => !step.done);

  let nextTitle: string;
  let nextText: string;
  let nextAction: React.ReactNode = null;
  if (cases.length === 0) {
    nextTitle = 'Record your first update';
    nextText = 'Add anything the next team must know. You can keep adding through the shift.';
    nextAction = <button onClick={onOpenNewCase} className={primaryButton}><Plus className="h-5 w-5" /> Add an update</button>;
  } else if (!signoff.outgoingConfirmed) {
    nextTitle = 'Ready to hand over?';
    nextText = 'Keep adding updates through the shift. When it ends, review them and sign.';
    nextAction = <button onClick={onOpenSignoff} className={primaryButton}><ShieldCheck className="h-5 w-5" /> Review and sign</button>;
  } else if (!signoff.incomingConfirmed) {
    nextTitle = `${signoff.outgoingSignatureText || 'The outgoing staff member'} has signed`;
    nextText = 'The staff member taking over now reviews the updates and signs with their own account.';
    nextAction = <button onClick={onOpenSignoff} className={primaryButton}><ShieldCheck className="h-5 w-5" /> Review and sign</button>;
  } else {
    nextTitle = 'Both staff members have signed';
    nextText = hasAdminClearance
      ? 'Review the handover and approve it to close this shift and open the next one.'
      : 'This handover is waiting for an administrator to approve it.';
    nextAction = hasAdminClearance
      ? <button onClick={onOpenSignoff} className={primaryButton}><ShieldCheck className="h-5 w-5" /> Review and approve</button>
      : null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Shift identity */}
      <header>
        <p className="text-sm text-slate-500 dark:text-slate-400">{greeting()}, {firstName}</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
          <span className="capitalize">{activeHandover.shiftType}</span> shift handover
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="rounded-md bg-slate-200/70 px-2 py-0.5 font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200">{activeHandover.handoverCode}</span>
          <span>{activeHandover.wardOrDepartment}</span>
          <span aria-hidden="true">·</span>
          <span>{activeHandover.shiftWindow}</span>
          <span aria-hidden="true">·</span>
          <span>{activeHandover.shiftDate}</span>
        </p>
      </header>

      {/* Progress and the next thing to do */}
      <section aria-label="Handover progress" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <ol className="grid grid-cols-4 gap-2">
          {steps.map((step, index) => {
            const isCurrent = index === currentStep;
            return (
              <li key={step.label} aria-current={isCurrent ? 'step' : undefined} className="min-w-0">
                <div className={`h-1.5 rounded-full ${step.done ? 'bg-teal-600' : isCurrent ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                <div className="mt-2.5 flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.done ? 'bg-teal-600 text-white' : isCurrent ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  }`}>
                    {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className={`hidden truncate text-sm sm:block ${isCurrent ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{nextTitle}</h2>
            <p className="mt-1 max-w-xl text-base text-slate-600 dark:text-slate-300">{nextText}</p>
          </div>
          {nextAction && <div className="shrink-0">{nextAction}</div>}
        </div>
      </section>

      {/* Updates */}
      <section aria-labelledby="updates-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="updates-title" className="text-xl font-bold text-slate-900 dark:text-white">
            Updates for the next shift <span className="text-base font-normal text-slate-500">({cases.length})</span>
          </h2>
          {cases.length > 0 && (
            <button onClick={onOpenNewCase} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <Plus className="h-4 w-4" /> Add an update
            </button>
          )}
        </div>

        {cases.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-base text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Updates you record will appear here, each set out as Situation, Background, Assessment and Recommendation.
          </p>
        ) : (
          cases.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.subjectRef}</h3>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {item.lastUpdated}{item.updatedBy ? ` · ${item.updatedBy}` : ''}
                  </p>
                </div>
                <button onClick={() => deleteCase(item.id)} aria-label={`Remove update ${item.subjectRef}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {item.isolationOrHazardAlert && (
                <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-base font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <span><span className="font-bold">Safety warning: </span>{item.isolationOrHazardAlert}</span>
                </p>
              )}

              <dl className="mt-4 space-y-3">
                {SBAR_PARTS.map(({ letter, label, key }) => (
                  <div key={key} className="flex gap-3.5">
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 font-[family-name:var(--font-display)] text-base font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      {letter}
                    </span>
                    <div className="min-w-0">
                      <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
                      <dd className="whitespace-pre-wrap text-base leading-relaxed text-slate-900 dark:text-slate-100">{item[key] || 'Not provided'}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </article>
          ))
        )}
      </section>
    </div>
  );
};
