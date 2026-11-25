import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { ShiftType } from '../../types';
import { X, Building2 } from 'lucide-react';
import { DEFAULT_WORK_AREAS, OTHER_AREA, preselectArea } from '../../data/workAreas';

interface NewShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Shift that is running right now, using the same windows the shift records use.
function currentShiftType(): ShiftType {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return 'morning';
  if (hour >= 15 && hour < 23) return 'evening';
  return 'night';
}

export const NewShiftModal: React.FC<NewShiftModalProps> = ({ isOpen, onClose }) => {
  const { startNewShift, setActiveTab, departments, currentUser } = useHandover();

  // null until the person picks a work area themselves.
  const [ward, setWard] = useState<string | null>(null);
  const [otherArea, setOtherArea] = useState('');
  const [shiftType, setShiftType] = useState<ShiftType>(currentShiftType);

  if (!isOpen) return null;

  // The administrator's zones are offered when there are any. Until then a list of usual warehouse areas is offered,
  // so a worker picks instead of typing, with "Other" for anything that is not on it.
  const hasZones = departments.length > 0;
  const areaNames = hasZones ? departments.map((dept) => dept.name) : DEFAULT_WORK_AREAS;
  const selectedWard = ward !== null && (ward === OTHER_AREA || areaNames.includes(ward))
    ? ward
    : preselectArea(areaNames, currentUser.department);
  const typing = selectedWard === OTHER_AREA;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const workArea = (typing ? otherArea : selectedWard).trim();
    if (!workArea) return;
    startNewShift(shiftType, workArea);
    setActiveTab('active-handover');
    setWard(null);
    setOtherArea('');
    onClose();
  };

  const fieldClass = 'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-labelledby="new-shift-title" className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 transition-all space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 id="new-shift-title" className="text-base font-bold text-slate-900 dark:text-white">
              Start a shift
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <label className="block font-semibold text-slate-700 dark:text-slate-300">
            Work area
            <select value={selectedWard} onChange={(e) => setWard(e.target.value)} className={`${fieldClass} mt-1 font-normal`}>
              {hasZones
                ? departments.map((dept) => <option key={dept.id} value={dept.name}>{dept.name} ({dept.code})</option>)
                : DEFAULT_WORK_AREAS.map((name) => <option key={name} value={name}>{name}</option>)}
              {!hasZones && <option value={OTHER_AREA}>Other area, I will type it</option>}
            </select>
            {!hasZones && (
              <span className="mt-1 block font-normal text-slate-500 dark:text-slate-400">
                These are standard areas. Your administrator can add the site's own zones under Admin, Zones.
              </span>
            )}
          </label>
          {typing && (
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              Name of the area
              <input
                type="text"
                required
                autoFocus
                maxLength={80}
                value={otherArea}
                onChange={(e) => setOtherArea(e.target.value)}
                placeholder="For example, Dock 5"
                className={`${fieldClass} mt-1 font-normal`}
              />
            </label>
          )}

          <div>
            <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Shift</span>
            <div className="grid grid-cols-3 gap-2">
              {(['morning', 'evening', 'night'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={shiftType === type}
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
              className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 rounded-lg cursor-pointer transition-colors"
            >
              Start shift
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
