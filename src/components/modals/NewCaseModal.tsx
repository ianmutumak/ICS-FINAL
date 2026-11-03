import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { AcuityLevel, OperationalTemplate } from '../../types';
import { X, AlertCircle, LayoutTemplate, Sparkles } from 'lucide-react';
import { SbarProtocolIcon } from '../common/CustomSvgIcons';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose }) => {
  const { addCase, templates, categories } = useHandover();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
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
  const [vitalsInput, setVitalsInput] = useState('Hydraulic Pressure: 175 bar, Battery: 88%, Temp: 21°C');

  if (!isOpen) return null;

  const handleApplyTemplate = (tmpl: OperationalTemplate) => {
    setSelectedTemplateId(tmpl.id);
    if (!subjectRef) {
      setSubjectRef(`${tmpl.name} (Unit/Zone Ref)`);
    }
    setCategory(tmpl.category);
    setIsCustomCategory(false);
    setSituation(tmpl.defaultSituation);
    setBackground(tmpl.defaultBackground);
    setAssessment(tmpl.defaultAssessment);
    setRecommendation(tmpl.defaultRecommendation);
    if (tmpl.defaultHazardAlert) {
      setHazardAlert(tmpl.defaultHazardAlert);
    }
    if (tmpl.defaultMetrics) {
      setVitalsInput(tmpl.defaultMetrics);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectRef.trim() || !situation.trim() || !recommendation.trim()) return;

    // Parse simple comma-separated metrics
    const vitalsOrMetrics = vitalsInput
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
      .filter((v): v is { label: string; value: string; isAbnormal: boolean } => v !== null);

    const finalCategory = isCustomCategory ? customCategoryText.trim() : category;

    addCase({
      subjectRef,
      category: finalCategory || 'Warehouse Operations & MHE',
      acuity,
      situation,
      background: background || 'None documented.',
      assessment,
      recommendation,
      isolationOrHazardAlert: hazardAlert.trim() ? hazardAlert : undefined,
      vitalsOrMetrics,
      updatedBy: 'On-Duty Shift Lead',
    });

    onClose();
    // Reset form
    setSelectedTemplateId('');
    setSubjectRef('');
    setCategory(categories[0] || 'Warehouse Operations & MHE');
    setCustomCategoryText('');
    setIsCustomCategory(false);
    setSituation('');
    setBackground('');
    setAssessment('');
    setRecommendation('');
    setHazardAlert('');
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
                Log New SBAR Operational Record
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Standardized Handover Entry · Structured SBAR Protocol Applied to Industrial Operations
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

        {/* Quick Admin-Configured Template Selector */}
        {templates.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <LayoutTemplate className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Apply Operational Template (Admin Configured)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Click to prefill SBAR fields
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 opacity-70" />
                    <span>{tmpl.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
                  Operational Classification / Workstream
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  {isCustomCategory ? 'Pick standard' : 'Enter custom'}
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

          {/* Acuity Level Selector (Clean segmented control) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Acuity / Priority Level
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

          {/* SBAR 4 Quadrants */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span className="font-bold text-teal-700 dark:text-teal-400">S — Situation</span> (What is happening right now?) *
              </label>
              <textarea
                required
                rows={2}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="State acute operational concerns, machine breakdown, pallet hazard, or dock stoppage..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span className="font-bold text-teal-700 dark:text-teal-400">B — Background</span> (What is the operational context / baseline?)
              </label>
              <textarea
                rows={2}
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="Equipment service hours, previous maintenance, shipment origin, container manifest..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span className="font-bold text-teal-700 dark:text-teal-400">A — Assessment</span> (What are the objective findings?)
              </label>
              <textarea
                rows={2}
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                placeholder="Diagnostic telemetry, hydraulic pressure readings, core temperatures, visual damage, error codes..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span className="font-bold text-teal-700 dark:text-teal-400">R — Recommendation</span> (What must the incoming shift do?) *
              </label>
              <textarea
                required
                rows={2}
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                placeholder="Specific instructions for incoming lead: vendor technician escort, battery equalizing, quarantine hold..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Metrics & Hazards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telemetry & Key Metrics (Comma-separated)
              </label>
              <input
                type="text"
                value={vitalsInput}
                onChange={(e) => setVitalsInput(e.target.value)}
                placeholder="Hydraulic Pressure: 180 bar, Battery: 88%"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                LOTO / Safety Precautions / Hazard Alert
              </label>
              <input
                type="text"
                value={hazardAlert}
                onChange={(e) => setHazardAlert(e.target.value)}
                placeholder="e.g. LOTO Tag #881 on ignition, chemical spill barricade"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              Save SBAR Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
