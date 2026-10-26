import { useQuery } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useParams } from 'react-router';
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
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
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
        {/* Phones: a menu button that opens the sections. From md up: a sticky sidebar. */}
        <nav
          aria-label="Event sections"
          className="md:sticky md:top-4 md:self-start"
          onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}
        >
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="event-sections"
            aria-label={`Sections: ${currentLabel(pathname, eventId)}`}
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium md:hidden"
          >
            {menuOpen ? (
              <X className="size-4" aria-hidden />
            ) : (
              <Menu className="size-4" aria-hidden />
            )}
            {currentLabel(pathname, eventId)}
          </button>
          <div
            id="event-sections"
            className={cn(
              'mt-2 flex-col gap-4 rounded-md border bg-background p-2 md:mt-0 md:flex md:border-0 md:bg-transparent md:p-0',
              menuOpen ? 'flex' : 'hidden',
            )}
          >
            {SECTIONS.map(({ group, links }) => (
              <div key={group ?? 'top'} className="flex flex-col gap-0.5">
                {group && (
                  <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                )}
                {links.map(([to, label]) => (
                  <NavLink
                    key={label}
                    to={to}
                    end
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'rounded-md px-3 py-2 text-sm md:py-1.5',
                        isActive
                          ? 'bg-muted font-medium md:bg-background md:shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hover:bg-background/60',
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0">{features.isSuccess && <Outlet context={context} />}</div>
      </div>
    </section>
  );
}

/** The open section's name, for the phone menu button. */
function currentLabel(pathname: string, eventId: string): string {
  const rest = pathname.split(`/events/${eventId}`)[1] ?? '';
  const first = rest.split('/').filter(Boolean)[0] ?? '';
  const links = SECTIONS.flatMap((s) => s.links);
  return links.find(([to]) => to === first)?.[1] ?? 'Overview';
}
