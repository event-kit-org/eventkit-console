import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useParams } from 'react-router';
import { ApiError, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EventContextValue } from './event-context';
import { roleLabel } from './roles';

/** The event's sections, grouped as the sidebar shows them. */
const SECTIONS: { group: string | null; links: [string, string][] }[] = [
  { group: null, links: [['', 'Overview']] },
  {
    group: 'Registration',
    links: [
      ['teams', 'Teams'],
      ['payments', 'Payments'],
      ['form', 'Registration form'],
      ['links', 'Links'],
    ],
  },
  {
    group: 'Event day',
    links: [
      ['checkpoints', 'Checkpoints'],
      ['scan', 'Scanner'],
      ['polls', 'Polls'],
      ['notifications', 'Notifications'],
      ['judging', 'Judging'],
    ],
  },
  {
    group: 'Setup',
    links: [
      ['people', 'Staff'],
      ['settings', 'Portal & settings'],
    ],
  },
];

/** Loads the event and the caller's role, then shows the role's tabs. */
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

  if (detail.isPending) return <p className="text-muted-foreground">Loading…</p>;
  if (detail.isError) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <Alert variant="destructive">
        {missing ? 'This event does not exist or you are not part of it.' : detail.error.message}
      </Alert>
    );
  }

  const { event, role } = detail.data;
  if (role !== 'admin') {
    return (
      <Alert variant="destructive">
        Volunteers and judges sign in on the event's own portal, not in the console.
      </Alert>
    );
  }
  const on = Object.fromEntries((features.data ?? []).map((f) => [f.feature, f.enabled]));
  const context: EventContextValue = {
    event,
    role,
    features: { mailing: !!on.mailing, registration: !!on.registration, scanning: !!on.scanning },
    path,
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
        <Badge>{roleLabel[role]}</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        {/* A row that scrolls on phones; a sticky sidebar from md up. */}
        <nav
          aria-label="Event sections"
          className="-mx-1 flex gap-1 overflow-x-auto border-b pb-px md:sticky md:top-4 md:mx-0 md:flex-col md:gap-4 md:self-start md:overflow-visible md:border-b-0 md:pb-0"
        >
          {SECTIONS.map(({ group, links }) => (
            <div key={group ?? 'top'} className="flex gap-1 md:flex-col md:gap-0.5">
              {group && (
                <div className="hidden px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:block">
                  {group}
                </div>
              )}
              {links.map(([to, label]) => (
                <NavLink
                  key={label}
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'whitespace-nowrap px-3 py-2 text-sm md:rounded-md md:py-1.5',
                      isActive
                        ? 'border-b-2 border-foreground font-medium md:border-b-0 md:bg-background md:shadow-sm'
                        : 'text-muted-foreground hover:text-foreground md:hover:bg-background/60',
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0">{features.isSuccess && <Outlet context={context} />}</div>
      </div>
    </section>
  );
}
