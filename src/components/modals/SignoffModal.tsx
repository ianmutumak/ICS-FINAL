import React from 'react';
import { useHandover } from '../../context/HandoverContext';
import { DualSignoffStampIcon, CustodyShieldIcon } from '../common/CustomSvgIcons';
import { X, CheckCircle, ShieldAlert, KeyRound, Archive, ArrowRight } from 'lucide-react';

interface SignoffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SignatureCardProps {
  label: string;
  statement: string;
  signedBadge: string;
  confirmed: boolean;
  signerName?: string;
  signedAt?: string;
  // Shown until the signature is recorded: a sign button or the reason signing is not available.
  pending: React.ReactNode;
}

const SignatureCard: React.FC<SignatureCardProps> = ({
  label,
  statement,
  signedBadge,
  confirmed,
  signerName,
  signedAt,
  pending,
}) => (
  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
    <div className="pb-2 border-b border-slate-200 dark:border-slate-700/60">
      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400 block">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">
        {confirmed ? signerName : 'Waiting for signature'}
      </span>
    </div>

    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">{statement}</p>

    {confirmed ? (
      <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold block">{signerName}</span>
            {signedAt && (
              <span className="text-[10px] font-mono opacity-80">
                Signed: {new Date(signedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded">
          {signedBadge}
        </span>
      </div>
    ) : (
      <div className="mt-4">{pending}</div>
    )}
  </div>
);

export const SignoffModal: React.FC<SignoffModalProps> = ({ isOpen, onClose }) => {
  const {
    activeHandover,
    currentUser,
    hasAdminClearance,
    signOutgoingLead,
    signIncomingLead,
    completeAndArchiveShift,
  } = useHandover();

  if (!isOpen) return null;

  const { signoff, equipment, actions } = activeHandover;
  const unverifiedEquipment = equipment.filter((e) => !e.custodyChecked);
  const pendingActions = actions.filter((a) => a.status === 'pending' || a.status === 'in_progress');
  const isFullySigned = signoff.outgoingConfirmed && signoff.incomingConfirmed;
  // A signature is the signed-in account, so the same account cannot hand over to itself.
  const signedOutgoingAsCurrentUser = signoff.outgoingConfirmed && signoff.outgoingStaffId === currentUser.id;

  const handleApprove = () => {
    completeAndArchiveShift();
    onClose();
  };

  const noteClass = 'text-xs leading-relaxed text-slate-500 dark:text-slate-400';

  const outgoingPending = hasAdminClearance ? (
    <p className={noteClass}>Waiting for the outgoing staff member to sign.</p>
  ) : (
    <button
      type="button"
      onClick={signOutgoingLead}
      className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg cursor-pointer transition-colors"
    >
      Sign as {currentUser.name}
    </button>
  );

  let incomingPending: React.ReactNode;
  if (!signoff.outgoingConfirmed) {
    incomingPending = <p className={noteClass}>The outgoing staff member signs first.</p>;
  } else if (hasAdminClearance) {
    incomingPending = <p className={noteClass}>Waiting for the incoming staff member to sign.</p>;
  } else if (signedOutgoingAsCurrentUser) {
    incomingPending = (
      <p className={noteClass}>
        You signed as the outgoing staff member. The staff member taking over must sign in with their own account to accept this handover.
      </p>
    );
  } else {
    incomingPending = (
      <button
        type="button"
        onClick={signIncomingLead}
        className="w-full py-2 px-3 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer transition-colors"
      >
        Sign as {currentUser.name}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-labelledby="signoff-title" className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="text-teal-600 dark:text-teal-400">
              <DualSignoffStampIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 id="signoff-title" className="text-base font-bold text-slate-900 dark:text-white">
                Review and sign the handover
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Both staff members sign with their own accounts before an administrator approves the handover.
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
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
          <SignatureCard
            label="Outgoing staff member"
            statement="I have checked the updates and am handing over this shift."
            signedBadge="Signed"
            confirmed={signoff.outgoingConfirmed}
            signerName={signoff.outgoingSignatureText || signoff.outgoingStaffName}
            signedAt={signoff.outgoingSignedAt}
            pending={outgoingPending}
          />
          <SignatureCard
            label="Incoming staff member"
            statement="I have reviewed the updates and am taking over this shift."
            signedBadge="Accepted"
            confirmed={signoff.incomingConfirmed}
            signerName={signoff.incomingSignatureText || signoff.incomingStaffName}
            signedAt={signoff.incomingSignedAt}
            pending={incomingPending}
          />
        </div>

        {/* Handover approval state */}
        {isFullySigned && (
          <div className="mt-4 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300">
              <CustodyShieldIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Outgoing and incoming staff signatures recorded</span>
            </div>
            {signoff.verificationHash && <div className="mt-1 font-mono text-[11px] text-emerald-800 dark:text-emerald-400 break-all">{signoff.verificationHash}</div>}
          </div>
        )}

        {/* Actions / Archive completion */}
        <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Shift approval is recorded after administrator review</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
            {isFullySigned && hasAdminClearance && (
              <button
                type="button"
                onClick={handleApprove}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                Approve and start next shift
              </button>
            )}
            {isFullySigned && !hasAdminClearance && (
              <span className="text-xs text-amber-700 dark:text-amber-300">Both staff signatures recorded. Awaiting administrator approval.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
