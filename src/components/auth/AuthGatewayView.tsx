import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { ZamuLogoIcon } from '../common/CustomSvgIcons';
import { AlertCircle, ClipboardList, LogIn, PenLine, ShieldCheck, UserPlus } from 'lucide-react';

const HANDOVER_STEPS = [
  { icon: ClipboardList, title: 'Record', text: 'Log what the next team needs to know as it happens, not from memory at the end.' },
  { icon: PenLine, title: 'Sign', text: 'The outgoing and incoming staff each sign with their own account.' },
  { icon: ShieldCheck, title: 'Approve', text: 'An administrator reviews the signed handover and closes the shift.' },
];

export const AuthGatewayView: React.FC = () => {
  const { signInUser, signUpUser, selfRegistration, sessionNotice } = useHandover();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [errorMessage, setErrorMessage] = useState('');

  // Sign In State
  const [staffNumberInput, setStaffNumberInput] = useState('');
  const [pinInput, setPinInput] = useState('');

  // Sign Up State
  const [fullName, setFullName] = useState('');
  const [newStaffNumber, setNewStaffNumber] = useState('');
  const [newPin, setNewPin] = useState('');

  const switchMode = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setErrorMessage('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (staffNumberInput.trim().length === 0) {
      setErrorMessage('Enter your badge ID.');
      return;
    }
    if (pinInput.trim().length < 4) {
      setErrorMessage('Your PIN has at least 4 digits.');
      return;
    }
    const res = await signInUser(staffNumberInput.trim(), pinInput.trim());
    if (!res.success) {
      setErrorMessage(res.error || 'We could not sign you in. Check your badge ID and PIN.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!fullName.trim() || !newStaffNumber.trim()) {
      setErrorMessage('Enter your name and badge ID.');
      return;
    }
    if (newStaffNumber.trim().length < 4) {
      setErrorMessage('A badge ID has at least 4 characters.');
      return;
    }
    if (newPin.trim().length < 4) {
      setErrorMessage('Choose a PIN with at least 4 digits.');
      return;
    }

    const res = await signUpUser({
      name: fullName.trim(),
      staffNumber: newStaffNumber.trim().toUpperCase(),
      pin: newPin.trim(),
    });
    if (!res.success) {
      setErrorMessage(res.error || 'We could not create the account. Try again.');
    }
  };

  const labelClass = 'block text-sm font-semibold text-slate-800';
  const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20';
  const submitClass = 'flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-800';

  return (
    <div className="grid min-h-screen bg-slate-50 text-slate-900 lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel: what the system is for, in the order a shift goes through it */}
      <aside className="relative flex flex-col justify-between gap-6 overflow-hidden bg-teal-900 px-6 py-7 text-teal-50 sm:px-10 lg:gap-10 lg:px-14 lg:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[40px] border-teal-800/60" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full border-[40px] border-teal-800/40" />

        <div className="relative flex items-center gap-3">
          <ZamuLogoIcon className="h-10 w-10 text-amber-300" />
          <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-white">Zamu-Check</span>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            Nothing gets lost between shifts.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-teal-100 sm:text-lg">
            A structured handover for cargo and warehouse teams: clear updates, two signatures, one approved record.
          </p>

          {/* On phones and tablets the form comes straight after the headline. */}
          <ol className="mt-8 hidden space-y-5 lg:block">
            {HANDOVER_STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-800 text-amber-300">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-white">{index + 1}. {title}</p>
                  <p className="text-sm leading-relaxed text-teal-100">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative hidden text-sm text-teal-200 lg:block">Shift handover management</p>
      </aside>

      {/* Sign-in panel */}
      <main className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            {authMode === 'signin' ? 'Sign in to your shift' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {authMode === 'signin' ? selfRegistration ? 'Use the badge ID and PIN you registered with.' : 'Use your badge ID and PIN. Accounts are created by an administrator.' : 'You will sign handovers with this account.'}
          </p>

          <div role="tablist" aria-label="Account" className={`mt-6 grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1 text-sm ${selfRegistration ? 'grid' : 'hidden'}`}>
            {([['signin', 'Sign in'], ['signup', 'Register']] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={authMode === mode}
                onClick={() => switchMode(mode)}
                className={`rounded-lg py-2 font-semibold transition-colors ${
                  authMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {sessionNotice && !errorMessage && (
            <div role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">{sessionNotice}</div>
          )}

          {errorMessage && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {authMode === 'signin' ? (
            <form onSubmit={handleSignIn} className="mt-5 space-y-4">
              <label className={labelClass}>
                Badge ID
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={staffNumberInput}
                  onChange={(e) => setStaffNumberInput(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </label>
              <label className={labelClass}>
                PIN
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="current-password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className={`${inputClass} font-mono tracking-[0.3em]`}
                />
              </label>
              <button type="submit" className={submitClass}>
                <LogIn className="h-5 w-5" /> Sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="mt-5 space-y-4">
              <label className={labelClass}>
                Full name
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Badge ID
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={newStaffNumber}
                  onChange={(e) => setNewStaffNumber(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </label>
              <label className={labelClass}>
                Choose a PIN <span className="font-normal text-slate-500">(4 to 6 digits)</span>
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="new-password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className={`${inputClass} font-mono tracking-[0.3em]`}
                />
              </label>
              <button type="submit" className={submitClass}>
                <UserPlus className="h-5 w-5" /> Create account
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
