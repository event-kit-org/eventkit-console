import { Outlet } from 'react-router';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEventContext } from '@/features/events/event-context';

export function RequireRole({ roles }: { roles: string[] }) {
  const context = useEventContext();
  if (!roles.includes(context.role)) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription>This page is not available for your role.</AlertDescription>
      </Alert>
    );
  }
  return <Outlet context={context} />;
}
