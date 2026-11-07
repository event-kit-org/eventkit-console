import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { RowsSkeleton } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import type { Round } from './rounds';

/**
 * After an elimination round: the admin picks the teams that go on to a later
 * round. The top N of the round's leaderboard are ticked to start with.
 */
export function AdvanceDialog({
  source,
  rounds,
  onClose,
}: {
  source: Round;
  rounds: Round[];
  onClose: () => void;
}) {
  const api = useApi();
  const { event, path } = useEventContext();
  const later = [...rounds]
    .filter((r) => r.id !== source.id)
    .sort((a, b) => a.position - b.position);
  const next = later.find((r) => r.position > source.position) ?? later[0];
  const [targetId, setTargetId] = useState(next?.id ?? '');
  const board = useQuery({
    queryKey: ['event', event.id, 'leaderboard', source.id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/leaderboard', {
          params: { path: path.params.path, query: { roundId: source.id } },
        }),
      ),
  });
  const entries = board.data?.entries ?? [];
  // Starts with the top half ticked; the leaderboard is in before the list shows.
  const half = Math.ceil(entries.length / 2);
  const [count, setCount] = useState<string | null>(null);
  const [chosen, setPicked] = useState<Set<string> | null>(null);
  const picked = chosen ?? new Set(entries.slice(0, half).map((e) => e.team.id));
  const pickTop = (value: string) => {
    setCount(value);
    const n = Number(value);
    if (Number.isInteger(n) && n >= 0) {
      setPicked(new Set(entries.slice(0, n).map((e) => e.team.id)));
    }
  };
  const toggle = (id: string, on: boolean) => {
    const nextSet = new Set(picked);
    if (on) nextSet.add(id);
    else nextSet.delete(id);
    setPicked(nextSet);
  };
  const save = useEventMutation(event.id, () =>
    unwrap(
      api.PUT('/v1/events/{eventId}/rounds/{roundId}/teams', {
        params: { path: { eventId: event.id, roundId: targetId } },
        body: { teamIds: entries.filter((e) => picked.has(e.team.id)).map((e) => e.team.id) },
      }),
    ),
  );
  const target = rounds.find((r) => r.id === targetId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Who goes on from {source.name}?</DialogTitle>
          <DialogDescription>
            Only the teams you tick submit, are judged and are ranked in the next round.
            Participants see it once that round is released.
          </DialogDescription>
        </DialogHeader>
        {later.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add the next round first, then choose who goes on to it.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="grid gap-2">
                <Label htmlFor="advance-target">Into round</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger id="advance-target" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {later.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                label="Top"
                type="number"
                min={0}
                max={entries.length}
                inputMode="numeric"
                value={count ?? (board.data ? String(half) : '')}
                onChange={(e) => pickTop(e.target.value)}
              />
            </div>
            {board.isPending && <RowsSkeleton rows={3} />}
            <ErrorAlert error={board.error} />
            {board.data && entries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nobody is on this round’s leaderboard yet. Teams appear once a member checks in.
              </p>
            )}
            {entries.length > 0 && (
              <ul
                className="grid max-h-[45dvh] gap-1 overflow-y-auto rounded-lg border p-2"
                aria-label="Teams on the leaderboard"
              >
                {entries.map((e) => {
                  const id = `advance-${e.team.id}`;
                  return (
                    <li key={e.team.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                      <Checkbox
                        id={id}
                        checked={picked.has(e.team.id)}
                        onCheckedChange={(c) => toggle(e.team.id, c === true)}
                      />
                      <Label htmlFor={id} className="min-w-0 flex-1 font-normal">
                        <span className="w-6 shrink-0 text-muted-foreground tabular-nums">
                          {e.rank}
                        </span>
                        <span className="min-w-0 flex-1 wrap-anywhere">{e.team.name}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {e.total.toFixed(1)}
                        </span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
            <ErrorAlert error={save.error} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Later
          </Button>
          {later.length > 0 && (
            <Button
              disabled={!target || picked.size === 0 || save.isPending}
              onClick={() => save.mutate(undefined, { onSuccess: onClose })}
            >
              Send {picked.size} {picked.size === 1 ? 'team' : 'teams'} to {target?.name ?? '…'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
