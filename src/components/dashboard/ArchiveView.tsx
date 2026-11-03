import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { HandoverRecord } from '../../types';
import { Search, Printer, ShieldCheck, Clock, Eye, Plus, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface ArchiveViewProps {
  onStartNewShiftClick: () => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ onStartNewShiftClick }) => {
  const { archive, activeHandover } = useHandover();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<HandoverRecord | null>(null);

  // Combine active handover and past archives for search
  const allHandovers = [activeHandover, ...archive];

  const filteredHandovers = allHandovers.filter((h) => {
    const q = searchQuery.toLowerCase();
    return (
      h.handoverCode.toLowerCase().includes(q) ||
      h.wardOrDepartment.toLowerCase().includes(q) ||
      h.leadOutgoing.name.toLowerCase().includes(q) ||
      h.leadIncoming.name.toLowerCase().includes(q) ||
      h.cases.some((c) => c.subjectRef.toLowerCase().includes(q) || c.situation.toLowerCase().includes(q))
    );
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                Operational Shift Audit Vault
              </span>
              <span aria-hidden="true">·</span>
              <span>Non-repudiation Archives</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Historical Shift Handover Ledger
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl mt-1">
              Immutable records of completed shift transitions, signed turnover briefs, and custody logs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onStartNewShiftClick}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Start New Shift Session</span>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by handover code, zone, operational case, asset, or operator..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </section>

      {/* Handover List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px] bg-slate-50/50 dark:bg-slate-800/40">
                <th className="py-3 px-4 font-semibold">Handover Code</th>
                <th className="py-3 px-4 font-semibold">Operational Zone / Bay</th>
                <th className="py-3 px-4 font-semibold">Shift Window</th>
                <th className="py-3 px-4 font-semibold">Outgoing → Incoming</th>
                <th className="py-3 px-4 font-semibold">Cases</th>
                <th className="py-3 px-4 font-semibold">Dual Sign-Off</th>
                <th className="py-3 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredHandovers.map((h) => {
                const isSigned = h.signoff.outgoingConfirmed && h.signoff.incomingConfirmed;
                return (
                  <tr
                    key={h.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-teal-800 dark:text-teal-400">
                      {h.handoverCode}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-200 font-medium">
                      {h.wardOrDepartment}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div className="capitalize font-medium">{h.shiftType}</div>
                      <div className="text-[10px] font-mono opacity-80">{h.shiftWindow}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      <div className="truncate max-w-[180px]">{h.leadOutgoing.name}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        → {h.leadIncoming.name}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {h.cases.length} cases
                    </td>
                    <td className="py-3 px-4">
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Sealed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          In Progress
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedShiftForDetail(h)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal / Printable Briefing Sheet */}
      {selectedShiftForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 transition-all space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono uppercase text-teal-700 dark:text-teal-400 font-bold block">
                  Official Handover Summary Sheet
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedShiftForDetail.handoverCode}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>{selectedShiftForDetail.wardOrDepartment}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{selectedShiftForDetail.shiftType} Shift</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedShiftForDetail.shiftDate}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  onClick={() => setSelectedShiftForDetail(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* General Briefing */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                Facility Briefing Notes:
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedShiftForDetail.summaryNotes || 'No notes documented.'}
              </p>
            </div>

            {/* SBAR Cases */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                SBAR Operational Cases & Critical Holds ({selectedShiftForDetail.cases.length})
              </h3>
              <div className="space-y-3">
                {selectedShiftForDetail.cases.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{c.subjectRef}</span>
                      <span className="capitalize font-semibold text-teal-700 dark:text-teal-400">
                        {c.acuity}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <strong className="text-slate-700 dark:text-slate-300">Situation:</strong>{' '}
                        <span className="text-slate-600 dark:text-slate-400">{c.situation}</span>
                      </div>
                      <div>
                        <strong className="text-slate-700 dark:text-slate-300">Recommendation:</strong>{' '}
                        <span className="text-slate-600 dark:text-slate-400">{c.recommendation}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dual Sign-off Attestation */}
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Non-Repudiation Audit Seal</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                    OUTGOING ATTESTATION
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedShiftForDetail.signoff.outgoingSignatureText ||
                      selectedShiftForDetail.leadOutgoing.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                    INCOMING ACCEPTANCE
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedShiftForDetail.signoff.incomingSignatureText ||
                      selectedShiftForDetail.leadIncoming.name}
                  </span>
                </div>
              </div>
              {selectedShiftForDetail.signoff.verificationHash && (
                <div className="font-mono text-[10px] text-emerald-800 dark:text-emerald-400 select-all pt-1 border-t border-emerald-200/50 dark:border-emerald-800/40">
                  {selectedShiftForDetail.signoff.verificationHash}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
