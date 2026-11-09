import { useQuery } from '@tanstack/react-query';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { Badge } from '@/components/ui/badge';
import { useEventContext } from '@/features/events/event-context';
import { useSearchParam } from '@/hooks/useSearchParam';
import { cn } from '@/lib/utils';

export type Round = Schemas['Round'];
export type Phase = Round['phase'];

export const PHASES: { value: Phase; label: string; explain: string }[] = [
  {
    value: 'draft',
    label: 'Draft',
    explain: 'Only admins and judges see this round.',
  },
  {
    value: 'released',
    label: 'Released',
    explain: 'Participants see this round and its submissions, teams can submit, and judges score.',
  },
  {
    value: 'closed',
    label: 'Closed',
    explain:
      'Participants still see this round, but no new submissions are accepted and scores are locked.',
  },
];

/**
 * The rounds and the one picked, kept in the address (?round=) so a reload or a
 * shared link opens the same round. Defaults to the first round.
 */
export function usePickedRound() {
  const rounds = useRounds();
  const [picked, setPicked] = useSearchParam('round');
  const all = rounds.data ?? [];
  const selected = all.find((r) => r.id === picked) ?? all[0];
  return { rounds, all, selected, setPicked };
}

export function useRounds() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'rounds'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/rounds', path)),
  });
}

/** The teams allowed in a round; null when every team is. */
export function useRoundTeams(roundId: string | undefined) {
  const api = useApi();
  const { event } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'rounds', roundId, 'teams'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/rounds/{roundId}/teams', {
          params: { path: { eventId: event.id, roundId: roundId! } },
        }),
      ),
    enabled: Boolean(roundId),
  });
}

export const PHASE_TONE: Record<Phase, string> = {
  draft: '',
  released: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  // Finished, not a warning: amber means "waiting on someone" elsewhere.
  closed: 'border-border bg-transparent text-muted-foreground',
};

export function PhaseBadge({ phase }: { phase: Phase }) {
  return (
    <Badge variant="secondary" className={cn(PHASE_TONE[phase])}>
      {PHASES.find((p) => p.value === phase)?.label ?? phase}
    </Badge>
  );
}
