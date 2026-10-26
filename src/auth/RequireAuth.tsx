import { Navigate, Outlet, useLocation } from 'react-router';
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
    return <p className="p-8 text-center text-muted-foreground">Loading…</p>;
  }
  return <Outlet />;
}
