import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from './context';

/** Gate for logged-in pages. Sends anonymous visitors to /login and back afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'anonymous') {
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
