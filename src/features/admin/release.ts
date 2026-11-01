import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';

export type ReleaseStage = 'shortlisted' | 'confirmed' | 'all';
export interface ReleaseRequest {
  stage: ReleaseStage;
  teamIds?: string[];
}

/** Staged release: show teams the decisions made so far. */
export function useReleaseTeams() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useEventMutation(event.id, (body: ReleaseRequest) =>
    unwrap(api.POST('/v1/events/{eventId}/teams/release', { ...path, body })),
  );
}
