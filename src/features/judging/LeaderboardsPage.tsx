import { ListOrdered, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, RowsSkeleton } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { Leaderboard } from './Leaderboard';
import { PHASES, usePickedRound } from './rounds';
import { SavedLeaderboards } from './SavedLeaderboards';
import { Tracks } from './Tracks';

/** Where the scores land: each round's ranking, saved leaderboards across rounds, and tracks. */
export function LeaderboardsPage() {
  const { role } = useEventContext();
  const { rounds, all, selected, setPicked } = usePickedRound();
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Leaderboards"
        description="How teams rank in each round, and leaderboards that add up several rounds."
      >
        <Button variant="outline" size="sm" asChild>
          <Link to={`../judging${selected ? `?round=${selected.id}` : ''}`} relative="path">
            <Trophy aria-hidden /> Rounds and rubrics
          </Link>
        </Button>
      </PageHeader>
      <ErrorAlert error={rounds.error} />
      {rounds.isPending && <RowsSkeleton rows={2} />}
      {rounds.data && !selected && (
        <EmptyState icon={ListOrdered} title="No rounds yet">
          Add a round on the Judging page. Its leaderboard fills in as judges score.
        </EmptyState>
      )}
      {selected && (
        <>
          <Select value={selected.id} onValueChange={setPicked}>
            <SelectTrigger aria-label="Round" className="w-full min-w-0 sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {all.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="truncate">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {PHASES.find((p) => p.value === r.phase)?.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Leaderboard roundId={selected.id} />
        </>
      )}
      {selected && role === 'admin' && <Visibility />}
      {selected && role === 'admin' && (
        <>
          <SavedLeaderboards rounds={all} />
          <Tracks />
        </>
      )}
    </div>
  );
}

/** Whether participants see the leaderboards on the portal, or only admins and judges. */
function Visibility() {
  const api = useApi();
  const { event, path } = useEventContext();
  const toggle = useEventMutation(event.id, () =>
    unwrap(
      api.PATCH('/v1/events/{eventId}', {
        ...path,
        body: { leaderboardVisible: !event.leaderboardVisible },
      }),
    ),
  );
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <span>
          Leaderboard: {event.leaderboardVisible ? 'everyone can see it' : 'admins and judges only'}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(undefined)}
        >
          {event.leaderboardVisible ? 'Hide from everyone' : 'Show to everyone'}
        </Button>
      </div>
      <ErrorAlert error={toggle.error} />
    </div>
  );
}
