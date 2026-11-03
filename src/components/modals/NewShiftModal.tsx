import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { X, Sparkles, Building2 } from 'lucide-react';

interface NewShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewShiftModal: React.FC<NewShiftModalProps> = ({ isOpen, onClose }) => {
  const { startNewShift, setActiveTab, departments } = useHandover();

  const [ward, setWard] = useState(departments[0]?.name || 'KQ Import Bonded Freight Warehouse');
  const [shiftType, setShiftType] = useState<'morning' | 'evening' | 'night'>('morning');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startNewShift(shiftType, ward);
    setActiveTab('active-handover');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 transition-all space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Initialize Shift Handover Session
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Operational Zone / Facility Bay
            </label>
            <select
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Shift Window & Period
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['morning', 'evening', 'night'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setShiftType(type)}
                  className={`py-2 px-2 text-center rounded-lg border capitalize font-medium cursor-pointer transition-colors ${
                    shiftType === type
                      ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-800 dark:text-teal-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 rounded-lg cursor-pointer transition-colors"
            >
              Start Handover
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
