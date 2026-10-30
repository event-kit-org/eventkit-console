import { useQuery } from '@tanstack/react-query';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { useEventContext } from '@/features/events/event-context';

export type Submission = Schemas['Submission'];

export function useSubmissions() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'submissions'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/submissions', path)),
  });
}

export function useEntries(submissionId: string) {
  const api = useApi();
  const { event } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'submissions', submissionId, 'entries'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/submissions/{submissionId}/entries', {
          params: { path: { eventId: event.id, submissionId } },
        }),
      ),
  });
}
