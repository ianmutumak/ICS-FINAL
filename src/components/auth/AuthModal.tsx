import React, { useState } from 'react';
import { useHandover, MASTER_ADMIN_PASSKEY } from '../../context/HandoverContext';
import { X, UserCheck, UserPlus, LogIn, Shield, Building2, Lock, KeyRound, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    staffList,
    currentUser,
    signInUser,
    signUpUser,
    switchUser,
    departments,
    hasAdminClearance,
    setActiveTab,
  } = useHandover();

  const [mode, setMode] = useState<'signin' | 'signup' | 'switch' | 'admin_gate'>('signin');
  
  // Sign In state
  const [signInStaffNumber, setSignInStaffNumber] = useState('');
  const [signInPin, setSignInPin] = useState('');
  const [signInAdminPasskey, setSignInAdminPasskey] = useState('');
  const [enableAdminKey, setEnableAdminKey] = useState(false);
  const [authError, setAuthError] = useState('');

  // Admin Elevation Gate State
  const [elevationPasskey, setElevationPasskey] = useState('');
  const [elevationError, setElevationError] = useState('');

  // Sign Up state
  const [fullName, setFullName] = useState('');
  const [staffNumber, setStaffNumber] = useState('');
  const [department, setDepartment] = useState(departments[0]?.name || 'KQ Import Bonded Freight Warehouse');
  const [role, setRole] = useState('Ramp Lead / Cargo Marshall');
  const [pin, setPin] = useState('');
  const [qualification, setQualification] = useState('IATA Cargo / Dangerous Goods Cat 6');
  const [signupPasskey, setSignupPasskey] = useState('');

  if (!isOpen) return null;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const res = signInUser(
      signInStaffNumber,
      signInPin,
      enableAdminKey ? signInAdminPasskey : undefined
    );
    if (res.success) {
      onClose();
    } else {
      setAuthError(res.error || 'Failed to authenticate.');
    }
  };

  const handleAdminElevation = (e: React.FormEvent) => {
    e.preventDefault();
    setElevationError('');
    if (elevationPasskey.trim() !== MASTER_ADMIN_PASSKEY) {
      setElevationError('Invalid Master Admin Passkey. Access denied.');
      return;
    }
    // Authenticate supervisor
    signInUser(currentUser.staffNumber, currentUser.pin || '1234', elevationPasskey.trim());
    setActiveTab('admin');
    onClose();
  };

  const handleEnterAdminConsoleDirect = () => {
    setActiveTab('admin');
    onClose();
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !staffNumber.trim()) return;
    if (pin.trim().length < 4) {
      setAuthError('Security PIN must be at least 4 digits.');
      return;
    }

    const res = signUpUser({
      name: fullName.trim(),
      staffNumber: staffNumber.trim().toUpperCase(),
      department,
      role,
      qualification: qualification.trim(),
      pin,
    });
    if (!res.success) {
      setAuthError(res.error || 'Registration failed. Please try again.');
      return;
    }
    onClose();
  };

  const handleQuickSwitch = (userId: string) => {
    switchUser(userId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 transition-all space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Personnel Access
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Active session: <strong className="text-slate-700 dark:text-slate-200">{currentUser.name}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Elevated Supervisor Card if authorized */}
        {hasAdminClearance && currentUser.isAdmin && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <div>
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200 block">
                  Supervisor Clearance Active
                </span>
                <span className="text-[10px] text-rose-700 dark:text-rose-400">
                  Universal Zone Oversight & Governance
                </span>
              </div>
            </div>
            <button
              onClick={handleEnterAdminConsoleDirect}
              className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span>Enter Admin Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => { setMode('signin'); setAuthError(''); }}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer text-center ${
              mode === 'signin'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setAuthError(''); }}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer text-center ${
              mode === 'signup'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => { setMode('switch'); setAuthError(''); }}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer text-center ${
              mode === 'switch'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Quick Switch
          </button>
          <button
            type="button"
            onClick={() => { setMode('admin_gate'); setElevationError(''); }}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer text-center flex items-center justify-center gap-1 ${
              mode === 'admin_gate'
                ? 'bg-rose-600 text-white shadow-xs font-semibold'
                : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
            }`}
          >
            <Lock className="w-3 h-3" />
            <span>Supervisor Access</span>
          </button>
        </div>

        {/* Tab 1: Sign In */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3 text-xs pt-1">
            {authError && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                {authError}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Badge ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. KQ-OPS-9204"
                value={signInStaffNumber}
                onChange={(e) => setSignInStaffNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                PIN
              </label>
              <input
                type="password"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter 4-digit PIN"
                value={signInPin}
                onChange={(e) => setSignInPin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono tracking-widest"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={enableAdminKey}
                  onChange={(e) => setEnableAdminKey(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-teal-600"
                />
                <span className="text-[11px] font-medium flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-amber-500" />
                  Elevate with Secret Master Admin Passkey
                </span>
              </label>
              {enableAdminKey && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 space-y-1">
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold block">
                    Master Admin Passkey *
                  </span>
                  <input
                    type="password"
                    value={signInAdminPasskey}
                    onChange={(e) => setSignInAdminPasskey(e.target.value)}
                    placeholder="Enter master passkey"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded font-mono text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors cursor-pointer mt-2"
            >
              Sign In
            </button>
          </form>
        )}

        {/* Tab 4: Admin Unlock Gate */}
        {mode === 'admin_gate' && (
          <form onSubmit={handleAdminElevation} className="space-y-3.5 text-xs pt-1">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs">
              Supervisor clearance required to access administrative oversight and system logs.
            </div>

            {elevationError && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                {elevationError}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Master Admin Passkey *
                </label>

              </div>
              <input
                type="password"
                required
                value={elevationPasskey}
                onChange={(e) => setElevationPasskey(e.target.value)}
                placeholder="Enter secret passkey"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Authorize Access</span>
            </button>
          </form>
        )}

        {/* Tab 2: Sign Up */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3 text-xs pt-1">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. David Kiprop"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Badge ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="KQ-OPS-1044"
                  value={staffNumber}
                  onChange={(e) => setStaffNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  PIN (4 Digits)
                </label>
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Set 4-6 digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Operational Zone
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Role
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="MHE Operator"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Certifications
                </label>
                <input
                  type="text"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="OSHA 30 / Reach Truck Cert"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors cursor-pointer mt-2"
            >
              Register & Add to Warehouse Roster
            </button>
          </form>
        )}

        {/* Tab 3: Quick Switch Registered Staff */}
        {mode === 'switch' && (
          <div className="space-y-2 text-xs pt-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-2">
              Select an active institutional profile to switch duty session:
            </span>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {staffList.map((staff) => {
                const isActive = staff.id === currentUser.id;
                return (
                  <button
                    key={staff.id}
                    onClick={() => handleQuickSwitch(staff.id)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{staff.name}</span>
                        {isActive && (
                          <span className="text-[9px] font-mono bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 px-1 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {staff.role} · {staff.department}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {staff.staffNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
