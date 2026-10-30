import { CircleAlert, Info, Receipt, Users, UsersRound } from 'lucide-react';
import { Link } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TilesSkeleton } from '@/components/PageState';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
  const full = event.maxParticipants > 0 ? confirmedPeople / event.maxParticipants : 0;

  const tiles = [
    { label: 'Teams registered', value: registered.length, icon: UsersRound, to: 'teams' },
    {
      label: 'Confirmed people',
      value: `${confirmedPeople} / ${event.maxParticipants}`,
      icon: Users,
      to: 'teams',
      foot: `${Math.round(full * 100)}% of capacity`,
    },
    {
      label: 'Receipts to review',
      value: pending.data?.length ?? 0,
      icon: Receipt,
      to: 'payments',
    },
  ];

  return (
    <div className="grid gap-4">
      {!features.registration && (
        <Alert>
          <Info aria-hidden />
          <AlertDescription>
            <p>
              Registration is switched off, so participants cannot register. Turn it on in{' '}
              <Link to="settings">Settings</Link>.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {flagged.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            {flagged.length} registered team{flagged.length > 1 ? 's are' : ' is'} below the minimum
            size after cancellations: {flagged.map((t) => t.name).join(', ')}.
          </AlertDescription>
        </Alert>
      )}
      {teams.isPending || pending.isPending ? (
        <TilesSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {tiles.map(({ label, value, icon: Icon, to, foot }) => (
            <Link
              key={label}
              to={to}
              className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardDescription className="flex items-center justify-between">
                    {label} <Icon className="size-4" aria-hidden />
                  </CardDescription>
                  <CardTitle as="h3" className="text-2xl font-semibold tabular-nums">
                    {value}
                  </CardTitle>
                </CardHeader>
                {foot && (
                  <CardFooter className="text-xs text-muted-foreground">
                    <div className="grid w-full gap-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, full * 100)}%` }}
                        />
                      </div>
                      {foot}
                    </div>
                  </CardFooter>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Registration closes {formatIST(event.registrationDeadline)}. The event starts{' '}
        {formatIST(event.startAt)}.
      </p>
    </div>
  );
}
