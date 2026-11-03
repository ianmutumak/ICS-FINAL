import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { DepartmentUnit, ShiftType, UserStaff } from '../../types';
import {
  Building2,
  Users,
  Clock,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  UserPlus,
  AlertCircle,
} from 'lucide-react';

interface RosterRotationViewProps {
  onOpenNewShift: () => void;
  onOpenAuthModal: () => void;
}

export const RosterRotationView: React.FC<RosterRotationViewProps> = ({
  onOpenNewShift,
  onOpenAuthModal,
}) => {
  const {
    departments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    staffList,
    assignStaffToRoster,
    currentUser,
    startNewShift,
    setActiveTab,
  } = useHandover();

  const [assigningShift, setAssigningShift] = useState<ShiftType | null>(null);
  const [selectedStaffToAssign, setSelectedStaffToAssign] = useState<string>(staffList[0]?.id || '');

  const currentDept =
    departments.find((d) => d.id === selectedDepartmentId) || departments[0];

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningShift) return;
    const staff = staffList.find((s) => s.id === selectedStaffToAssign);
    if (staff) {
      assignStaffToRoster(currentDept.id, assigningShift, staff);
    }
    setAssigningShift(null);
  };

  const handleLaunchHandoverForDept = (shiftType: ShiftType) => {
    startNewShift(shiftType, currentDept.name);
    setActiveTab('active-handover');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Multi-Department Selection & Staff Overview */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                Multi-Zone Facility Roster
              </span>
              <span aria-hidden="true">·</span>
              <span>24/7 Continuous Floor Rotation</span>
              <span aria-hidden="true">·</span>
              <span>{departments.length} Operating Zones</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Shift Roster & Floor Rotation Schedule
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Worker</span>
            </button>
            <button
              onClick={onOpenNewShift}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Initialize Handover</span>
            </button>
          </div>
        </div>

        {/* Department Selection Strip (Clean segmented style) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          {departments.map((dept) => {
            const isSelected = dept.id === selectedDepartmentId;
            return (
              <button
                key={dept.id}
                onClick={() => setSelectedDepartmentId(dept.id)}
                className={`py-2 px-3.5 rounded-lg border text-left transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{dept.code}</span>
                  <span className="text-xs">{dept.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Department Overview Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {currentDept.name} ({currentDept.code})
              </h2>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                · {currentDept.building}, {currentDept.floor}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Zone Supervisor: <strong>{currentDept.headOfDepartment}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Active Workload: {currentDept.activeUnits || 0} / {currentDept.capacity} Staged Freight / Pallets</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLaunchHandoverForDept(currentDept.currentShift)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <span>Manage Handover Session</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3-Tier Shift Rotation Columns: Morning, Evening, Night */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          {/* Shift 1: Morning Duty */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400 font-bold block">
                  Morning Rotation
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  07:00 – 15:30 EAT
                </span>
              </div>
              <button
                onClick={() => setAssigningShift('morning')}
                title="Assign staff to morning shift"
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {currentDept.roster.morning.map((staff) => (
                <div
                  key={staff.id}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {staff.name}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {staff.role} · {staff.qualification}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {staff.staffNumber}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shift 2: Evening Duty */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400 font-bold block">
                  Evening Rotation
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  15:00 – 23:30 EAT
                </span>
              </div>
              <button
                onClick={() => setAssigningShift('evening')}
                title="Assign staff to evening shift"
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {currentDept.roster.evening.map((staff) => (
                <div
                  key={staff.id}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {staff.name}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {staff.role} · {staff.qualification}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {staff.staffNumber}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shift 3: Night Duty (Graveyard) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold block">
                  Night Duty (Circadian)
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  23:00 – 07:30 EAT
                </span>
              </div>
              <button
                onClick={() => setAssigningShift('night')}
                title="Assign staff to night shift"
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {currentDept.roster.night.map((staff) => (
                <div
                  key={staff.id}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {staff.name}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {staff.role} · {staff.qualification}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {staff.staffNumber}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal dialog */}
      {assigningShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
              Assign Staff to {assigningShift} Duty
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Operational Zone: {currentDept.name}
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Warehouse Workforce Member / Lead
                </label>
                <select
                  value={selectedStaffToAssign}
                  onChange={(e) => setSelectedStaffToAssign(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningShift(null)}
                  className="px-3 py-1.5 text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Confirm Roster Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
