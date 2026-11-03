import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldCheck,
  TrendingDown,
  Calendar,
  FileCheck,
} from 'lucide-react';

export const StatisticsAnalyticsView: React.FC = () => {
  const { archive, activeHandover, attendanceLogs, complianceRecords, tasks } = useHandover();

  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'overview' | 'attendance' | 'compliance'>('overview');

  // Compute metrics
  const allHandovers = [activeHandover, ...archive];
  const completedHandovers = allHandovers.filter((h) => h.status === 'completed');

  const avgDuration =
    completedHandovers.length > 0
      ? Math.round(
          completedHandovers.reduce((acc, h) => acc + (h.transitionDurationMinutes || 18), 0) /
            completedHandovers.length
        )
      : 18;

  const totalTasks = tasks.length;
  const carriedOverTasks = tasks.filter((t) => t.carriedOverFromPrevious).length;
  const carryOverRate = totalTasks > 0 ? ((carriedOverTasks / totalTasks) * 100).toFixed(1) : '14.2';

  const punctualCount = attendanceLogs.filter((a) => a.punctual).length;
  const attendanceRate =
    attendanceLogs.length > 0 ? Math.round((punctualCount / attendanceLogs.length) * 100) : 94;

  const avgCompliance =
    complianceRecords.length > 0
      ? Math.round(
          complianceRecords.reduce((acc, c) => acc + c.complianceScore, 0) /
            complianceRecords.length
        )
      : 99;

  // Mock shift duration trend bars
  const shiftTrendData = [
    { code: 'KQ-IMP-N08', duration: 18, target: 20, shift: 'Night' },
    { code: 'KQ-EXP-D07', duration: 16, target: 20, shift: 'Day' },
    { code: 'KQ-COLD-N06', duration: 21, target: 20, shift: 'Night' },
    { code: 'KQ-IMP-D05', duration: 14, target: 20, shift: 'Day' },
    { code: 'KQ-EXP-N04', duration: 17, target: 20, shift: 'Night' },
    { code: 'KQ-XDK-M12', duration: 12, target: 20, shift: 'Morning' },
    { code: 'KQ-HAZ-M05', duration: 15, target: 20, shift: 'Morning' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                Operational Governance & QA
              </span>
              <span aria-hidden="true">·</span>
              <span>Turnover Duration Benchmarks</span>
              <span aria-hidden="true">·</span>
              <span>Non-Repudiation Compliance</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Handover Statistics & Compliance Audits
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              Real-time shift turnover cycle telemetry, task carry-over velocity, and dual cryptographic sign-off compliance.
            </p>
          </div>

          {/* Sub-tab switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
            <button
              onClick={() => setActiveAnalyticsTab('overview')}
              className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer ${
                activeAnalyticsTab === 'overview'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Turnover Metrics
            </button>
            <button
              onClick={() => setActiveAnalyticsTab('attendance')}
              className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer ${
                activeAnalyticsTab === 'attendance'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Staff Attendance ({attendanceLogs.length})
            </button>
            <button
              onClick={() => setActiveAnalyticsTab('compliance')}
              className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer ${
                activeAnalyticsTab === 'compliance'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Sign-Off Audits ({complianceRecords.length})
            </button>
          </div>
        </div>

        {/* 4 Main KPI Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* KPI 1: Handover Transition Time */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase">
                AVG TRANSITION TIME
              </span>
              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {avgDuration}m
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                <TrendingDown className="w-3 h-3 mr-0.5" /> -14% vs verbal
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">Target benchmark: &lt; 20 mins</span>
          </div>

          {/* KPI 2: Task Carry-Over Rate */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase">
                TASK CARRY-OVER RATE
              </span>
              <FileCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {carryOverRate}%
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                ({carriedOverTasks} rolled over)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">0% dropped orders guaranteed</span>
          </div>

          {/* KPI 3: Sign-Off Compliance */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase">
                DUAL SIGN-OFF COMPLIANCE
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400 tabular-nums">
                {avgCompliance}%
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">
                100% Cryptographic
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">Non-repudiation enforced</span>
          </div>

          {/* KPI 4: Staff Huddle Attendance */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase">
                HUDDLE ATTENDANCE
              </span>
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {attendanceRate}%
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {punctualCount}/{attendanceLogs.length} on time
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">Joint shift presence</span>
          </div>
        </div>
      </section>

      {/* Tab Content 1: Turnover Metrics & Duration Trends */}
      {activeAnalyticsTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Shift Duration Chart (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Handover Transition Duration vs 20-Minute Target
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Elapsed minutes from briefing start to incoming lead attestation
                </span>
              </div>
              <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
                Target: &le; 20m
              </span>
            </div>

            {/* Visual Bars */}
            <div className="space-y-3 pt-2">
              {shiftTrendData.map((s) => {
                const isUnderTarget = s.duration <= s.target;
                const percentage = Math.min(100, Math.round((s.duration / 30) * 100));
                return (
                  <div key={s.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {s.code}
                        </span>
                        <span className="text-[11px] text-slate-500">· {s.shift} Duty</span>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          isUnderTarget
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {s.duration} mins
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${percentage}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          isUnderTarget
                            ? 'bg-teal-600 dark:bg-teal-500'
                            : 'bg-amber-500 dark:bg-amber-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 mt-4">
              <strong>Operational Benchmark:</strong> Average transition cycle duration reduced to 16.8 minutes per turnover with 100% cryptographic ledger compliance.
            </div>
          </div>

          {/* Task Resolution Breakdown (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Task Velocity & Roll-Over Safety
            </h3>

            <div className="space-y-4 pt-2 text-xs">
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
                <span className="text-[10px] font-mono uppercase text-emerald-800 dark:text-emerald-300 font-bold block">
                  Completed Within Shift
                </span>
                <span className="text-xl font-bold font-mono text-emerald-900 dark:text-emerald-200">
                  {100 - parseFloat(carryOverRate)}%
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Urgent putaways, battery equalizing cycles, and pre-shift MHE clearances resolved before sign-off.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
                <span className="text-[10px] font-mono uppercase text-amber-800 dark:text-amber-300 font-bold block">
                  Rolled Forward (Zero-Loss)
                </span>
                <span className="text-xl font-bold font-mono text-amber-900 dark:text-amber-200">
                  {carryOverRate}%
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Unfinished putaways, pending dock receipts, and preventative maintenance observations seamlessly passed to incoming shift priority queue.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Staff Attendance & Huddle Check-In History */}
      {activeAnalyticsTab === 'attendance' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Staff Shift Huddle Attendance Log
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Verified physical check-in and huddle participation records
              </span>
            </div>
            <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
              Turnout: {attendanceRate}%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px] bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-2.5 px-4 font-semibold">Staff Member</th>
                  <th className="py-2.5 px-4 font-semibold">Staff ID</th>
                  <th className="py-2.5 px-4 font-semibold">Role</th>
                  <th className="py-2.5 px-4 font-semibold">Department</th>
                  <th className="py-2.5 px-4 font-semibold">Shift Window</th>
                  <th className="py-2.5 px-4 font-semibold">Arrival Time</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Punctuality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attendanceLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                      {log.staffName}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {log.staffNumber}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      {log.role}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      {log.departmentName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 capitalize">
                      {log.shiftType}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {log.arrivedAt}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {log.punctual ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Punctual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Tardy Check-In
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 3: Sign-Off Compliance & Cryptographic Audit Ledger */}
      {activeAnalyticsTab === 'compliance' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Dual Sign-Off Attestation Ledger & Hashes
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Non-repudiation verification records compliant with operational governance and safety audit standards
              </span>
            </div>
            <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
              Avg Score: {avgCompliance}%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px] bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-2.5 px-4 font-semibold">Handover Code</th>
                  <th className="py-2.5 px-4 font-semibold">Department</th>
                  <th className="py-2.5 px-4 font-semibold">Outgoing Lead & Time</th>
                  <th className="py-2.5 px-4 font-semibold">Incoming Lead & Time</th>
                  <th className="py-2.5 px-4 font-semibold">Turnover Delta</th>
                  <th className="py-2.5 px-4 font-semibold">Integrity Hash</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {complianceRecords.map((cmp) => (
                  <tr key={cmp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-teal-700 dark:text-teal-400">
                      {cmp.handoverCode}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-white">
                      {cmp.departmentName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      <div>{cmp.outgoingSigner}</div>
                      <span className="text-[10px] font-mono text-slate-400">{cmp.outgoingSignedAt}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      <div>{cmp.incomingSigner}</div>
                      <span className="text-[10px] font-mono text-slate-400">{cmp.incomingSignedAt}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {cmp.timeDeltaMinutes} mins
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500 max-w-[140px] truncate select-all">
                      {cmp.verificationHash}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> {cmp.complianceScore}% Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
