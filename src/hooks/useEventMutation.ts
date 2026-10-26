import { useMutation, useQueryClient } from '@tanstack/react-query';

/** A mutation that refreshes everything cached for the event when it succeeds. */
export function useEventMutation<TVars, TData>(
  eventId: string,
  fn: (vars: TVars) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
  });
}
