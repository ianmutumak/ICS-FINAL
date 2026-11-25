import React, { useState } from 'react';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';
import {
  OWN_WORDS, SCENARIOS, TEMPLATES, WARNING_TEMPLATES, composePart,
  type SbarPart, type SbarTemplate,
} from '../../data/sbarTemplates';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** What a person has chosen for one part: a template (or their own words) and anything they added. */
interface Choice {
  template: string;
  extra: string;
}
const EMPTY: Choice = { template: '', extra: '' };

const PARTS: { letter: string; part: SbarPart; label: string; hint: string }[] = [
  { letter: 'S', part: 'situation', label: 'Situation', hint: 'What is happening right now?' },
  { letter: 'B', part: 'background', label: 'Background', hint: 'What led to it? What does the next person need to know?' },
  { letter: 'A', part: 'assessment', label: 'Assessment', hint: 'What have you checked or found?' },
  { letter: 'R', part: 'recommendation', label: 'Recommendation', hint: 'What should the next shift do, and by when?' },
];

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const labelClass = 'block text-base font-semibold text-slate-900 dark:text-slate-100';
const hintClass = 'block text-sm font-normal text-slate-500 dark:text-slate-400';

/** A list of templates, the words that the chosen one saves, and a box for anything unusual. */
function TemplateField({
  id, templates, choice, onChange, extraLabel, extraPlaceholder, extraMax, error,
}: {
  id: string;
  templates: SbarTemplate[];
  choice: Choice;
  onChange: (next: Choice) => void;
  extraLabel: string;
  extraPlaceholder: string;
  extraMax: number;
  error?: string;
}) {
  const chosen = templates.find((entry) => entry.id === choice.template);
  const writing = choice.template === OWN_WORDS;
  return (
    <div>
      <select
        id={`${id}-template`}
        aria-label="Template"
        aria-invalid={Boolean(error)}
        value={choice.template}
        onChange={(event) => onChange({ ...choice, template: event.target.value })}
        className={inputClass}
      >
        <option value="">Choose a template…</option>
        {templates.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        <option value={OWN_WORDS}>Something else, I will write it</option>
      </select>
      {chosen && (
        <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{chosen.text}</p>
      )}
      {(chosen || writing) && (
        <label className="mt-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {writing ? 'Write it here' : extraLabel}
          <textarea
            rows={writing ? 2 : 1}
            maxLength={extraMax}
            value={choice.extra}
            placeholder={writing ? '' : extraPlaceholder}
            onChange={(event) => onChange({ ...choice, extra: event.target.value })}
            className={`${inputClass} mt-1 resize-y`}
          />
        </label>
      )}
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose }) => {
  const { addCase } = useHandover();
  const [subjectRef, setSubjectRef] = useState('');
  const [scenario, setScenario] = useState('');
  const [choices, setChoices] = useState<Record<SbarPart, Choice>>({
    situation: EMPTY, background: EMPTY, assessment: EMPTY, recommendation: EMPTY,
  });
  const [warning, setWarning] = useState<Choice>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<SbarPart, string>>>({});

  if (!isOpen) return null;

  const resetForm = () => {
    setSubjectRef('');
    setScenario('');
    setChoices({ situation: EMPTY, background: EMPTY, assessment: EMPTY, recommendation: EMPTY });
    setWarning(EMPTY);
    setErrors({});
  };

  const applyScenario = (id: string) => {
    setScenario(id);
    const found = SCENARIOS.find((entry) => entry.id === id);
    if (!found) return;
    // Picking a scenario fills the four lists, keeping anything the person has already added.
    setChoices((previous) => ({
      situation: { ...previous.situation, template: found.situation },
      background: { ...previous.background, template: found.background },
      assessment: { ...previous.assessment, template: found.assessment },
      recommendation: { ...previous.recommendation, template: found.recommendation },
    }));
    setWarning((previous) => ({ ...previous, template: found.warning ?? '' }));
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = Object.fromEntries(PARTS.map(({ part }) => [part, composePart(part, choices[part].template, choices[part].extra)])) as Record<SbarPart, string>;
    const missing = Object.fromEntries(
      PARTS.filter(({ part }) => !text[part]).map(({ part, label }) => [part, `Choose a template or write the ${label.toLowerCase()}.`]),
    ) as Partial<Record<SbarPart, string>>;
    setErrors(missing);
    if (Object.keys(missing).length > 0) return;

    const hazard = composePart('warning', warning.template, warning.extra);
    const saved = await addCase({
      subjectRef: subjectRef.trim(),
      situation: text.situation, background: text.background, assessment: text.assessment, recommendation: text.recommendation,
      isolationOrHazardAlert: hazard || undefined,
    });
    // The form stays open if the server refused the update, so nothing typed is lost.
    if (saved) {
      resetForm();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="new-update-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-update-title" className="text-2xl font-bold text-slate-900 dark:text-white">Add a handover update</h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-300">Pick a template for each part and add only what is unusual.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className={labelClass}>
            What is this update about?
            <span className={hintClass}>A work area, a piece of equipment, a shipment or an open issue.</span>
            <input required value={subjectRef} onChange={(e) => setSubjectRef(e.target.value)} className={inputClass} />
          </label>

          <label className={`${labelClass} rounded-2xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-950/30`}>
            <span className="flex items-center gap-2"><Zap className="h-5 w-5 text-teal-700 dark:text-teal-300" /> Quick start <span className="text-sm font-normal text-slate-600 dark:text-slate-300">(optional)</span></span>
            <span className={hintClass}>Fills all four parts for a common case. Change anything that is different today.</span>
            <select value={scenario} onChange={(e) => applyScenario(e.target.value)} className={inputClass}>
              <option value="">Choose a common case…</option>
              {SCENARIOS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>

          {PARTS.map(({ letter, part, label, hint }) => (
            <div key={part} className="flex gap-3.5">
              <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 font-[family-name:var(--font-display)] text-lg font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                {letter}
              </span>
              <div className="min-w-0 flex-1">
                <span className={labelClass}>{label}</span>
                <span className={hintClass}>{hint}</span>
                <TemplateField
                  id={part}
                  templates={TEMPLATES[part]}
                  choice={choices[part]}
                  onChange={(next) => setChoices((previous) => ({ ...previous, [part]: next }))}
                  extraLabel="Add anything unusual (optional)"
                  extraPlaceholder="For example a shipment number, a time or a name"
                  extraMax={1000}
                  error={errors[part]}
                />
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <span className={`${labelClass} flex items-center gap-2`}><AlertTriangle className="h-5 w-5 text-amber-600" /> Safety warning <span className="text-sm font-normal text-slate-600 dark:text-slate-300">(only if there is one)</span></span>
            <span className={hintClass}>Shown at the top of this update so the incoming staff member cannot miss it.</span>
            <TemplateField
              id="warning"
              templates={WARNING_TEMPLATES}
              choice={warning}
              onChange={setWarning}
              extraLabel="Add detail (optional)"
              extraPlaceholder="For example where it is"
              extraMax={200}
            />
            {warning.template && (
              <button type="button" onClick={() => setWarning(EMPTY)} className="mt-2 text-sm font-semibold text-amber-900 underline dark:text-amber-200">No warning after all</button>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-slate-800">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-3 text-base font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" className="rounded-xl bg-teal-700 px-5 py-3 text-base font-semibold text-white hover:bg-teal-800">Save update</button>
          </div>
        </form>
      </section>
    </div>
  );
};
