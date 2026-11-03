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
  ClipboardCheck,
  Trash2,
  Users,
  Activity,
  Check,
  ShieldAlert,
  Award,
  Zap,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { CustodyShieldIcon, SbarProtocolIcon, DualSignoffStampIcon } from '../common/CustomSvgIcons';

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
    themeConfig,
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
      ? `${currentAlert} · [ACKNOWLEDGED by Supervisor on duty]`
      : '[ACKNOWLEDGED: Safe perimeter & isolation verified by supervisor]';
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

  return (
    <div className="space-y-6">
      {/* Capstone Attribution Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-teal-50/70 dark:bg-slate-800/80 border border-teal-200/60 dark:border-slate-700/60 text-xs">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span className="text-slate-800 dark:text-slate-200 font-medium">
            <strong className="text-teal-900 dark:text-teal-300 font-semibold">ZAMU-CHECK</strong> · Strathmore University ICS Capstone (Kiome Ian Mutuma · Reg: 144861 · Supervisor: Dr. Esther Khakata)
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-teal-700 dark:text-teal-300">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Operational Live Handover Protocol</span>
        </div>
      </div>

      {/* Shift Overview Banner */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                {activeHandover.handoverCode}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeHandover.wardOrDepartment}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{activeHandover.shiftType} Duty</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {activeHandover.shiftWindow}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Shift Handover Management & Operations
            </h1>

            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              Outgoing floor lead{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-semibold">
                {activeHandover.leadOutgoing.name} ({activeHandover.leadOutgoing.role})
              </strong>{' '}
              transitioning operational control to incoming lead{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-semibold">
                {activeHandover.leadIncoming.name} ({activeHandover.leadIncoming.role})
              </strong>
              . All data saved to persistent institutional database.
            </p>
          </div>

          {/* Quick Metrics & Attestation CTA */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs font-mono tabular-nums">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">CASES / ASSETS</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {activeHandover.cases.length}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-rose-600 dark:text-rose-400 block text-[10px]">CRITICAL</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                  {criticalCount + unstableCount}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">CUSTODY</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {verifiedEqCount}/{totalEqCount}
                </span>
              </div>
            </div>

            <button
              onClick={onOpenSignoff}
              className={`px-4 py-2.5 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2 ${
                activeHandover.signoff.incomingConfirmed && activeHandover.signoff.outgoingConfirmed
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-600 dark:hover:bg-teal-500'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {activeHandover.signoff.incomingConfirmed && activeHandover.signoff.outgoingConfirmed
                ? 'Attested & Sealed'
                : 'Dual Sign-Off Attestation'}
            </button>
          </div>
        </div>

        {/* Live Handover Effectiveness Index (HEI) Telemetry Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Live Handover Effectiveness Index (HEI)
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${heiColorBadge}`}>
                {heiScore.rating} · {heiScore.score}%
              </span>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Evaluated against SBAR Completeness (40%), Safety Gate (35%), and Custody Verification (25%)
            </div>
          </div>

          {/* HEI Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ${heiProgressColor}`}
              style={{ width: `${heiScore.score}%` }}
            />
          </div>

          {/* 3 HEI Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Pillar 1: SBAR Completeness */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">1. SBAR Structure</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {heiScore.breakdown.sbarCompleteness} / 40 pts
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {heiScore.details.completedSbarCases} of {heiScore.details.totalCases} cases fully structured with Situation, Assessment, Recommendation.
              </p>
            </div>

            {/* Pillar 2: Safety Gate */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">2. Safety Gate & Acknowledgment</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {heiScore.breakdown.safetyAck} / 35 pts
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {heiScore.details.criticalAlertsTotal > 0
                  ? `${heiScore.details.criticalAlertsAcknowledged} of ${heiScore.details.criticalAlertsTotal} critical hazard alerts acknowledged.`
                  : 'Zero unacknowledged high-hazard flags on floor.'}
              </p>
            </div>

            {/* Pillar 3: Equipment Custody */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">3. Physical Custody Handover</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {heiScore.breakdown.equipmentCustody} / 25 pts
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {heiScore.details.equipmentChecked} of {heiScore.details.equipmentTotal} assets physically verified in joint lead walk-through.
              </p>
            </div>
          </div>

          {/* Dual Attestation Readiness Indicator */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {activeHandover.signoff.outgoingConfirmed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span className="text-slate-700 dark:text-slate-300">
                  Outgoing Lead: {activeHandover.signoff.outgoingConfirmed ? 'Signed' : 'Pending Signature'}
                </span>
              </div>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <div className="flex items-center gap-1.5">
                {activeHandover.signoff.incomingConfirmed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span className="text-slate-700 dark:text-slate-300">
                  Incoming Lead: {activeHandover.signoff.incomingConfirmed ? 'Signed' : 'Pending Signature'}
                </span>
              </div>
            </div>

            <button
              onClick={onOpenSignoff}
              className="text-teal-700 dark:text-teal-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>{activeHandover.signoff.verificationHash ? 'View Non-Repudiation Hash' : 'Proceed to Dual Sign-Off'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Shift Huddle Summary Notes */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Shift Briefing Notes & Facility Operational Status
            </label>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Direct manual entry · Auto-persisted to institutional database
            </span>
          </div>
          <textarea
            rows={2}
            value={activeHandover.summaryNotes}
            onChange={(e) => updateSummaryNotes(e.target.value)}
            placeholder="Document overall facility throughput, equipment status, staffing levels, zone capacity, pending cross-docking..."
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100 leading-relaxed"
          />
        </div>
      </section>


      {/* Main 2-Column Split: SBAR Cases (Left 65%) vs Custody & Actions (Right 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: SBAR Operational Case Board (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Structured SBAR Case & Asset Ledger
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Situation · Background · Assessment · Recommendation
              </span>
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
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
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
                <span>Log Handover Case</span>
              </button>
            </div>
          </div>

          {/* SBAR Case Cards List */}
          {filteredCases.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
              <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                No cases match acuity filter "{acuityFilter}"
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Log a new SBAR operational record or select 'all' to inspect all active floor cases.
              </p>
              <button
                onClick={onOpenNewCase}
                className="mt-4 px-4 py-2 text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/60 cursor-pointer"
              >
                Log First SBAR Case
              </button>
            </div>
          ) : (
            filteredCases.map((c) => {
              const isHighRisk = c.acuity === 'critical' || c.acuity === 'unstable';
              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  {/* Card Title & Clean Unboxed Metadata */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {c.subjectRef}
                        </h3>
                        {/* Acuity Text Indicator with clean dot */}
                        <span
                          className={`text-xs font-semibold capitalize ${
                            c.acuity === 'critical'
                              ? 'text-rose-600 dark:text-rose-400'
                              : c.acuity === 'unstable'
                              ? 'text-amber-600 dark:text-amber-400'
                              : c.acuity === 'observation'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          · {c.acuity}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{c.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Updated {c.lastUpdated}</span>
                        <span aria-hidden="true">·</span>
                        <span>By {c.updatedBy}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => deleteCase(c.id)}
                        title="Delete SBAR entry"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Hazard / Isolation Alert & Acknowledgment */}
                  {c.isolationOrHazardAlert ? (
                    <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="font-semibold">Special Safety Order:</span>
                        <span>{c.isolationOrHazardAlert}</span>
                      </div>
                      {!c.isolationOrHazardAlert.includes('[ACKNOWLEDGED') && (
                        <button
                          onClick={() => handleAcknowledgeHazard(c.id, c.isolationOrHazardAlert)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-200/70 dark:bg-amber-900/50 rounded hover:bg-amber-300/80 cursor-pointer self-start sm:self-auto transition-colors"
                        >
                          Acknowledge Safety Control
                        </button>
                      )}
                    </div>
                  ) : isHighRisk ? (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-300">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span className="font-semibold">High Acuity Flag:</span>
                        <span>Requires joint incoming supervisor hazard acknowledgement.</span>
                      </div>
                      <button
                        onClick={() => handleAcknowledgeHazard(c.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-900 dark:text-rose-100 bg-rose-200/80 dark:bg-rose-900/60 rounded hover:bg-rose-300 cursor-pointer self-start sm:self-auto transition-colors"
                      >
                        Acknowledge & Clear Gate
                      </button>
                    </div>
                  ) : null}

                  {/* SBAR 4-Quadrant Matrix */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    {/* Situation */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="font-semibold text-teal-800 dark:text-teal-400 mb-1 flex items-center gap-1">
                        <span>S · Situation</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {c.situation}
                      </p>
                    </div>

                    {/* Background */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="font-semibold text-slate-800 dark:text-slate-300 mb-1">
                        <span>B · Background</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {c.background}
                      </p>
                    </div>

                    {/* Assessment */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="font-semibold text-slate-800 dark:text-slate-300 mb-1">
                        <span>A · Assessment & Metrics</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                        {c.assessment}
                      </p>
                      {/* Metrics tabular strip */}
                      {c.vitalsOrMetrics && c.vitalsOrMetrics.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          {c.vitalsOrMetrics.map((v, i) => (
                            <div
                              key={i}
                              className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded ${
                                v.isAbnormal
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <span className="opacity-75">{v.label}:</span> {v.value}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recommendation */}
                    <div className="p-3 rounded-lg bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800/40">
                      <div className="font-semibold text-teal-900 dark:text-teal-300 mb-1 flex items-center justify-between">
                        <span>R · Recommendation (Action Plan)</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                        {c.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Custody Walkthrough & Carry-Over Action Items (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Section 1: Equipment & Asset Custody Joint Walkthrough */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  MHE & Equipment Custody
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {verifiedEqCount} of {totalEqCount} verified during joint walkthrough
                </span>
              </div>
              <div className="flex items-center gap-1">
                {verifiedEqCount < totalEqCount && (
                  <button
                    onClick={handleVerifyAllEquipment}
                    title="Verify all equipment custody items"
                    className="px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded cursor-pointer transition-colors"
                  >
                    Verify All
                  </button>
                )}
                <button
                  onClick={() => setShowAddEqForm(!showAddEqForm)}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Add equipment asset"
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
                  placeholder="Asset Name (e.g. Electric Forklift #08, RF Scanner #04)"
                  value={newEqName}
                  onChange={(e) => setNewEqName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Asset Tag (e.g. MHE-FL-08)"
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
                    <option value="faulty">Faulty / Maintenance</option>
                    <option value="in_use">In Active Use</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Battery %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newEqBattery}
                      onChange={(e) => setNewEqBattery(e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. In Bay 04"
                      value={newEqNotes}
                      onChange={(e) => setNewEqNotes(e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 text-[11px]"
                    />
                  </div>
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
                    Add Asset
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2 pt-1">
              {activeHandover.equipment.map((eq) => (
                <div
                  key={eq.id}
                  onClick={() => toggleEquipmentCustody(eq.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    eq.custodyChecked
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="pt-0.5">
                    {eq.custodyChecked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {eq.name}
                      </span>
                      {eq.batteryPercent !== undefined && (
                        <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {eq.batteryPercent}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{eq.assetTag}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{eq.status.replace('_', ' ')}</span>
                      <span aria-hidden="true">·</span>
                      <span className={eq.custodyChecked ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                        {eq.custodyChecked ? 'Verified' : 'Pending Check'}
                      </span>
                    </div>
                    {eq.notes && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {eq.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* Section 2: Action Items & Carry-Over Queue */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Cross-Shift Action Queue
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Unresolved tasks roll over automatically
                </span>
              </div>
              <button
                onClick={() => setShowAddActionForm(!showAddActionForm)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                  placeholder="Task Title (e.g. Inspect hydraulic mast on Reach Truck #RT-09)"
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
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                  <input
                    type="text"
                    value={newActionDue}
                    onChange={(e) => setNewActionDue(e.target.value)}
                    placeholder="Due (e.g. 09:30 AM)"
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
                    Add Task
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2 pt-1">
              {activeHandover.actions.map((act) => {
                const isCompleted = act.status === 'completed';
                return (
                  <div
                    key={act.id}
                    onClick={() => toggleTaskStatus(act.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                      isCompleted
                        ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60'
                        : act.priority === 'urgent'
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="pt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-medium text-slate-900 dark:text-white leading-snug ${
                          isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : ''
                        }`}
                      >
                        {act.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        <span className="font-mono tabular-nums">{act.dueTime}</span>
                        <span aria-hidden="true">·</span>
                        <span>{act.assignedTo}</span>
                        {act.carriedOverFromPrevious && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Rolled Over
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
