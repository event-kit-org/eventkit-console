import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import type { Session } from '@/auth/session';
import type { AppConfig } from '@/lib/config';
import { createQueryClient } from '@/lib/query-client';

/** Providers shared by the app and the tests. */
export function Providers({
  config,
  queryClient,
  session,
  children,
}: {
  config: AppConfig;
  queryClient?: QueryClient;
  session?: Session;
  children: ReactNode;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <AuthProvider config={config} session={session}>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
