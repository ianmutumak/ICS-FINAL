import { useCallback, useEffect, useState } from 'react';
import type { UserStaff } from '../types';
import { api, errorMessage, setExpectedUser, setUnauthorizedHandler } from '../lib/api';

type AuthResult = { success: boolean; error?: string };

/** Shown by screens that read the user before anyone has signed in. Never treated as a real account. */
export const SIGNED_OUT_USER: UserStaff = {
  id: '', staffNumber: '', name: '', role: '', department: '', qualification: '', avatarSeed: '', isAdmin: false,
};

/**
 * The signed-in user. Accounts, PINs and roles live on the server: the browser only holds a session cookie it
 * cannot read, and asks the server who it is.
 */
export function useAuth(onSignedIn: (isAdmin: boolean) => void, onSignedOut: () => void) {
  const [currentUser, setCurrentUser] = useState<UserStaff | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [selfRegistration, setSelfRegistration] = useState(false);
  // Shown on the sign-in screen when the server ended the session, for example because another account signed in here.
  const [sessionNotice, setSessionNotice] = useState('');

  // Restore an existing session, and learn whether people may register themselves.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ user }, config] = await Promise.all([
          api<{ user: UserStaff | null }>('GET', '/auth/me'),
          api<{ selfRegistration: boolean }>('GET', '/auth/config'),
        ]);
        if (cancelled) return;
        setSelfRegistration(config.selfRegistration);
        if (user) {
          setCurrentUser(user);
          onSignedIn(Boolean(user.isAdmin));
        }
      } catch {
        // The server is unreachable; the sign-in screen is shown and reports the problem on sign-in.
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once on start-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the server ends the session (for example the account was suspended), return to the sign-in screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setCurrentUser((previous) => {
        if (previous) setSessionNotice('You were signed out. Your session ended, or another account signed in on this browser.');
        return null;
      });
      onSignedOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [onSignedOut]);

  // Tell the server which account this tab is acting as, and notice if the browser's session changes underneath it.
  useEffect(() => {
    setExpectedUser(currentUser?.id ?? '');
  }, [currentUser]);

  const signInUser = useCallback(async (staffNumber: string, pin: string): Promise<AuthResult> => {
    try {
      const { user } = await api<{ user: UserStaff }>('POST', '/auth/login', { staffNumber, pin });
      setSessionNotice('');
      setCurrentUser(user);
      onSignedIn(Boolean(user.isAdmin));
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUpUser = useCallback(async (details: { name: string; staffNumber: string; pin: string }): Promise<AuthResult> => {
    try {
      const { user } = await api<{ user: UserStaff }>('POST', '/auth/register', details);
      setCurrentUser(user);
      onSignedIn(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await api('POST', '/auth/logout');
    } catch {
      // The cookie expires on its own; the screen still returns to sign-in.
    }
    setCurrentUser(null);
    onSignedOut();
  }, [onSignedOut]);

  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<AuthResult> => {
    try {
      await api('POST', '/auth/pin', { currentPin, newPin });
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  }, []);

  /** Sets the signed-in person's profile picture, or removes it with null. */
  const setProfilePhoto = useCallback(async (photo: string | null): Promise<AuthResult> => {
    try {
      const { user } = await api<{ user: UserStaff }>('PUT', '/auth/photo', { photo });
      setCurrentUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  }, []);

  return {
    currentUser: currentUser ?? SIGNED_OUT_USER,
    isAuthenticated: currentUser !== null,
    hasAdminClearance: Boolean(currentUser?.isAdmin),
    authReady,
    selfRegistration,
    sessionNotice,
    signInUser,
    signUpUser,
    signOutUser,
    changePin,
    setProfilePhoto,
  };
}
