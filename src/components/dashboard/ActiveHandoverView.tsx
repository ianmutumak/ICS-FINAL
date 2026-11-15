import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { AcuityLevel } from '../../types';
import {
  Plus,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Circle,
  FileText,
  AlertTriangle,
  ClipboardList,
  Trash2,
  ShieldAlert,
  Zap,
  ArrowRight,
  Package,
  Layers,
  CheckSquare,
} from 'lucide-react';

interface ActiveHandoverViewProps {
  onOpenNewCase: () => void;
  onOpenSignoff: () => void;
}

export const ActiveHandoverView: React.FC<ActiveHandoverViewProps> = ({
  onOpenNewCase,
  onOpenSignoff,
}) => {
  const {
    activeHandover,
    updateSummaryNotes,
    deleteCase,
    updateCase,
    toggleEquipmentCustody,
    addEquipmentItem,
    toggleTaskStatus,
    addTask,
    heiScore,
  } = useHandover();

  const [acuityFilter, setAcuityFilter] = useState<'all' | AcuityLevel>('all');
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionPriority, setNewActionPriority] = useState<'urgent' | 'high' | 'normal'>('normal');
  const [newActionDue, setNewActionDue] = useState('08:00 AM');
  const [showAddActionForm, setShowAddActionForm] = useState(false);

  const [newEqName, setNewEqName] = useState('');
  const [newEqTag, setNewEqTag] = useState('');
  const [newEqStatus, setNewEqStatus] = useState<'functional' | 'inspection_due' | 'faulty' | 'in_use'>('functional');
  const [newEqBattery, setNewEqBattery] = useState('100');
  const [newEqNotes, setNewEqNotes] = useState('');
  const [showAddEqForm, setShowAddEqForm] = useState(false);

  const filteredCases =
    acuityFilter === 'all'
      ? activeHandover.cases
      : activeHandover.cases.filter((c) => c.acuity === acuityFilter);

  const criticalCount = activeHandover.cases.filter((c) => c.acuity === 'critical').length;
  const unstableCount = activeHandover.cases.filter((c) => c.acuity === 'unstable').length;
  const verifiedEqCount = activeHandover.equipment.filter((e) => e.custodyChecked).length;
  const totalEqCount = activeHandover.equipment.length;

  const handleVerifyAllEquipment = () => {
    activeHandover.equipment.forEach((item) => {
      if (!item.custodyChecked) {
        toggleEquipmentCustody(item.id);
      }
    });
  };

  const handleCreateAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim()) return;
    addTask({
      title: newActionTitle.trim(),
      priority: newActionPriority,
      departmentId: activeHandover.departmentId,
      departmentName: activeHandover.wardOrDepartment,
      assignedTo: 'Incoming Shift Lead',
      dueTime: newActionDue,
    });
    setNewActionTitle('');
    setShowAddActionForm(false);
  };

  const handleCreateEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEqName.trim()) return;
    addEquipmentItem({
      name: newEqName.trim(),
      assetTag: newEqTag.trim() || `EQ-${Math.floor(Math.random() * 9000 + 1000)}`,
      location: activeHandover.wardOrDepartment,
      status: newEqStatus,
      batteryPercent: parseInt(newEqBattery, 10) || 100,
      notes: newEqNotes.trim() || undefined,
    });
    setNewEqName('');
    setNewEqTag('');
    setNewEqNotes('');
    setNewEqStatus('functional');
    setNewEqBattery('100');
    setShowAddEqForm(false);
  };

  const handleAcknowledgeHazard = (caseId: string, currentAlert?: string) => {
    const updatedAlert = currentAlert
      ? `${currentAlert} · [ACKNOWLEDGED by Supervisor]`
      : '[ACKNOWLEDGED: Safe perimeter verified by supervisor]';
    updateCase(caseId, { isolationOrHazardAlert: updatedAlert });
  };

  // Color mappings for HEI rating
  const heiColorBadge = {
    Optimal: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    Satisfactory: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800',
    'At-Risk': 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    Deficient: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  }[heiScore.rating];

  const heiProgressColor = {
    Optimal: 'bg-emerald-500',
    Satisfactory: 'bg-teal-600',
    'At-Risk': 'bg-amber-500',
    Deficient: 'bg-rose-500',
  }[heiScore.rating];

  const isDualSigned =
    activeHandover.signoff.incomingConfirmed && activeHandover.signoff.outgoingConfirmed;

  return (
    <div className="space-y-5">
      {/* Shift Overview Banner */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-teal-700 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded">
                {activeHandover.handoverCode}
              </span>
              <span>·</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {activeHandover.wardOrDepartment}
              </span>
              <span>·</span>
              <span className="capitalize">{activeHandover.shiftType} Shift</span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {activeHandover.shiftWindow}
              </span>
            </div>

            {/* Clean Staff Transfer Indicator */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-400">Outgoing</span>
                <span className="font-semibold">{activeHandover.leadOutgoing.name}</span>
                <span className="text-[10px] text-slate-400">({activeHandover.leadOutgoing.role})</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 border border-teal-200/50 dark:border-teal-800/40">
                <span className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400">Incoming</span>
                <span className="font-semibold">{activeHandover.leadIncoming.name}</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400">({activeHandover.leadIncoming.role})</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Sign-off CTA */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <div>
                  <span className="text-slate-400 block text-[9px]">CASES</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {activeHandover.cases.length}
                  </span>
                </div>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <div>
                  <span className="text-rose-500 block text-[9px]">CRITICAL</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {criticalCount + unstableCount}
                  </span>
                </div>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <div>
                  <span className="text-slate-400 block text-[9px]">CUSTODY</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {verifiedEqCount}/{totalEqCount}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onOpenSignoff}
              className={`px-4 py-2.5 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                isDualSigned
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-600 dark:hover:bg-teal-500'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isDualSigned ? 'Handover Sealed' : 'Dual Sign-Off'}</span>
            </button>
          </div>
        </div>

        {/* Live HEI Telemetry Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Handover Index (HEI)
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${heiColorBadge}`}>
                {heiScore.rating} · {heiScore.score}%
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                {activeHandover.signoff.outgoingConfirmed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300" />
                )}
                Outgoing
              </span>
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                {activeHandover.signoff.incomingConfirmed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300" />
                )}
                Incoming
              </span>
            </div>
          </div>

          {/* HEI Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ${heiProgressColor}`}
              style={{ width: `${heiScore.score}%` }}
            />
          </div>

          {/* 3 HEI Metric Chips (Compact & clean) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="font-medium text-slate-700 dark:text-slate-300">SBAR Completeness</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {heiScore.breakdown.sbarCompleteness}/40
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Safety Clearance</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {heiScore.breakdown.safetyAck}/35
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Equipment Custody</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {heiScore.breakdown.equipmentCustody}/25
              </span>
            </div>
          </div>
        </div>

        {/* Shift Notes */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Shift Notes
          </label>
          <textarea
            rows={2}
            value={activeHandover.summaryNotes}
            onChange={(e) => updateSummaryNotes(e.target.value)}
            placeholder="Key operational updates, bay throughput, or special instructions..."
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100 leading-relaxed"
          />
        </div>
      </section>

      {/* Main Split: Cases (Left) vs Custody & Tasks (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: SBAR Operational Cases */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Operational Cases ({filteredCases.length})
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Acuity Filter Segmented Buttons */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                {(['all', 'critical', 'unstable', 'observation', 'stable'] as const).map((filter) => {
                  const isSelected = acuityFilter === filter;
                  return (
                    <button
                      key={filter}
                      onClick={() => setAcuityFilter(filter)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={onOpenNewCase}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Case</span>
              </button>
            </div>
          </div>

          {/* Cases List */}
          {filteredCases.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
              <ClipboardList className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                No cases found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No active operational cases match this filter.
              </p>
            </div>
          ) : (
            filteredCases.map((c) => {
              const isHighRisk = c.acuity === 'critical' || c.acuity === 'unstable';
              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  {/* Case Header */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {c.subjectRef}
                        </h3>
                        <span
                          className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full text-[11px] ${
                            c.acuity === 'critical'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : c.acuity === 'unstable'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : c.acuity === 'observation'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {c.acuity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span>{c.category}</span>
                        <span>·</span>
                        <span>{c.lastUpdated}</span>
                        <span>·</span>
                        <span>{c.updatedBy}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteCase(c.id)}
                      title="Delete case"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Hazard Alert */}
                  {c.isolationOrHazardAlert ? (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span className="font-semibold">Safety Order:</span>
                        <span>{c.isolationOrHazardAlert}</span>
                      </div>
                      {!c.isolationOrHazardAlert.includes('[ACKNOWLEDGED') && (
                        <button
                          onClick={() => handleAcknowledgeHazard(c.id, c.isolationOrHazardAlert)}
                          className="px-2 py-1 text-[11px] font-semibold text-amber-900 bg-amber-200 rounded hover:bg-amber-300 cursor-pointer self-start sm:self-auto"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  ) : isHighRisk ? (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-300">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                        <span className="font-semibold">High Acuity:</span>
                        <span>Requires incoming supervisor acknowledgement.</span>
                      </div>
                      <button
                        onClick={() => handleAcknowledgeHazard(c.id)}
                        className="px-2 py-1 text-[11px] font-semibold text-rose-900 bg-rose-200 rounded hover:bg-rose-300 cursor-pointer self-start sm:self-auto"
                      >
                        Acknowledge
                      </button>
                    </div>
                  ) : null}

                  {/* SBAR 4-Quadrant Matrix */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-teal-700 dark:text-teal-400 block mb-1">Situation</span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{c.situation}</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Background</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{c.background}</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Assessment</span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-1.5">{c.assessment}</p>
                      {c.vitalsOrMetrics && c.vitalsOrMetrics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          {c.vitalsOrMetrics.map((v, i) => (
                            <span
                              key={i}
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                v.isAbnormal
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {v.label}: {v.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800/40">
                      <span className="font-bold text-teal-800 dark:text-teal-300 block mb-1">Recommendation</span>
                      <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{c.recommendation}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Custody & Action Items */}
        <div className="lg:col-span-4 space-y-5">
          {/* Equipment Custody */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Equipment Custody
                </h3>
                <span className="text-xs font-mono text-slate-400 ml-1">
                  ({verifiedEqCount}/{totalEqCount})
                </span>
              </div>
              <div className="flex items-center gap-1">
                {verifiedEqCount < totalEqCount && (
                  <button
                    onClick={handleVerifyAllEquipment}
                    className="px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded cursor-pointer"
                  >
                    Verify All
                  </button>
                )}
                <button
                  onClick={() => setShowAddEqForm(!showAddEqForm)}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showAddEqForm && (
              <form
                onSubmit={handleCreateEquipment}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
              >
                <input
                  type="text"
                  required
                  placeholder="Asset Name (e.g. Forklift #08)"
                  value={newEqName}
                  onChange={(e) => setNewEqName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Tag (e.g. MHE-FL-08)"
                    value={newEqTag}
                    onChange={(e) => setNewEqTag(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                  />
                  <select
                    value={newEqStatus}
                    onChange={(e) => setNewEqStatus(e.target.value as any)}
                    className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    <option value="functional">Functional</option>
                    <option value="inspection_due">Inspection Due</option>
                    <option value="faulty">Faulty</option>
                    <option value="in_use">In Use</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddEqForm(false)}
                    className="px-2 py-1 text-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-teal-700 text-white rounded font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5">
              {activeHandover.equipment.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
                  No equipment logged for custody
                </div>
              ) : (
                activeHandover.equipment.map((eq) => (
                  <div
                    key={eq.id}
                    onClick={() => toggleEquipmentCustody(eq.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      eq.custodyChecked
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {eq.custodyChecked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                          {eq.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {eq.assetTag} · {eq.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {eq.batteryPercent !== undefined && (
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {eq.batteryPercent}%
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cross-Shift Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Action Queue
                </h3>
                <span className="text-xs font-mono text-slate-400 ml-1">
                  ({activeHandover.actions.length})
                </span>
              </div>
              <button
                onClick={() => setShowAddActionForm(!showAddActionForm)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showAddActionForm && (
              <form
                onSubmit={handleCreateAction}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
              >
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newActionPriority}
                    onChange={(e) => setNewActionPriority(e.target.value as any)}
                    className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input
                    type="text"
                    value={newActionDue}
                    onChange={(e) => setNewActionDue(e.target.value)}
                    placeholder="Due (09:00 AM)"
                    className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddActionForm(false)}
                    className="px-2 py-1 text-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-teal-700 text-white rounded font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5">
              {activeHandover.actions.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
                  No pending action items
                </div>
              ) : (
                activeHandover.actions.map((act) => {
                  const isCompleted = act.status === 'completed';
                  return (
                    <div
                      key={act.id}
                      onClick={() => toggleTaskStatus(act.id)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                        isCompleted
                          ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60'
                          : act.priority === 'urgent'
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="pt-0.5">
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium text-slate-900 dark:text-white leading-snug ${
                            isCompleted ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {act.title}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-mono">{act.dueTime}</span>
                          <span>·</span>
                          <span>{act.assignedTo}</span>
                          {act.carriedOverFromPrevious && (
                            <span className="text-amber-600 font-semibold">· Rolled Over</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
