import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEventContext } from '@/features/events/event-context';

/** Team totals, ranked. A team's total is the average across judges of each judge's total. */
export function Leaderboard() {
  const api = useApi();
  const { event, path } = useEventContext();
  const board = useQuery({
    queryKey: ['event', event.id, 'leaderboard'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/leaderboard', path)),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          {board.data?.visibleToEveryone
            ? 'Everyone in the event can see this.'
            : 'Only admins and judges can see this.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ErrorAlert error={board.error} />
        {board.data?.entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No scores yet.</p>
        )}
        {board.data && board.data.entries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Judges</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {board.data.entries.map((e) => (
                <TableRow key={e.team.id}>
                  <TableCell className="font-medium tabular-nums">{e.rank}</TableCell>
                  <TableCell>{e.team.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.total.toFixed(2)} / {e.maxTotal}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{e.judges}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
