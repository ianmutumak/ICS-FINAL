import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { ZamuLogoIcon } from '../common/CustomSvgIcons';
import {
  Lock,
  LogIn,
  AlertCircle,
  User,
  Hash,
} from 'lucide-react';

export const AuthGatewayView: React.FC = () => {
  const { signInUser, signUpUser } = useHandover();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Sign In State
  const [staffNumberInput, setStaffNumberInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Sign Up State
  const [fullName, setFullName] = useState('');
  const [newStaffNumber, setNewStaffNumber] = useState('');
  const [newPin, setNewPin] = useState('');

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
    const res = signInUser(staffNumberInput.trim(), pinInput.trim());
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
        department: '',
        role: 'Staff member',
        qualification: '',
        pin: newPin.trim(),
      }
    );
    if (!res.success) {
      setErrorMessage(res.error || 'Registration failed. Please try again.');
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
            Shift handover management
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
                  placeholder="Enter your staff ID"
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
                    placeholder="Enter your staff ID"
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

              <button
                type="submit"
                className="w-full py-2.5 px-4 font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors cursor-pointer shadow-lg text-xs mt-1"
              >
                Register Account
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
