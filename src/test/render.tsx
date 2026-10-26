import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Providers } from '@/App';
import { Session } from '@/auth/session';
import { routes } from '@/routes';
import { TEST_CONFIG } from './server';

/** Renders the whole app at `path`, optionally logged in with `token`. */
export function renderApp(path: string, { token = null }: { token?: string | null } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const session = new Session(token);
  // No retries, so error states show immediately.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <Providers config={TEST_CONFIG} session={session} queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...result, router, session };
}
