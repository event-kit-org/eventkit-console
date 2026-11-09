import { useQuery } from '@tanstack/react-query';
import { ListOrdered, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, RowsSkeleton } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import { useEventContext } from '@/features/events/event-context';
import { CriteriaEditor } from './CriteriaEditor';
import { RoundsStrip } from './RoundsStrip';
import { usePickedRound } from './rounds';

/**
 * The owner edits rounds and each round's rubric here. Judges score on the
 * event's portal; the results are on the Leaderboards page.
 */
export function JudgingPage() {
  const api = useApi();
  const { event, path } = useEventContext();
  const { rounds, all, selected, setPicked } = usePickedRound();
  const roundId = selected?.id;
  const criteria = useQuery({
    queryKey: ['event', event.id, 'criteria', roundId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/criteria', {
          params: { path: path.params.path, query: { roundId } },
        }),
      ),
    enabled: Boolean(roundId),
  });
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Judging"
        description="Judges score teams on the event's portal against each round's rubric."
      >
        {selected && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`../leaderboards?round=${selected.id}`} relative="path">
              <ListOrdered aria-hidden /> See leaderboard
            </Link>
          </Button>
        )}
      </PageHeader>
      <ErrorAlert error={rounds.error} />
      {rounds.isPending && <RowsSkeleton rows={2} />}
      {rounds.data && <RoundsStrip rounds={all} selected={selected} onSelect={setPicked} />}
      {rounds.data && !selected && (
        <EmptyState icon={Trophy} title="No rounds yet">
          Add a round, then build its rubric.
        </EmptyState>
      )}
      {selected && (
        <CriteriaEditor
          round={selected}
          rounds={all}
          criteria={criteria.data ?? []}
          loading={criteria.isPending}
        />
      )}
    </div>
  );
}
