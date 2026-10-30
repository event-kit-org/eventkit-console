import { useQuery } from '@tanstack/react-query';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { Badge } from '@/components/ui/badge';
import { useEventContext } from '@/features/events/event-context';
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
    explain: 'Participants see this round and its submissions, and teams can submit.',
  },
  {
    value: 'closed',
    label: 'Closed',
    explain: 'Participants still see this round, but no new submissions are accepted.',
  },
];

export function useRounds() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'rounds'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/rounds', path)),
  });
}

const TONE: Record<Phase, string> = {
  draft: '',
  released: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  closed: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
};

export function PhaseBadge({ phase }: { phase: Phase }) {
  return (
    <Badge variant="secondary" className={cn(TONE[phase])}>
      {PHASES.find((p) => p.value === phase)?.label ?? phase}
    </Badge>
  );
}
