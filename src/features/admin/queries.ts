import { useQuery } from '@tanstack/react-query';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { useEventContext } from '@/features/events/event-context';

export function useTeams() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'teams'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/teams', path)),
  });
}

export function useProofs(status?: Schemas['PaymentProofStatus']) {
  const api = useApi();
  const { event } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'proofs', status ?? 'all'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/payment-proofs', {
          params: { path: { eventId: event.id }, query: status ? { status } : {} },
        }),
      ),
  });
}
