import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../context/storage';

export type Theme = 'light' | 'dark';

/** The person's saved choice, or else what their device prefers. Storage can be unavailable, so every read is guarded. */
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // fall through to the device preference
  }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // no preference available
  }
  return 'light';
}

/** Switches the whole interface by putting or removing the `dark` class that the styles are written against. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export const otherTheme = (theme: Theme): Theme => (theme === 'dark' ? 'light' : 'dark');

/** The current theme and a function that switches it and remembers the choice on this device. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => applyTheme(theme), [theme]);
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = otherTheme(current);
      try {
        localStorage.setItem(STORAGE_KEYS.theme, next);
      } catch {
        // the choice still applies until the page is closed
      }
      return next;
    });
  }, []);
  return { theme, toggleTheme };
}
