import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/ui/spinner';
import { LandingPage } from '@/features/landing/LandingPage';
import { useAuth } from './context';

/**
 * Gate for logged-in pages. Anonymous visitors get the landing page at / and are
 * sent to /login (and back afterwards) from everywhere else.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'anonymous') {
    if (location.pathname === '/') return <LandingPage />;
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  return <Outlet />;
}
