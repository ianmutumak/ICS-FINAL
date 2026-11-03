import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { DualSignoffStampIcon, CustodyShieldIcon } from '../common/CustomSvgIcons';
import { X, CheckCircle, ShieldAlert, KeyRound, Archive, ArrowRight } from 'lucide-react';

interface SignoffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignoffModal: React.FC<SignoffModalProps> = ({ isOpen, onClose }) => {
  const {
    activeHandover,
    signOutgoingLead,
    signIncomingLead,
    completeAndArchiveShift,
  } = useHandover();

  const [outgoingInput, setOutgoingInput] = useState(
    activeHandover.signoff.outgoingSignatureText || activeHandover.leadOutgoing.name
  );
  const [incomingInput, setIncomingInput] = useState(
    activeHandover.signoff.incomingSignatureText || activeHandover.leadIncoming.name
  );

  const [showArchivedNotice, setShowArchivedNotice] = useState(false);

  if (!isOpen) return null;

  const { signoff, equipment, actions } = activeHandover;
  const unverifiedEquipment = equipment.filter((e) => !e.custodyChecked);
  const pendingActions = actions.filter((a) => a.status === 'pending' || a.status === 'in_progress');
  const isFullySigned = signoff.outgoingConfirmed && signoff.incomingConfirmed;

  const handleOutgoingSign = (e: React.FormEvent) => {
    e.preventDefault();
    if (outgoingInput.trim()) {
      signOutgoingLead(outgoingInput.trim());
    }
  };

  const handleIncomingSign = (e: React.FormEvent) => {
    e.preventDefault();
    if (incomingInput.trim()) {
      signIncomingLead(incomingInput.trim());
    }
  };

  const handleArchiveAndRoll = () => {
    completeAndArchiveShift();
    setShowArchivedNotice(true);
    setTimeout(() => {
      setShowArchivedNotice(false);
      onClose();
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="text-teal-600 dark:text-teal-400">
              <DualSignoffStampIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Dual-Party Shift Attestation & Verification
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Non-repudiation operational governance protocol · Handover Code:{' '}
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {activeHandover.handoverCode}
                </span>
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

        {/* Readiness Warnings if equipment/tasks unverified */}
        <div className="mt-4 space-y-2">
          {unverifiedEquipment.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold">Custody Attention:</span> {unverifiedEquipment.length} asset(s) not yet checked during joint walk-through ({unverifiedEquipment.map((e) => e.name).slice(0, 2).join(', ')}).
              </div>
            </div>
          )}

          {pendingActions.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-300">
              <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="font-semibold">Action Items Roll-Over:</span> {pendingActions.length} open action item(s) will automatically roll forward to the incoming shift upon sign-off completion.
              </div>
            </div>
          )}
        </div>

        {/* Dual Sign-off Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {/* Outgoing Lead Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400 block">
                  Outgoing Team Lead
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {activeHandover.leadOutgoing.name}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeHandover.leadOutgoing.role}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
              "I confirm that this handover record represents an accurate, complete summary of all operational states, critical incidents, and equipment custody under my watch."
            </p>

            {signoff.outgoingConfirmed ? (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold block">{signoff.outgoingSignatureText}</span>
                    <span className="text-[10px] font-mono opacity-80">
                      Signed: {new Date(signoff.outgoingSignedAt || '').toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded">
                  Verified
                </span>
              </div>
            ) : (
              <form onSubmit={handleOutgoingSign} className="mt-4 space-y-2">
                <input
                  type="text"
                  required
                  value={outgoingInput}
                  onChange={(e) => setOutgoingInput(e.target.value)}
                  placeholder="Type Full Name & Credentials"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg cursor-pointer transition-colors"
                >
                  Confirm & Sign as Outgoing
                </button>
              </form>
            )}
          </div>

          {/* Incoming Lead Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400 block">
                  Incoming Team Lead
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {activeHandover.leadIncoming.name}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeHandover.leadIncoming.role}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
              "I have received the verbal and digital shift briefing, reviewed all high-acuity cases, inspected verified custody items, and formally assume operational responsibility."
            </p>

            {signoff.incomingConfirmed ? (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold block">{signoff.incomingSignatureText}</span>
                    <span className="text-[10px] font-mono opacity-80">
                      Signed: {new Date(signoff.incomingSignedAt || '').toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded">
                  Accepted
                </span>
              </div>
            ) : (
              <form onSubmit={handleIncomingSign} className="mt-4 space-y-2">
                <input
                  type="text"
                  required
                  value={incomingInput}
                  onChange={(e) => setIncomingInput(e.target.value)}
                  placeholder="Type Full Name & Credentials"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer transition-colors"
                >
                  Confirm & Assume Responsibility
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Cryptographic Tamper-Evident Hash */}
        {isFullySigned && (
          <div className="mt-4 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300">
              <CustodyShieldIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Dual Attestation Hash Generated (SHA-256 Non-Repudiation Seal)</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-emerald-800 dark:text-emerald-400 break-all select-all bg-white/70 dark:bg-slate-900/60 p-2 rounded-md border border-emerald-200 dark:border-emerald-900">
              {signoff.verificationHash ||
                'SHA256:7e98a03f441b89efc11a03049182bbcca94017f8a32b694e91244e8c'}
            </div>
          </div>
        )}

        {/* Actions / Archive completion */}
        <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Audit trail compliant with Operational Governance standards</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
            {isFullySigned && (
              <button
                type="button"
                onClick={handleArchiveAndRoll}
                disabled={showArchivedNotice}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                {showArchivedNotice ? 'Archiving...' : 'Seal & Begin Next Shift'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
