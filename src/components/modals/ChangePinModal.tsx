import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';

interface ChangePinModalProps {
  onClose: () => void;
}

const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base tracking-widest text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

/** Lets anyone change their own PIN. The server checks the current PIN first. */
export const ChangePinModal: React.FC<ChangePinModalProps> = ({ onClose }) => {
  const { changePin } = useHandover();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const result = await changePin(currentPin, newPin);
    if (result.success) setDone(true);
    else setError(result.error ?? 'The PIN could not be changed.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="change-pin-title" className="w-full max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 id="change-pin-title" className="text-base font-bold text-slate-900 dark:text-white">Change your PIN</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>
        {done ? (
          <>
            <p className="text-sm text-slate-700 dark:text-slate-300">Your PIN has been changed. Use it the next time you sign in.</p>
            <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Done</button></div>
          </>
        ) : (
          <>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Current PIN
              <input required type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoComplete="current-password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">New PIN (4 to 6 digits)
              <input required type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoComplete="new-password" value={newPin} onChange={(event) => setNewPin(event.target.value)} className={field} />
            </label>
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Change PIN</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};
