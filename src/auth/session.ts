import { tokenStore } from './token-store';

/**
 * Holds the current access token outside React so the API client can read it at
 * request time; components subscribe through useSyncExternalStore.
 */
export class Session {
  private token: string | null;
  private readonly listeners = new Set<() => void>();

  constructor(initial: string | null = tokenStore.get()) {
    this.token = initial;
  }

  get = (): string | null => this.token;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(token: string | null): void {
    if (token === this.token) return;
    this.token = token;
    if (token) tokenStore.set(token);
    else tokenStore.clear();
    this.listeners.forEach((l) => l());
  }
}
