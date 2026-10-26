const KEY = 'eventkit.accessToken';

/**
 * Keeps the access token in localStorage so the app (and the scanner) survive
 * reloads. Storage can be unavailable (private mode), so every call is guarded.
 */
export const tokenStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      window.localStorage.setItem(KEY, token);
    } catch {
      // Not persisted; the session lasts until the tab closes.
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // nothing to clear
    }
  },
};
