import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">#</th>
                <th>Team</th>
                <th className="text-right">Total</th>
                <th className="text-right">Judges</th>
              </tr>
            </thead>
            <tbody>
              {board.data.entries.map((e) => (
                <tr key={e.team.id} className="border-t">
                  <td className="py-1">{e.rank}</td>
                  <td>{e.team.name}</td>
                  <td className="text-right tabular-nums">
                    {e.total.toFixed(2)} / {e.maxTotal}
                  </td>
                  <td className="text-right tabular-nums">{e.judges}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
