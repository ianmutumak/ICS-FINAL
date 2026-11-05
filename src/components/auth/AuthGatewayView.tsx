import React, { useState } from 'react';
import { useHandover, MASTER_ADMIN_PASSKEY } from '../../context/HandoverContext';
import { ZamuLogoIcon } from '../common/CustomSvgIcons';
import {
  Lock,
  KeyRound,
  LogIn,
  AlertCircle,
  Sparkles,
  User,
  ShieldCheck,
  Building2,
  Briefcase,
  Award,
  Hash,
} from 'lucide-react';
import { loginWithGoogle } from '../../lib/firebase';

export const AuthGatewayView: React.FC = () => {
  const { signInUser, signUpUser, departments } = useHandover();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Sign In State
  const [staffNumberInput, setStaffNumberInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [enableAdminClearance, setEnableAdminClearance] = useState(false);
  const [adminPasskeyInput, setAdminPasskeyInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Sign Up State
  const [fullName, setFullName] = useState('');
  const [newStaffNumber, setNewStaffNumber] = useState('');
  const [department, setDepartment] = useState(departments[0]?.name || 'KQ Import Bonded Freight Warehouse');
  const [role, setRole] = useState('Shift Operations Lead');
  const [qualification, setQualification] = useState('IATA Cargo / MHE Certified');
  const [newPin, setNewPin] = useState('');
  const [signupAdminPasskey, setSignupAdminPasskey] = useState('');

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (staffNumberInput.trim().length === 0) {
      setErrorMessage('Please enter your Badge ID.');
      return;
    }
    if (pinInput.trim().length < 4) {
      setErrorMessage('PIN must be at least 4 digits.');
      return;
    }
    const res = signInUser(
      staffNumberInput.trim(),
      pinInput.trim(),
      enableAdminClearance ? adminPasskeyInput.trim() : undefined
    );
    if (!res.success) {
      setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!fullName.trim() || !newStaffNumber.trim()) {
      setErrorMessage('Please fill in required fields.');
      return;
    }
    if (newStaffNumber.trim().length < 4) {
      setErrorMessage('Badge ID must be at least 4 characters.');
      return;
    }
    if (newPin.trim().length < 4) {
      setErrorMessage('PIN must be at least 4 digits.');
      return;
    }

    const res = signUpUser(
      {
        name: fullName.trim(),
        staffNumber: newStaffNumber.trim().toUpperCase(),
        department,
        role,
        qualification: qualification.trim(),
        pin: newPin.trim(),
      },
      signupAdminPasskey.trim() || undefined
    );
    if (!res.success) {
      setErrorMessage(res.error || 'Registration failed. Please try again.');
    }
  };

  // Quick profile shortcuts
  const autofillStaff = () => {
    setStaffNumberInput('KQ-OPS-9204');
    setPinInput('1234');
    setEnableAdminClearance(false);
    setAdminPasskeyInput('');
    setErrorMessage('');
  };

  const autofillAdmin = () => {
    setStaffNumberInput('KQ-SUP-8841');
    setPinInput('1234');
    setEnableAdminClearance(true);
    setAdminPasskeyInput(MASTER_ADMIN_PASSKEY);
    setErrorMessage('');
  };

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
      signInUser('KQ-SUP-8841', '1234', MASTER_ADMIN_PASSKEY);
    } catch (err) {
      console.warn('Google Auth notice:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-5">
        {/* Brand */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex p-2.5 rounded-2xl bg-teal-950/80 border border-teal-800/80 text-teal-400 shadow-xl mb-1">
            <ZamuLogoIcon className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            ZAMU-CHECK
          </h1>
          <p className="text-xs text-slate-400">
            Kenya Airways Cargo · Shift Turnover & Governance
          </p>
        </div>

        {/* Portal Card */}
        <div className="bg-slate-950/90 rounded-2xl border border-slate-800 shadow-2xl p-5 sm:p-6 backdrop-blur-xl space-y-4">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setErrorMessage(''); }}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all text-center cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setErrorMessage(''); }}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all text-center cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/80 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode 1: Sign In */}
          {authMode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span>Badge ID</span>
                </label>
                <input
                  type="text"
                  required
                  value={staffNumberInput}
                  onChange={(e) => setStaffNumberInput(e.target.value)}
                  placeholder="KQ-OPS-9204"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Security PIN</span>
                </label>
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="4-digit PIN"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Supervisor Clearance */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={enableAdminClearance}
                    onChange={(e) => setEnableAdminClearance(e.target.checked)}
                    className="rounded border-slate-700 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-amber-400" />
                    Supervisor Clearance Passkey
                  </span>
                </label>

                {enableAdminClearance && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-900/80 border border-amber-900/50 space-y-1">
                    <input
                      type="password"
                      value={adminPasskeyInput}
                      onChange={(e) => setAdminPasskeyInput(e.target.value)}
                      placeholder="Supervisor Passkey"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors cursor-pointer shadow-lg text-xs mt-1 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            </form>
          )}

          {/* Mode 2: Sign Up */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. David Kiprop"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold mb-1 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span>Badge ID *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaffNumber}
                    onChange={(e) => setNewStaffNumber(e.target.value)}
                    placeholder="KQ-OPS-2051"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>PIN (4 Digits) *</span>
                  </label>
                  <input
                    type="password"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="4-digit PIN"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Operational Zone</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
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
                  <label className="text-slate-300 font-semibold mb-1 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    <span>Role</span>
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Operations Lead"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold mb-1 flex items-center gap-1">
                    <Award className="w-3 h-3 text-slate-400" />
                    <span>Certification</span>
                  </label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="IATA Cargo"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium mb-1 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  <span>Supervisor Passkey (Optional)</span>
                </label>
                <input
                  type="password"
                  value={signupAdminPasskey}
                  onChange={(e) => setSignupAdminPasskey(e.target.value)}
                  placeholder="Clearance passkey"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-[11px]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors cursor-pointer shadow-lg text-xs mt-1"
              >
                Register Account
              </button>
            </form>
          )}

          {/* Quick Access Profiles */}
          <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block text-center">
              Quick Test Profiles
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={autofillStaff}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer flex items-center gap-2"
              >
                <User className="w-4 h-4 text-teal-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-slate-200 block truncate">
                    Ramp Lead
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block truncate">
                    KQ-OPS-9204
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={autofillAdmin}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-900/60 text-left transition-colors cursor-pointer flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-amber-300 block truncate">
                    Supervisor
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block truncate">
                    KQ-SUP-8841
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Google Sign In option */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-2 px-3 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Google Sign-In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
