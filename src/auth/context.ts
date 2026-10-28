import { createContext, useContext } from 'react';
import type { ApiClient, Schemas } from '@/api/client';
import type { AppConfig } from '@/lib/config';

export type User = Schemas['User'];

export interface AuthState {
  api: ApiClient;
  config: AppConfig;
  user: User | null;
  status: 'anonymous' | 'loading' | 'authenticated';
  login(email: string, password: string): Promise<void>;
  signup(input: { email: string; name: string; password: string; phone?: string }): Promise<void>;
  logout(): void;
  /** Signs in with a session the API returned (after changing or resetting a password). */
  start(session: Schemas['Session']): void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

/** The typed API client, already carrying the token and API key. */
export function useApi(): ApiClient {
  return useAuth().api;
}
