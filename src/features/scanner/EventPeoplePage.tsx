import { useQuery } from '@tanstack/react-query';
import { DoorOpen, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEventContext } from '@/features/events/event-context';
import { useListFilter } from '@/hooks/useListFilter';
import { formatIST, timeAgo } from '@/lib/datetime';

/** Re-renders every 30 s so "12 min ago" keeps counting. */
function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** People at the event: for now, who went out through an entry & exit checkpoint and hasn't scanned back in. */
type Outside = Schemas['OutsidePerson'];
const personText = (p: Outside) => [p.name, p.participantCode, p.teamName, p.phone, p.reason];

export function EventPeoplePage() {
  const api = useApi();
  const { event, path, features } = useEventContext();
  const now = useNow();
  const outside = useQuery({
    queryKey: ['event', event.id, 'outside'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/scans/outside', path)),
    enabled: features.scanning,
    refetchInterval: 15_000,
  });
  const search = useListFilter(outside.data ?? [], personText);

  if (!features.scanning) {
    return (
      <Alert>
        <Info aria-hidden />
        <AlertDescription>Scanning is switched off for this event.</AlertDescription>
      </Alert>
    );
  }

  const all = outside.data ?? [];
  const people = search.filtered;
  return (
    <div className="grid gap-4">
      <PageHeader title="People" description="Who is at the event right now.">
        {all.length > 0 && (
          <SearchInput
            label="Search people outside"
            placeholder="Name, team, ID or phone"
            value={search.query}
            onChange={search.setQuery}
          />
        )}
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Outside now
            {outside.data && (
              <Badge variant={all.length > 0 ? 'destructive' : 'secondary'}>
                {all.length} outside
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Went out through an entry & exit checkpoint and not back in yet, longest out first.
            Refreshes every 15 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ErrorAlert error={outside.error} />
          {outside.isPending && <TableSkeleton cols={6} />}
          {outside.data && all.length === 0 && (
            <EmptyState icon={DoorOpen} title="Everyone who left has come back." />
          )}
          {search.active && people.length === 0 && (
            <p className="text-sm text-muted-foreground">Nobody outside matches.</p>
          )}
          {people.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table aria-label="People outside">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="hidden md:table-cell">Participant ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Team</TableHead>
                    <TableHead className="hidden sm:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Reason</TableHead>
                    <TableHead>Left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((p) => (
                    <TableRow key={p.registrationId}>
                      <TableCell className="hidden font-mono text-xs md:table-cell">
                        {p.participantCode}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium wrap-anywhere">{p.name}</div>
                        {/* What the hidden columns hold, on small screens. */}
                        <div className="text-xs wrap-anywhere text-muted-foreground md:hidden">
                          <span className="font-mono">{p.participantCode}</span> · {p.teamName}
                        </div>
                        {p.phone && (
                          <a
                            className="text-xs hover:underline sm:hidden"
                            href={`tel:${p.phone.replace(/\s/g, '')}`}
                          >
                            {p.phone}
                          </a>
                        )}
                        {p.reason && (
                          <div className="text-xs wrap-anywhere text-muted-foreground lg:hidden">
                            {p.reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden whitespace-normal wrap-anywhere md:table-cell">
                        {p.teamName}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {p.phone ? (
                          <a className="hover:underline" href={`tel:${p.phone.replace(/\s/g, '')}`}>
                            {p.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden whitespace-normal lg:table-cell">
                        {p.reason ?? <span className="text-muted-foreground">—</span>}
                        {p.checkpointName && (
                          <div className="text-xs text-muted-foreground">
                            via {p.checkpointName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className="whitespace-nowrap tabular-nums">
                              {timeAgo(p.outsideSince, now)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{formatIST(p.outsideSince)}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
