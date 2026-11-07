import type { LocalLogEntry } from '@eventkit/sdk';
import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useAuth } from '@/auth/context';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatTimeIST } from '@/lib/datetime';
import { reasonLabel } from './scan-messages';
import { SearchInput } from '@/components/SearchInput';
import { useListFilter } from '@/hooks/useListFilter';

interface Row {
  id: string;
  scannedAt: string;
  participantCode: string;
  name: string;
  result: 'accepted' | 'rejected';
  reason: LocalLogEntry['reason'];
  exitReason: string | null;
  reentry: boolean;
  offline: boolean;
  sync: LocalLogEntry['sync'];
  serverNote?: string;
}

const LIMIT = 25;

/**
 * Recent scans at the checkpoint: the server's (refreshed every 5 s while
 * online, so every volunteer's show) with this device's unsent offline scans on top.
 */
const rowText = (r: { name: string; participantCode: string }) => [r.name, r.participantCode];

export function ScanLog({
  eventId,
  checkpointId,
  online,
  local,
}: {
  eventId: string;
  checkpointId: string;
  online: boolean;
  local: LocalLogEntry[];
}) {
  const { api } = useAuth();
  const scans = useQuery({
    queryKey: ['event', eventId, 'scans', checkpointId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/scans', {
          params: { path: { eventId }, query: { checkpointId, limit: LIMIT } },
        }),
      ),
    enabled: online && !!checkpointId,
    refetchInterval: 5000,
  });

  const mine = new Map(local.map((e) => [e.id, e]));
  const server: Row[] = (scans.data ?? []).map((s) => {
    const m = mine.get(s.id);
    return {
      id: s.id,
      scannedAt: s.scannedAt,
      participantCode: s.participant.participantCode,
      name: s.participant.name,
      result: s.result,
      reason: s.reason,
      exitReason: s.exitReason,
      reentry: m?.reentry ?? false,
      offline: s.offline,
      sync: m?.sync === 'conflict' ? 'conflict' : 'synced',
      ...(m?.serverNote ? { serverNote: m.serverNote } : {}),
    };
  });
  const seen = new Set(server.map((r) => r.id));
  const unsent: Row[] = local
    .filter((e) => !seen.has(e.id))
    .map((e) => ({ ...e, offline: e.sync !== 'synced' }));
  const all = [...unsent, ...server]
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
    .slice(0, Math.max(LIMIT, unsent.length));
  const search = useListFilter(all, rowText);
  const rows = search.filtered;

  return (
    <Card size="sm">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle as="h2">Scan log</CardTitle>
        {all.length > 0 && (
          <SearchInput
            label="Search the scan log"
            placeholder="Name or ID"
            value={search.query}
            onChange={search.setQuery}
          />
        )}
      </CardHeader>
      <CardContent className="px-0">
        {scans.isPending && online && rows.length === 0 ? (
          <div className="grid gap-2 px-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            {search.active ? 'No scan matches.' : 'No scans here yet.'}
          </p>
        ) : (
          <Table aria-label="Scan log">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Time</TableHead>
                <TableHead className="hidden sm:table-cell">Participant ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 tabular-nums">{formatTimeIST(r.scannedAt)}</TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {r.participantCode}
                  </TableCell>
                  <TableCell className="max-w-40 whitespace-normal wrap-anywhere">
                    {r.name}
                    <div className="font-mono text-xs text-muted-foreground sm:hidden">
                      {r.participantCode}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4">
                    <ScanStatus row={r} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ScanStatus({ row }: { row: Row }) {
  const label =
    row.result === 'accepted'
      ? row.exitReason
        ? `Out: ${row.exitReason}`
        : row.reentry
          ? 'Back in'
          : 'Accepted'
      : reasonLabel(row.reason);
  return (
    <div className="flex flex-wrap gap-1">
      <Badge
        variant={row.result === 'accepted' ? 'secondary' : 'destructive'}
        className={
          row.result === 'accepted'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : undefined
        }
      >
        {label}
      </Badge>
      {row.sync === 'pending' && <Badge variant="outline">Offline · not sent</Badge>}
      {row.sync === 'conflict' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" tabIndex={0}>
              Conflict
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Server: {row.serverNote ?? 'decided differently'}</TooltipContent>
        </Tooltip>
      )}
      {row.sync === 'synced' && row.offline && <Badge variant="outline">Offline</Badge>}
    </div>
  );
}
