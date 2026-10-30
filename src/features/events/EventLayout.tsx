import { useQuery } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { Outlet, useParams } from 'react-router';
import { ApiError, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/PageState';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateIST } from '@/lib/datetime';
import type { EventContextValue } from './event-context';
import { CONSOLE_ROLES, roleLabel } from './roles';

/** Loads the event and the caller's role, then shows the open section. */
export function EventLayout() {
  const { eventId = '' } = useParams();
  const api = useApi();
  const path = { params: { path: { eventId } } };

  const detail = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}', path)),
    retry: false,
  });
  const features = useQuery({
    queryKey: ['event', eventId, 'features'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/features', path)),
    enabled: detail.isSuccess,
  });

  if (detail.isPending) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
    );
  }
  if (detail.isError) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <Problem>
        {missing ? 'This event does not exist or you are not part of it.' : detail.error.message}
      </Problem>
    );
  }

  const { event, role, isOwner } = detail.data;
  if (!CONSOLE_ROLES.includes(role)) {
    return (
      <Problem>
        Volunteers and judges sign in on the event's own portal, not in the console.
      </Problem>
    );
  }
  const on = Object.fromEntries((features.data ?? []).map((f) => [f.feature, f.enabled]));
  const context: EventContextValue = {
    event,
    role,
    isOwner,
    features: { mailing: !!on.mailing, registration: !!on.registration, scanning: !!on.scanning },
    path,
  };

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
          <Badge variant="secondary">
            {isOwner ? 'Owner' : role === 'admin' ? 'Co-admin' : roleLabel[role]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {event.hostedBy} · {event.venue} · {formatDateIST(event.startAt)} –{' '}
          {formatDateIST(event.endAt)}
        </p>
      </header>
      <div className="min-w-0">
        {features.isSuccess ? <Outlet context={context} /> : !features.isError && <Loading />}
      </div>
    </div>
  );
}

function Problem({ children }: { children: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
