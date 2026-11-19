/** Browser storage keys. Only small, harmless preferences are kept in the browser; the records live on the server. */
export const STORAGE_KEYS = {
  demoData: 'zamu_statistics_demo_data_v7',
} as const;

// One-time housekeeping. Earlier versions kept accounts (including PINs), shifts and sessions in the browser.
// None of that is used any more, so it is removed rather than left behind on shared devices.
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const keep = new Set<string>(Object.values(STORAGE_KEYS));
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('zamu_') && !keep.has(key)) localStorage.removeItem(key);
    });
  }
} catch {
  // Storage can be unavailable (private mode); nothing needs cleaning then.
}
