import { Outlet } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { useEventContext } from '@/features/events/event-context';

export function RequireRole({ roles }: { roles: string[] }) {
  const context = useEventContext();
  if (!roles.includes(context.role)) {
    return <Alert variant="destructive">This page is not available for your role.</Alert>;
  }
  return <Outlet context={context} />;
}
