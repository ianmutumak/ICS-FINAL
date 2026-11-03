import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { AcuityLevel } from '../../types';
import { X, AlertCircle, Database, CheckCircle2 } from 'lucide-react';
import { SbarProtocolIcon } from '../common/CustomSvgIcons';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose }) => {
  const { addCase, categories } = useHandover();

  const [subjectRef, setSubjectRef] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Air Cargo & ULD Staging');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState('');
  const [acuity, setAcuity] = useState<AcuityLevel>('stable');
  const [situation, setSituation] = useState('');
  const [background, setBackground] = useState('');
  const [assessment, setAssessment] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [hazardAlert, setHazardAlert] = useState('');
  const [vitalsInput, setVitalsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectRef.trim() || !situation.trim() || !recommendation.trim()) return;

    setIsSaving(true);

    // Parse simple comma-separated metrics
    const vitalsOrMetrics = vitalsInput.trim()
      ? vitalsInput
          .split(',')
          .map((item) => {
            const parts = item.split(':');
            if (parts.length >= 2) {
              return {
                label: parts[0].trim(),
                value: parts.slice(1).join(':').trim(),
                isAbnormal: false,
              };
            }
            return null;
          })
          .filter((v): v is { label: string; value: string; isAbnormal: boolean } => v !== null)
      : undefined;

    const finalCategory = isCustomCategory ? customCategoryText.trim() : category;

    addCase({
      subjectRef: subjectRef.trim(),
      category: finalCategory || 'Warehouse Operations & MHE',
      acuity,
      situation: situation.trim(),
      background: background.trim() || 'Baseline parameters recorded.',
      assessment: assessment.trim() || 'Visual and operational telemetry logged.',
      recommendation: recommendation.trim(),
      isolationOrHazardAlert: hazardAlert.trim() ? hazardAlert.trim() : undefined,
      vitalsOrMetrics,
      updatedBy: 'On-Duty Shift Lead',
    });

    setIsSaving(false);
    onClose();

    // Reset form
    setSubjectRef('');
    setCategory(categories[0] || 'Air Cargo & ULD Staging');
    setCustomCategoryText('');
    setIsCustomCategory(false);
    setSituation('');
    setBackground('');
    setAssessment('');
    setRecommendation('');
    setHazardAlert('');
    setVitalsInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 transition-all">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="text-teal-600 dark:text-teal-400">
              <SbarProtocolIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Input New SBAR Handover Record
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Direct manual entry · Saved directly to institutional database
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Top row: Subject & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Zone / Asset / Consignment Reference *
              </label>
              <input
                type="text"
                required
                value={subjectRef}
                onChange={(e) => setSubjectRef(e.target.value)}
                placeholder="e.g. Bay 04B · Reach Truck #RT-04, Pallet #PMC-88914, or AWB #KQ-90812"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Operational Workstream
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  {isCustomCategory ? 'Select existing' : 'Type custom'}
                </button>
              </div>

              {isCustomCategory ? (
                <input
                  type="text"
                  value={customCategoryText}
                  onChange={(e) => setCustomCategoryText(e.target.value)}
                  placeholder="Enter custom operational workstream"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
                />
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Acuity Level Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Priority & Operational Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['stable', 'observation', 'unstable', 'critical'] as AcuityLevel[]).map((level) => {
                const isSelected = acuity === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setAcuity(level)}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all capitalize cursor-pointer ${
                      isSelected
                        ? level === 'critical'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/40 dark:border-rose-500 dark:text-rose-300 font-bold'
                          : level === 'unstable'
                          ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-950/40 dark:border-amber-500 dark:text-amber-300 font-bold'
                          : level === 'observation'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-300 font-bold'
                          : 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SBAR 4 Quadrants - Pure Input */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span className="font-bold text-teal-700 dark:text-teal-400">S — Situation</span> (What is the active condition / state?) *
              </label>
              <textarea
                required
                rows={2}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="State current event, machinery warning, staging status, or active queue condition..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span className="font-bold text-teal-700 dark:text-teal-400">B — Background</span> (Context, origin, runtime history)
              </label>
              <textarea
                rows={2}
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="Equipment runtime hours, flight/manifest origin, inspection history, prior shift notes..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span className="font-bold text-teal-700 dark:text-teal-400">A — Assessment</span> (Inspection findings & verification)
              </label>
              <textarea
                rows={2}
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                placeholder="Visual verification, sensor measurements, container seal state, checklist results..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span className="font-bold text-teal-700 dark:text-teal-400">R — Recommendation</span> (Required handover action for incoming lead) *
              </label>
              <textarea
                required
                rows={2}
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                placeholder="Direct mandatory actions: schedule maintenance, release KRA seal, verify temperature, swap battery..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Metrics & Hazard alert */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telemetry & Readings (Optional: Key: Value, Key: Value)
              </label>
              <input
                type="text"
                value={vitalsInput}
                onChange={(e) => setVitalsInput(e.target.value)}
                placeholder="e.g. Battery: 85%, Hydraulic: 180 bar, Temp: +4°C"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                Safety Caution / LOTO / Quarantine Notice
              </label>
              <input
                type="text"
                value={hazardAlert}
                onChange={(e) => setHazardAlert(e.target.value)}
                placeholder="e.g. Lockout Tag #204, bonded cage isolation"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
              <Database className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Saves directly to Cloud Firestore & local ledger
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSaving ? 'Saving to Database...' : 'Save to Database'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
