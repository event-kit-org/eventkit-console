import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import type { Session } from '@/auth/session';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AppConfig } from '@/lib/config';
import { createQueryClient } from '@/lib/query-client';
import { ThemeProvider } from '@/components/ThemeProvider';

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
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <AuthProvider config={config} session={session}>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
