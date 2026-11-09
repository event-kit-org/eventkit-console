import {
  ArrowRight,
  CalendarCheck,
  ChartLine,
  CircleAlert,
  HandCoins,
  Info,
  Receipt,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TilesSkeleton } from '@/components/PageState';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventContext } from '@/features/events/event-context';
import { formatIST, toISTInput } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { AttendanceCard, RegistrationsCard } from './insights/OverviewCharts';
import { useRegistrationsByDay } from './insights/queries';
import { useProofs, useTeams } from './queries';

type Tile = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  to: string;
  foot?: string;
  share?: number;
};

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
  // RSVP: people who said they're coming (attending or already checked in).
  const attending = registered.reduce((n, t) => n + t.attendingCount, 0);
  const rsvpShare = confirmedPeople > 0 ? attending / confirmedPeople : 0;
  // Attendance only means something from the event's first day (IST).
  const [openedAt] = useState(Date.now);
  const eventDayStarted =
    openedAt >= new Date(`${toISTInput(event.startAt).slice(0, 10)}T00:00:00+05:30`).getTime();
  // Today's new teams, from the same numbers as the registrations chart (shared cache).
  const byDay = useRegistrationsByDay();
  const todayIST = toISTInput(new Date(openedAt).toISOString()).slice(0, 10);
  const newToday = byDay.data?.find((d) => d.date === todayIST)?.teams ?? 0;

  const paidTeams = registered.filter((t) => t.paidAmount !== null);
  const collected = paidTeams.reduce((n, t) => n + (t.paidAmount ?? 0), 0);
  const paymentTiles: Tile[] =
    paidTeams.length > 0
      ? [
          {
            label: 'Collected',
            value: formatMoney(collected, event.currency),
            icon: HandCoins,
            to: 'teams',
            foot: `from ${paidTeams.length} approved team${paidTeams.length === 1 ? '' : 's'}`,
          },
        ]
      : [];

  const tiles: Tile[] = [
    {
      label: 'Teams registered',
      value: registered.length,
      icon: UsersRound,
      to: 'teams',
      foot: byDay.data ? (newToday > 0 ? `+${newToday} today` : 'None new today') : undefined,
    },
    {
      label: 'Confirmed people',
      value: `${confirmedPeople} / ${event.maxParticipants}`,
      icon: Users,
      to: 'teams',
      foot: `${Math.round(full * 100)}% of capacity`,
      share: full,
    },
    {
      label: event.rsvpEnabled ? "Attending (RSVP'd)" : 'Attending',
      value: `${attending} / ${confirmedPeople}`,
      icon: CalendarCheck,
      to: 'teams',
      foot: event.rsvpEnabled
        ? `${Math.round(rsvpShare * 100)}% of confirmed people have RSVP'd`
        : 'Confirmed people count as attending',
      share: rsvpShare,
    },
    {
      label: 'Receipts to review',
      value: pending.data?.length ?? 0,
      icon: Receipt,
      to: 'payments',
    },
    ...paymentTiles,
  ];

  return (
    <div className="grid gap-4">
      {!features.registration && (
        <Alert>
          <Info aria-hidden />
          <AlertDescription>
            <p>
              Registration is switched off, so participants cannot register. Turn it on in{' '}
              <Link to="features">Features</Link>.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(({ label, value, icon: Icon, to, foot, share }) => (
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
                  <CardTitle as="p" className="text-2xl font-semibold tabular-nums">
                    {value}
                  </CardTitle>
                </CardHeader>
                {foot && (
                  <CardFooter className="text-xs text-muted-foreground">
                    <div className="grid w-full gap-1.5">
                      {share !== undefined && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, share * 100)}%` }}
                          />
                        </div>
                      )}
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
      <div className="grid gap-4 lg:grid-cols-2">
        {features.registration && <RegistrationsCard />}
        {features.scanning && eventDayStarted && <AttendanceCard />}
      </div>
      {/* Everything else charted lives on its own page. */}
      <Button variant="outline" className="w-fit" asChild>
        <Link to="statistics">
          <ChartLine aria-hidden /> More charts in Event statistics <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
