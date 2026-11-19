import { useEffect, useState } from 'react';

/** Browser storage keys. The suffix changes when the stored shape changes. */
export const STORAGE_KEYS = {
  activeShift: 'zamu_active_shift_v7',
  archive: 'zamu_archive_v7',
  tasks: 'zamu_tasks_v7',
  currentUser: 'zamu_current_user_v7',
  staffList: 'zamu_staff_list_v7',
  departments: 'zamu_departments_v7',
  theme: 'zamu_theme_v7',
  incidents: 'zamu_incidents_v7',
  overrides: 'zamu_overrides_v7',
  categories: 'zamu_categories_v7',
  susEvaluations: 'zamu_sus_evaluations_v7',
  forecastReview: 'zamu_forecast_review_v7',
} as const;

// One-time housekeeping: drop caches from older versions, and never keep a signed-in
// session or admin clearance in the browser.
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const legacyMarkers = ['_v1', '_v2', '_v3', '_v4', '_v5', '_v6', 'templates'];
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('zamu_') && legacyMarkers.some((marker) => key.includes(marker))) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem('zamu_is_authenticated_v7');
    localStorage.removeItem('zamu_admin_clearance_v7');
  }
} catch {
  // Storage can be unavailable (private mode); the app then runs from memory.
}

export function readStored<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch {
    return null;
  }
}

/** useState that writes its value to browser storage whenever it changes. */
export function usePersistedState<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);
  return [value, setValue] as const;
}
