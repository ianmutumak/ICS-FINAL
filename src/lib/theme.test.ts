import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, otherTheme, readTheme } from './theme';

const storageWith = (value: string | null | 'throws') => ({
  getItem: () => {
    if (value === 'throws') throw new Error('storage unavailable');
    return value;
  },
});
const prefersDark = (dark: boolean) => ({ matches: dark });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme', () => {
  it('uses the saved choice first', () => {
    vi.stubGlobal('localStorage', storageWith('dark'));
    vi.stubGlobal('window', { matchMedia: () => prefersDark(false) });
    expect(readTheme()).toBe('dark');
    vi.stubGlobal('localStorage', storageWith('light'));
    vi.stubGlobal('window', { matchMedia: () => prefersDark(true) });
    expect(readTheme()).toBe('light');
  });

  it('follows the device when nothing valid is saved', () => {
    vi.stubGlobal('window', { matchMedia: () => prefersDark(true) });
    vi.stubGlobal('localStorage', storageWith(null));
    expect(readTheme()).toBe('dark');
    vi.stubGlobal('localStorage', storageWith('purple'));
    expect(readTheme()).toBe('dark');
    vi.stubGlobal('window', { matchMedia: () => prefersDark(false) });
    expect(readTheme()).toBe('light');
  });

  it('still works when storage or the device preference cannot be read', () => {
    vi.stubGlobal('localStorage', storageWith('throws'));
    vi.stubGlobal('window', { matchMedia: () => { throw new Error('no media queries'); } });
    expect(readTheme()).toBe('light');
  });

  it('switches the page by putting the dark class on and off', () => {
    const classes = new Set<string>();
    const root = {
      classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
      style: { colorScheme: '' },
    };
    vi.stubGlobal('document', { documentElement: root });
    applyTheme('dark');
    expect(classes.has('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    applyTheme('light');
    expect(classes.has('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });

  it('knows the other theme', () => {
    expect(otherTheme('dark')).toBe('light');
    expect(otherTheme('light')).toBe('dark');
  });
});
