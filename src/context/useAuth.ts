import { useState } from 'react';
import { UserStaff } from '../types';
import { SEED_STAFF } from '../data/seedData';
import { STORAGE_KEYS, readStored, usePersistedState } from './storage';

export const MASTER_ADMIN_PASSKEY = 'ZAMU-ADMIN-2026';

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).join('').substring(0, 2).toUpperCase() || '?';

type AuthResult ={ success: boolean; user?: UserStaff; error?: string };

/**
 * Staff accounts and the current session.
 * This is a client-side demonstration login, not real authentication (see the README).
 */
export function useAuth(onSignedIn: (isAdmin: boolean) => void, onSignedOut: () => void) {
  const [staffList, setStaffList] = usePersistedState<UserStaff[]>(
    STORAGE_KEYS.staffList,
    () => readStored<UserStaff[]>(STORAGE_KEYS.staffList) ?? SEED_STAFF
  );
  const [currentUser, setCurrentUser] = usePersistedState<UserStaff>(
    STORAGE_KEYS.currentUser,
    () => readStored<UserStaff>(STORAGE_KEYS.currentUser) ?? SEED_STAFF[0]
  );

  // A session never survives a reload: these two are deliberately not persisted.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasAdminClearance, setHasAdminClearance] = useState(false);

  const startSession = (user: UserStaff, isAdmin: boolean) => {
    setCurrentUser({ ...user, isAdmin });
    setIsAuthenticated(true);
    setHasAdminClearance(isAdmin);
    onSignedIn(isAdmin);
  };

  const signInUser = (staffNumber: string, pin: string, adminPasskey?: string): AuthResult => {
    const user = staffList.find((s) => s.staffNumber.trim().toLowerCase() === staffNumber.trim().toLowerCase());
    if (!user) {
      return { success: false, error: 'Staff ID not found in institutional roster.' };
    }
    if (user.pin && user.pin !== pin) {
      return { success: false, error: 'Incorrect PIN provided for this staff account.' };
    }
    if (user.status === 'suspended') {
      return { success: false, error: 'This account is suspended. Contact an administrator.' };
    }
    const passkeyMatches = Boolean(adminPasskey && adminPasskey.trim() === MASTER_ADMIN_PASSKEY);
    startSession(user, Boolean(user.isAdmin) || passkeyMatches);
    return { success: true };
  };

  const signUpUser = (userData: Omit<UserStaff, 'id' | 'avatarSeed'>, adminPasskey?: string): AuthResult => {
    if (staffList.some((s) => s.staffNumber.trim().toLowerCase() === userData.staffNumber.trim().toLowerCase())) {
      return { success: false, error: 'A worker with this Badge ID already exists in the roster.' };
    }
    const initials = userData.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    const isAdmin = Boolean(adminPasskey && adminPasskey.trim() === MASTER_ADMIN_PASSKEY);
    const newUser: UserStaff = {
      ...userData,
      id: `usr-${Date.now().toString(36)}`,
      avatarSeed: initials || 'RN',
      status: 'active',
      isAdmin,
    };
    setStaffList((prev) => [newUser, ...prev]);
    startSession(newUser, isAdmin);
    return { success: true, user: newUser };
  };

  const switchUser = (userId: string) => {
    const target = staffList.find((s) => s.id === userId);
    if (target) {
      setCurrentUser(target);
      setHasAdminClearance(Boolean(target.isAdmin));
    }
  };

  const signOutUser = () => {
    setIsAuthenticated(false);
    setHasAdminClearance(false);
    onSignedOut();
  };

  // ---- User management (administrators) ----

  const badgeTaken = (staffNumber: string, exceptId?: string) =>
    staffList.some((s) => s.id !== exceptId && s.staffNumber.trim().toLowerCase() === staffNumber.trim().toLowerCase());

  /** True if removing admin rights from, suspending or deleting this user would leave no working administrator. */
  const isLastActiveAdmin = (userId: string) => {
    const activeAdmins = staffList.filter((s) => s.isAdmin && s.status !== 'suspended');
    return activeAdmins.length === 1 && activeAdmins[0].id === userId;
  };

  const addUser = (userData: Omit<UserStaff, 'id' | 'avatarSeed'>): AuthResult => {
    if (!userData.name.trim() || !userData.staffNumber.trim()) {
      return { success: false, error: 'Enter a name and a badge ID.' };
    }
    if (!userData.pin || !/^\d{4,6}$/.test(userData.pin)) {
      return { success: false, error: 'The PIN must be 4 to 6 digits.' };
    }
    if (badgeTaken(userData.staffNumber)) {
      return { success: false, error: 'Another user already has this badge ID.' };
    }
    const newUser: UserStaff = {
      ...userData,
      name: userData.name.trim(),
      staffNumber: userData.staffNumber.trim().toUpperCase(),
      id: `usr-${Date.now().toString(36)}`,
      avatarSeed: initialsOf(userData.name),
      status: userData.status ?? 'active',
      isAdmin: Boolean(userData.isAdmin),
    };
    setStaffList((prev) => [newUser, ...prev]);
    return { success: true, user: newUser };
  };

  const updateUser = (userId: string, changes: Partial<Omit<UserStaff, 'id' | 'avatarSeed'>>): AuthResult => {
    const existing = staffList.find((s) => s.id === userId);
    if (!existing) return { success: false, error: 'This user no longer exists.' };

    const updated: UserStaff = { ...existing, ...changes };
    updated.name = updated.name.trim();
    updated.staffNumber = updated.staffNumber.trim().toUpperCase();
    updated.avatarSeed = initialsOf(updated.name);
    // An empty PIN field means "keep the current PIN".
    if (!changes.pin) updated.pin = existing.pin;

    if (!updated.name || !updated.staffNumber) return { success: false, error: 'Enter a name and a badge ID.' };
    if (changes.pin && !/^\d{4,6}$/.test(changes.pin)) return { success: false, error: 'The PIN must be 4 to 6 digits.' };
    if (badgeTaken(updated.staffNumber, userId)) return { success: false, error: 'Another user already has this badge ID.' };
    if (isLastActiveAdmin(userId) && (!updated.isAdmin || updated.status === 'suspended')) {
      return { success: false, error: 'This is the only active administrator. Make another user an administrator first.' };
    }

    setStaffList((prev) => prev.map((s) => (s.id === userId ? updated : s)));
    if (currentUser.id === userId) {
      setCurrentUser(updated);
      setHasAdminClearance(Boolean(updated.isAdmin));
    }
    return { success: true, user: updated };
  };

  const deleteUser = (userId: string): AuthResult => {
    if (userId === currentUser.id) return { success: false, error: 'You cannot delete the account you are signed in with.' };
    if (isLastActiveAdmin(userId)) {
      return { success: false, error: 'This is the only active administrator. Make another user an administrator first.' };
    }
    setStaffList((prev) => prev.filter((s) => s.id !== userId));
    return { success: true };
  };

  const updateUserRole =(userId: string, newRole: string, isAdmin: boolean) => {
    setStaffList((prev) => prev.map((s) => (s.id === userId ? { ...s, role: newRole, isAdmin } : s)));
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, role: newRole, isAdmin }));
      setHasAdminClearance(isAdmin);
    }
  };

  const updateUserStatus = (userId: string, status: 'active' | 'on_leave' | 'suspended') => {
    setStaffList((prev) => prev.map((s) => (s.id === userId ? { ...s, status } : s)));
  };

  return {
    staffList,
    currentUser,
    isAuthenticated,
    hasAdminClearance,
    signInUser,
    signUpUser,
    switchUser,
    signOutUser,
    addUser,
    updateUser,
    deleteUser,
    updateUserRole,
    updateUserStatus,
  };
}
