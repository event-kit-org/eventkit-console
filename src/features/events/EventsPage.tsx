import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateIST } from '@/lib/datetime';
import { roleLabel } from './roles';

export function EventsPage() {
  const api = useApi();
  const events = useQuery({ queryKey: ['events'], queryFn: () => unwrap(api.GET('/v1/events')) });

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
        <Button asChild>
          <Link to="/events/new">Create an event</Link>
        </Button>
      </div>
      {events.isPending && <p className="text-muted-foreground">Loading…</p>}
      {events.isError && (
        <Alert variant="destructive">Could not load your events. {events.error.message}</Alert>
      )}
      {events.data?.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>
              Create an event, set its portal URL, then make an API key and links for your portal.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {events.data?.map(({ event, role }) => (
          <li key={event.id}>
            <Link
              to={`/events/${event.id}`}
              className="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{event.name}</CardTitle>
                    <Badge>{roleLabel[role]}</Badge>
                  </div>
                  <CardDescription>
                    {event.hostedBy} · {event.venue}
                  </CardDescription>
                  <CardDescription>
                    {formatDateIST(event.startAt)} – {formatDateIST(event.endAt)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
