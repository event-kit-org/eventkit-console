import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { useEventContext } from '@/features/events/event-context';
import { CriteriaEditor } from './CriteriaEditor';
import { Leaderboard } from './Leaderboard';

/**
 * The owner edits the rubric and the leaderboard's visibility here. Judges
 * score on the event's portal.
 */
export function JudgingPage() {
  const api = useApi();
  const { event, path } = useEventContext();
  const criteria = useQuery({
    queryKey: ['event', event.id, 'criteria'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/criteria', path)),
  });
  return (
    <div className="grid gap-4">
      <CriteriaEditor criteria={criteria.data ?? []} />
      <Leaderboard />
    </div>
  );
}
