import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose }) => {
  const { addCase, currentUser } = useHandover();
  const [subjectRef, setSubjectRef] = useState('');
  const [situation, setSituation] = useState('');
  const [background, setBackground] = useState('');
  const [assessment, setAssessment] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [hazardAlert, setHazardAlert] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setSubjectRef(''); setSituation(''); setBackground(''); setAssessment('');
    setRecommendation(''); setHazardAlert('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCase({
      subjectRef: subjectRef.trim(), category: 'General update', acuity: 'stable',
      situation: situation.trim(), background: background.trim(), assessment: assessment.trim(),
      recommendation: recommendation.trim(), isolationOrHazardAlert: hazardAlert.trim() || undefined,
      updatedBy: currentUser.name,
    });
    resetForm();
    onClose();
  };

  const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
  const labelClass = 'block text-base font-semibold text-slate-900 dark:text-slate-100';
  const hintClass = 'block text-sm font-normal text-slate-500 dark:text-slate-400';

  // The four SBAR prompts, each asked as the plain question it stands for.
  const fields = [
    { letter: 'S', label: 'Situation', hint: 'What is happening right now?', value: situation, set: setSituation },
    { letter: 'B', label: 'Background', hint: 'What led to it? What does the next person need to know?', value: background, set: setBackground },
    { letter: 'A', label: 'Assessment', hint: 'What have you checked or found?', value: assessment, set: setAssessment },
    { letter: 'R', label: 'Recommendation', hint: 'What should the next shift do, and by when?', value: recommendation, set: setRecommendation },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="new-update-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-update-title" className="text-2xl font-bold text-slate-900 dark:text-white">Add a handover update</h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-300">Four short answers give the next shift the full picture.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className={labelClass}>
            What is this update about?
            <span className={hintClass}>A work area, a piece of equipment, a shipment or an open issue.</span>
            <input required value={subjectRef} onChange={(e) => setSubjectRef(e.target.value)} className={inputClass} />
          </label>

          {fields.map(({ letter, label, hint, value, set }) => (
            <div key={label} className="flex gap-3.5">
              <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 font-[family-name:var(--font-display)] text-lg font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                {letter}
              </span>
              <label className={`${labelClass} min-w-0 flex-1`}>
                {label}
                <span className={hintClass}>{hint}</span>
                <textarea required rows={2} value={value} onChange={(e) => set(e.target.value)} className={`${inputClass} resize-y`} />
              </label>
            </div>
          ))}

          <label className={`${labelClass} rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30`}>
            <span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Safety warning <span className="text-sm font-normal text-slate-600 dark:text-slate-300">(only if there is one)</span></span>
            <span className={hintClass}>Shown at the top of this update so the incoming staff member cannot miss it.</span>
            <input value={hazardAlert} onChange={(e) => setHazardAlert(e.target.value)} className={inputClass} />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-slate-800">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-3 text-base font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" className="rounded-xl bg-teal-700 px-5 py-3 text-base font-semibold text-white hover:bg-teal-800">Save update</button>
          </div>
        </form>
      </section>
    </div>
  );
};
