import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { useEventContext } from '@/features/events/event-context';

const LIVE = 60_000;

export function useRegistrationsByDay() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'insights', 'registrations'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/insights/registrations', path)),
  });
}

/** Refreshes every minute: it is watched live on the event day. */
export function useAttendance(enabled: boolean) {
  const api = useApi();
  const { event } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'insights', 'attendance'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/insights/attendance', {
          params: { path: { eventId: event.id }, query: { bucket: 30 } },
        }),
      ),
    enabled,
    refetchInterval: LIVE,
  });
}

export function useFieldCounts(fieldId: string) {
  const api = useApi();
  const { event } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'insights', 'field', fieldId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/insights/fields/{fieldId}', {
          params: { path: { eventId: event.id, fieldId } },
        }),
      ),
  });
}

export function usePollCounts(pollId: string) {
  const api = useApi();
  const { event } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'insights', 'poll', pollId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/insights/polls/{pollId}', {
          params: { path: { eventId: event.id, pollId } },
        }),
      ),
    refetchInterval: LIVE,
  });
}

export function useDashboard() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'insights', 'dashboard'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/insights/dashboard', path)),
  });
}

/** Every poll, for picking one to chart. */
export function usePollList() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'polls'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/polls', path)),
  });
}

/** A checkpoint's scans per 30-minute slot, totals and meals; live on the event day. */
export function useCheckpointStats(checkpointId: string) {
  const api = useApi();
  const { event } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'insights', 'checkpoint', checkpointId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/insights/checkpoints/{checkpointId}', {
          params: { path: { eventId: event.id, checkpointId }, query: { bucket: 30 } },
        }),
      ),
    refetchInterval: LIVE,
  });
}

/** Every checkpoint, for picking one to chart (scanning on only). */
export function useCheckpointList(enabled: boolean) {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'checkpoints'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/checkpoints', path)),
    enabled,
  });
}
