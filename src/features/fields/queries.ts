import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { useEventContext } from '@/features/events/event-context';

export function useFields() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'fields'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/fields', path)),
  });
}

export function useTeamRules() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'team-rules'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/team-rules', path)),
  });
}
