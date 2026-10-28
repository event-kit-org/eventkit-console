import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useMemo, useState, useSyncExternalStore } from 'react';
import { ApiError, createApiClient, type Schemas, unwrap } from '@/api/client';
import type { AppConfig } from '@/lib/config';
import { AuthContext, type AuthState } from './context';
import { Session } from './session';

export function AuthProvider({
  config,
  session: given,
  children,
}: {
  config: AppConfig;
  session?: Session;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [session] = useState(() => given ?? new Session());
  const token = useSyncExternalStore(session.subscribe, session.get);
  const api = useMemo(() => createApiClient(config, session.get), [config, session]);

  const me = useQuery({
    queryKey: ['me', token],
    queryFn: async () => {
      try {
        return await unwrap(api.GET('/v1/auth/me'));
      } catch (e) {
        // A token the API no longer accepts (expired, or the account is gone) logs out.
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) session.set(null);
        throw e;
      }
    },
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  });

  const value = useMemo<AuthState>(() => {
    const start = (s: Schemas['Session']) => {
      queryClient.setQueryData(['me', s.token.accessToken], s.user);
      session.set(s.token.accessToken);
    };
    return {
      api,
      config,
      user: me.data ?? null,
      status: token === null ? 'anonymous' : me.data ? 'authenticated' : 'loading',
      async login(email, password) {
        start(await unwrap(api.POST('/v1/auth/login', { body: { email, password } })));
      },
      async signup(input) {
        start(await unwrap(api.POST('/v1/auth/signup', { body: input })));
      },
      logout() {
        session.set(null);
        queryClient.clear();
      },
      start,
    };
  }, [api, config, me.data, token, session, queryClient]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
