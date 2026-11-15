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

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
  const fieldClass = 'block text-sm font-medium text-slate-800 dark:text-slate-200';
  const fields = [
    { label: 'Situation', note: 'What is happening?', value: situation, set: setSituation },
    { label: 'Background', note: 'What should the next person know?', value: background, set: setBackground },
    { label: 'Assessment', note: 'What have you checked or found?', value: assessment, set: setAssessment },
    { label: 'Recommendation', note: 'What should happen next?', value: recommendation, set: setRecommendation },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="new-update-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-update-title" className="text-xl font-bold text-slate-900 dark:text-white">Add a handover update</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Share the key details the next shift needs.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className={fieldClass}>What is this update about?
            <input required value={subjectRef} onChange={(e) => setSubjectRef(e.target.value)} placeholder="For example, a work area, item, or open issue" className={`${inputClass} mt-1.5`} />
          </label>
          {fields.map(({ label, note, value, set }) => (
            <label key={label} className={fieldClass}>{label}<span className="ml-2 font-normal text-slate-500">{note}</span>
              <textarea required rows={2} value={value} onChange={(e) => set(e.target.value)} className={`${inputClass} mt-1.5 resize-y`} />
            </label>
          ))}
          <label className={fieldClass}>
            <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-600" /> Safety warning <span className="font-normal text-slate-500">(optional)</span></span>
            <input value={hazardAlert} onChange={(e) => setHazardAlert(e.target.value)} placeholder="Add a warning the next shift should see" className={`${inputClass} mt-1.5`} />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">Save update</button>
          </div>
        </form>
      </section>
    </div>
  );
};
