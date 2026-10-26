import { Link } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventContext } from '@/features/events/event-context';
import { formatIST } from '@/lib/datetime';
import { useProofs, useTeams } from './queries';

const PLACE_HOLDING = ['confirmed', 'attending', 'checked_in'];

export function AdminOverview() {
  const { event, features } = useEventContext();
  const teams = useTeams();
  const pending = useProofs('pending');

  const list = teams.data ?? [];
  const registered = list.filter((t) => t.status !== 'cancelled');
  const confirmedPeople = registered
    .filter((t) => PLACE_HOLDING.includes(t.status))
    .reduce((n, t) => n + t.memberCount, 0);
  const flagged = list.filter((t) => t.belowMinimum);

  const tiles = [
    ['Teams registered', registered.length],
    ['Confirmed people', `${confirmedPeople} / ${event.maxParticipants}`],
    ['Receipts to review', pending.data?.length ?? 0],
  ] as const;

  return (
    <div className="grid gap-4">
      {!features.registration && (
        <Alert>
          Registration is switched off, so participants cannot register. Turn it on in{' '}
          <Link className="underline" to="settings">
            Settings
          </Link>
          .
        </Alert>
      )}
      {flagged.length > 0 && (
        <Alert variant="destructive">
          {flagged.length} registered team{flagged.length > 1 ? 's are' : ' is'} below the minimum
          size after cancellations: {flagged.map((t) => t.name).join(', ')}.
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Registration closes {formatIST(event.registrationDeadline)}. The event starts{' '}
        {formatIST(event.startAt)}.
      </p>
    </div>
  );
}
