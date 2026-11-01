import { useQuery } from '@tanstack/react-query';
import { DoorOpen, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
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

/** People at the event: for now, who left through an exit and hasn't scanned back in. */
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

  if (!features.scanning) {
    return (
      <Alert>
        <Info aria-hidden />
        <AlertDescription>Scanning is switched off for this event.</AlertDescription>
      </Alert>
    );
  }

  const people = outside.data ?? [];
  return (
    <div className="grid gap-4">
      <PageHeader title="People" description="Who is at the event right now." />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Outside now
            {outside.data && (
              <Badge variant={people.length > 0 ? 'destructive' : 'secondary'}>
                {people.length} outside
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Scanned out at an exit and not back in yet, longest out first. Refreshes every 15
            seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ErrorAlert error={outside.error} />
          {outside.isPending && <TableSkeleton cols={6} />}
          {outside.data && people.length === 0 && (
            <EmptyState icon={DoorOpen} title="Everyone who left has come back." />
          )}
          {people.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table aria-label="People outside">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Participant ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((p) => (
                    <TableRow key={p.registrationId}>
                      <TableCell className="font-mono text-xs">{p.participantCode}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.teamName}</TableCell>
                      <TableCell>
                        {p.phone ? (
                          <a className="hover:underline" href={`tel:${p.phone.replace(/\s/g, '')}`}>
                            {p.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
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
