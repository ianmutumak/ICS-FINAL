import React, { useRef, useState } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';

interface EditProfileModalProps {
  onClose: () => void;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const PICTURE_SIDE = 160;

const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base tracking-widest text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

/**
 * Shrinks a chosen picture to a small square JPEG, so that it is quick to send and to keep.
 * It is read as a data URL, which the page's content security policy allows, and drawn on a canvas, which also means
 * that only the pixels of the picture are kept, never anything else that was in the file.
 */
export async function shrinkPicture(file: File, side = PICTURE_SIDE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a picture file.');
  if (file.size > MAX_FILE_BYTES) throw new Error('That picture is too large. Choose one under 8 MB.');
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That picture could not be read.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('That picture could not be opened. Try a JPEG or PNG.'));
    element.src = source;
  });
  const edge = Math.min(image.width, image.height);
  if (!edge) throw new Error('That picture could not be opened.');
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the picture.');
  // The middle square of the picture is kept.
  context.drawImage(image, (image.width - edge) / 2, (image.height - edge) / 2, edge, edge, 0, 0, side, side);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** Lets a person change their own profile picture and PIN. The server checks the current PIN first. */
export const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
  const { currentUser, changePin, setProfilePhoto } = useHandover();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinDone, setPinDone] = useState(false);

  const choosePicture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoError('');
    setBusy(true);
    try {
      const result = await setProfilePhoto(await shrinkPicture(file));
      if (!result.success) setPhotoError(result.error ?? 'The picture could not be saved.');
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The picture could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const removePicture = async () => {
    setPhotoError('');
    setBusy(true);
    const result = await setProfilePhoto(null);
    if (!result.success) setPhotoError(result.error ?? 'The picture could not be removed.');
    setBusy(false);
  };

  const submitPin = async (event: React.FormEvent) => {
    event.preventDefault();
    setPinError('');
    setPinDone(false);
    const result = await changePin(currentPin, newPin);
    if (result.success) {
      setPinDone(true);
      setCurrentPin('');
      setNewPin('');
    } else {
      setPinError(result.error ?? 'The PIN could not be changed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" className="max-h-[94vh] w-full max-w-md space-y-5 overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 id="edit-profile-title" className="text-lg font-bold text-slate-900 dark:text-white">Edit profile</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex items-center gap-4">
          {currentUser.photo ? (
            <img src={currentUser.photo} alt="Your profile picture" className="h-20 w-20 shrink-0 rounded-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-teal-700 text-2xl font-bold text-white">{initialsOf(currentUser.name)}</span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{currentUser.name}</p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-300">Badge {currentUser.staffNumber}{currentUser.isAdmin ? ', Administrator' : currentUser.role ? `, ${currentUser.role}` : ''}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                <Camera className="h-4 w-4" /> {currentUser.photo ? 'Change picture' : 'Add picture'}
              </button>
              {currentUser.photo && (
                <button type="button" disabled={busy} onClick={() => void removePicture()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/*" onChange={(event) => void choosePicture(event)} className="sr-only" tabIndex={-1} aria-label="Choose a picture" />
          </div>
        </div>
        {photoError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{photoError}</p>}

        <form onSubmit={submitPin} className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Change your PIN</h3>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Current PIN
            <input required type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoComplete="current-password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} className={field} />
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">New PIN (4 to 6 digits)
            <input required type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoComplete="new-password" value={newPin} onChange={(event) => setNewPin(event.target.value)} className={field} />
          </label>
          {pinError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{pinError}</p>}
          {pinDone && <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-200">Your PIN has been changed. Use it the next time you sign in.</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Close</button>
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Change PIN</button>
          </div>
        </form>
      </section>
    </div>
  );
};
