import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { CardsSkeleton } from '@/components/PageState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { formatDateIST } from '@/lib/datetime';
import { roleLabel } from './roles';

export function EventsPage() {
  const api = useApi();
  const events = useQuery({ queryKey: ['events'], queryFn: () => unwrap(api.GET('/v1/events')) });

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
          <p className="text-sm text-muted-foreground">
            Every event you run, with its registrations, check-in and portal.
          </p>
        </div>
        <Button asChild>
          <Link to="/events/new">
            <Plus aria-hidden /> Create an event
          </Link>
        </Button>
      </div>
      {events.isPending && <CardsSkeleton count={3} className="sm:grid-cols-2 lg:grid-cols-3" />}
      {events.isError && (
        <Alert variant="destructive">
          <AlertDescription>Could not load your events. {events.error.message}</AlertDescription>
        </Alert>
      )}
      {events.data?.length === 0 && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarPlus />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>
              Create an event, set its portal URL, then make an API key and links for your portal.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/events/new">Create an event</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.data?.map(({ event, role }) => (
          <li key={event.id}>
            <Link
              to={`/events/${event.id}`}
              className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                  <CardDescription>{event.hostedBy}</CardDescription>
                  <CardAction>
                    <Badge variant="secondary">{roleLabel[role]}</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-1.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4" aria-hidden /> {event.venue}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-4" aria-hidden />
                    {formatDateIST(event.startAt)} – {formatDateIST(event.endAt)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
