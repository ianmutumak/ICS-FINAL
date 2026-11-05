import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { ShiftType } from '../../types';
import {
  Building2,
  Users,
  Clock,
  Plus,
  ArrowRight,
  UserPlus,
  Sun,
  Sunset,
  Moon,
  Package,
  User,
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

  const shiftsConfig = [
    {
      type: 'morning' as const,
      title: 'Morning Shift',
      time: '07:00 – 15:30',
      icon: Sun,
      iconColor: 'text-amber-500',
      staff: currentDept.roster.morning,
    },
    {
      type: 'evening' as const,
      title: 'Evening Shift',
      time: '15:00 – 23:30',
      icon: Sunset,
      iconColor: 'text-orange-500',
      staff: currentDept.roster.evening,
    },
    {
      type: 'night' as const,
      title: 'Night Shift',
      time: '23:00 – 07:30',
      icon: Moon,
      iconColor: 'text-indigo-400',
      staff: currentDept.roster.night,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                Facility Roster
              </span>
              <span>·</span>
              <span>{departments.length} Zones</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Shift Roster & Rotation
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Staff</span>
            </button>
            <button
              onClick={onOpenNewShift}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Start Shift</span>
            </button>
          </div>
        </div>

        {/* Zone Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          {departments.map((dept) => {
            const isSelected = dept.id === selectedDepartmentId;
            return (
              <button
                key={dept.id}
                onClick={() => setSelectedDepartmentId(dept.id)}
                className={`py-1.5 px-3 rounded-lg border text-left transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 text-xs ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="font-mono text-[11px] font-bold text-teal-700 dark:text-teal-400">{dept.code}</span>
                <span>{dept.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Department Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {currentDept.name}
              </h2>
              <span className="text-xs font-mono text-slate-400">
                ({currentDept.code})
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Supervisor: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{currentDept.headOfDepartment}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                Workload: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{currentDept.activeUnits || 0}/{currentDept.capacity}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={() => handleLaunchHandoverForDept(currentDept.currentShift)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg shadow-xs cursor-pointer transition-colors self-start sm:self-auto"
          >
            <span>Open Shift</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3 Shifts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {shiftsConfig.map((shift) => {
            const Icon = shift.icon;
            return (
              <div
                key={shift.type}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-2.5"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${shift.iconColor}`} />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight">
                        {shift.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {shift.time}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setAssigningShift(shift.type)}
                    title="Assign staff"
                    className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {shift.staff.map((staff) => (
                    <div
                      key={staff.id}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                          {staff.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white block truncate text-[11px]">
                            {staff.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {staff.role}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {staff.staffNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
              Zone: {currentDept.name}
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Staff Member
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
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
