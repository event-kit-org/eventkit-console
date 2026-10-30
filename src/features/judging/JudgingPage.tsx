import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, RowsSkeleton } from '@/components/PageState';
import { useEventContext } from '@/features/events/event-context';
import { CriteriaEditor } from './CriteriaEditor';
import { Leaderboard } from './Leaderboard';
import { RoundsStrip } from './RoundsStrip';
import { useRounds } from './rounds';

/**
 * The owner edits rounds, each round's rubric and the leaderboard's visibility
 * here. Judges score on the event's portal.
 */
export function JudgingPage() {
  const api = useApi();
  const { event, path } = useEventContext();
  const rounds = useRounds();
  const [picked, setPicked] = useState<string | null>(null);
  const all = rounds.data ?? [];
  const selected = all.find((r) => r.id === picked) ?? all[0];
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
      />
      <ErrorAlert error={rounds.error} />
      {rounds.isPending && <RowsSkeleton rows={2} />}
      {rounds.data && <RoundsStrip rounds={all} selected={selected} onSelect={setPicked} />}
      {rounds.data && !selected && (
        <EmptyState icon={Trophy} title="No rounds yet">
          Add a round, then build its rubric.
        </EmptyState>
      )}
      {selected && (
        <>
          <CriteriaEditor
            round={selected}
            rounds={all}
            criteria={criteria.data ?? []}
            loading={criteria.isPending}
          />
          <Leaderboard roundId={selected.id} />
        </>
      )}
    </div>
  );
}
