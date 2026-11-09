import { useMutation, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { TableSkeleton } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { download, slug } from '@/features/admin/teams-csv';
import { useEventContext } from '@/features/events/event-context';
import { judgesCsv, leaderboardCsv } from './judging-csv';
import { ScoreBreakdownSheet } from './ScoreBreakdown';

/**
 * Team totals, ranked. A team's total is the average across judges of each
 * judge's total; normalised, lenient and harsh judges are evened out. Admins
 * open a team to see who scored what, and download the scores.
 */
export function Leaderboard({ roundId }: { roundId?: string }) {
  const api = useApi();
  const { event, path, role } = useEventContext();
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  const [normalise, setNormalise] = useState(false);
  const board = useQuery({
    // Unnormalised, the same key (and cache) as the elimination dialog's.
    queryKey: ['event', event.id, 'leaderboard', roundId, ...(normalise ? ['normalised'] : [])],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/leaderboard', {
          params: {
            path: path.params.path,
            query: { roundId, ...(normalise ? { normalise: 'true' as const } : {}) },
          },
        }),
      ),
  });
  // The same query (and cache) as the rubric editor.
  const criteria = useQuery({
    queryKey: ['event', event.id, 'criteria', roundId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/criteria', {
          params: { path: { eventId: event.id }, query: { roundId } },
        }),
      ),
  });
  const name = `${slug(event.name)}-${slug(board.data?.round?.name ?? 'round')}`;
  const exportBoard = () =>
    board.data &&
    download(`${name}-leaderboard.csv`, leaderboardCsv(board.data, criteria.data ?? []));
  // One breakdown per team: fine at hackathon sizes.
  const exportJudges = useMutation({
    mutationFn: async () => {
      const breakdowns = [];
      for (const e of board.data?.entries ?? []) {
        breakdowns.push(
          await unwrap(
            api.GET('/v1/events/{eventId}/judging/teams/{teamId}/breakdown', {
              params: { path: { eventId: event.id, teamId: e.team.id }, query: { roundId } },
            }),
          ),
        );
      }
      download(`${name}-judges.csv`, judgesCsv(breakdowns, criteria.data ?? []));
    },
  });
  const scored = (board.data?.entries.length ?? 0) > 0;
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1.5">
          <CardTitle>Leaderboard{board.data?.round ? `: ${board.data.round.name}` : ''}</CardTitle>
          <CardDescription>
            {board.data?.visibleToEveryone
              ? 'Everyone in the event can see this.'
              : 'Only admins and judges can see this.'}
          </CardDescription>
        </div>
        {role === 'admin' && scored && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exportJudges.isPending}>
                <Download aria-hidden /> Download CSV
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={exportBoard}>Leaderboard</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportJudges.mutate()}>
                Each judge's scores and comments
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-start gap-3">
          <Switch
            id="normalise"
            checked={normalise}
            onCheckedChange={setNormalise}
            className="mt-0.5"
          />
          <div className="grid gap-1">
            <Label htmlFor="normalise">Even out lenient and harsh judges</Label>
            <p className="text-sm text-muted-foreground">
              Ranks by each judge's scores compared with their own average, so a team isn't held
              back by a strict panel. Judges who scored fewer than 3 teams count as they are.
            </p>
          </div>
        </div>
        <ErrorAlert error={board.error ?? exportJudges.error} />
        {board.isPending && <TableSkeleton rows={3} />}
        {board.data?.entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No scores yet.</p>
        )}
        {board.data && board.data.entries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Judges</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {board.data.entries.map((e) => (
                <TableRow key={e.team.id}>
                  <TableCell className="font-medium tabular-nums">{e.rank}</TableCell>
                  <TableCell className="whitespace-normal">
                    {role === 'admin' ? (
                      <Button
                        variant="link"
                        className="h-auto p-0 text-left wrap-anywhere whitespace-normal"
                        onClick={() => setOpen(e.team)}
                      >
                        {e.team.name}
                      </Button>
                    ) : (
                      <span className="wrap-anywhere">{e.team.name}</span>
                    )}
                    <div className="text-xs text-muted-foreground sm:hidden">
                      {e.judges} {e.judges === 1 ? 'judge' : 'judges'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(normalise ? e.normalisedTotal : e.total).toFixed(2)} / {e.maxTotal}
                    {normalise && (
                      <div className="text-xs text-muted-foreground">raw {e.total.toFixed(2)}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {e.judges}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ScoreBreakdownSheet team={open} roundId={roundId} onClose={() => setOpen(null)} />
      </CardContent>
    </Card>
  );
}
