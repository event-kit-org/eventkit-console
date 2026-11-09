import { Download, Ellipsis, Pencil, Plus, Swords, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEventContext } from '@/features/events/event-context';
import { useRoundExport } from '@/features/submissions/round-export';
import { useEventMutation } from '@/hooks/useEventMutation';
import { AdvanceDialog } from './Elimination';
import { PHASES, type Phase, type Round, useRoundTeams } from './rounds';

/** Names a round: for a new one, or renaming. */
function NameDialog({
  title,
  initial,
  submitLabel,
  error,
  pending,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  submitLabel: string;
  error: unknown;
  pending: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(name.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Rounds group a rubric, submissions and a leaderboard.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="Round name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Kind = Round['kind'];

/**
 * The event's rounds as a dropdown, with the selected round's phase, who takes
 * part, and its actions (rename, elimination, CSV, delete) in a menu.
 */
export function RoundsStrip({
  rounds,
  selected,
  onSelect,
}: {
  rounds: Round[];
  selected: Round | undefined;
  onSelect: (id: string) => void;
}) {
  const api = useApi();
  const { event, path } = useEventContext();
  const [dialog, setDialog] = useState<'add' | 'rename' | 'advance' | 'delete' | null>(null);
  const roundTeams = useRoundTeams(selected?.id);
  const exportRound = useRoundExport();
  const create = useEventMutation(event.id, (name: string) =>
    unwrap(api.POST('/v1/events/{eventId}/rounds', { ...path, body: { name } })),
  );
  const patch = useEventMutation(event.id, (body: { name?: string; phase?: Phase; kind?: Kind }) =>
    unwrap(
      api.PATCH('/v1/events/{eventId}/rounds/{roundId}', {
        params: { path: { eventId: event.id, roundId: selected!.id } },
        body,
      }),
    ),
  );
  const remove = useEventMutation(event.id, () =>
    unwrap(
      api.DELETE('/v1/events/{eventId}/rounds/{roundId}', {
        params: { path: { eventId: event.id, roundId: selected!.id } },
      }),
    ),
  );
  const openToAll = useEventMutation(event.id, () =>
    unwrap(
      api.PUT('/v1/events/{eventId}/rounds/{roundId}/teams', {
        params: { path: { eventId: event.id, roundId: selected!.id } },
        body: { teamIds: null },
      }),
    ),
  );
  const explain = PHASES.find((p) => p.value === selected?.phase)?.explain;
  const limited = roundTeams.data?.teamIds ?? null;
  const elimination = selected?.kind === 'elimination';
  const setPhase = (phase: Phase) =>
    patch.mutate(
      { phase },
      // Closing an elimination round is when the admin picks who goes on.
      { onSuccess: () => elimination && phase === 'closed' && setDialog('advance') },
    );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {selected && (
          <Select value={selected.id} onValueChange={onSelect}>
            <SelectTrigger aria-label="Round" className="w-full min-w-0 sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rounds.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="truncate">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {PHASES.find((p) => p.value === r.phase)?.label}
                    {r.kind === 'elimination' && ' · Elimination'}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" className="ml-auto" onClick={() => setDialog('add')}>
          <Plus aria-hidden /> Add round
        </Button>
      </div>
      {selected && (
        <div className="grid gap-3 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={selected.phase}
              disabled={patch.isPending}
              onValueChange={(v) => setPhase(v as Phase)}
            >
              <SelectTrigger aria-label="Round phase" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {elimination && (
              <Badge variant="secondary">
                <Swords aria-hidden /> Elimination
              </Badge>
            )}
            <span className="min-w-0 flex-1 basis-48 text-muted-foreground">{explain}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${selected.name}`}>
                  <Ellipsis aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={() => setDialog('rename')}>
                  <Pencil aria-hidden /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => patch.mutate({ kind: elimination ? 'normal' : 'elimination' })}
                >
                  <Swords aria-hidden />
                  {elimination ? 'Make a normal round' : 'Make an elimination round'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={exportRound.isPending}
                  onSelect={() => exportRound.mutate(selected)}
                >
                  <Download aria-hidden /> Download submissions (CSV)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
                  <Trash2 aria-hidden /> Delete round
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {elimination && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
              <span className="min-w-0 flex-1 basis-56 text-muted-foreground">
                An elimination round: once it closes, pick the teams that go on to the next round.
              </span>
              <Button size="sm" variant="secondary" onClick={() => setDialog('advance')}>
                <Users aria-hidden /> Choose who goes on
              </Button>
            </div>
          )}
          {limited && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
              <span>
                Only {limited.length} {limited.length === 1 ? 'team takes' : 'teams take'} part in
                this round.
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={openToAll.isPending}
                onClick={() => openToAll.mutate(undefined)}
              >
                Let every team in
              </Button>
            </div>
          )}
        </div>
      )}
      <ErrorAlert error={patch.error ?? remove.error ?? openToAll.error ?? exportRound.error} />
      {dialog === 'add' && (
        <NameDialog
          title="Add a round"
          initial=""
          submitLabel="Add round"
          error={create.error}
          pending={create.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(name) =>
            create.mutate(name, {
              onSuccess: (r) => {
                onSelect(r.id);
                setDialog(null);
              },
            })
          }
        />
      )}
      {dialog === 'rename' && selected && (
        <NameDialog
          title="Rename round"
          initial={selected.name}
          submitLabel="Save"
          error={patch.error}
          pending={patch.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(name) => patch.mutate({ name }, { onSuccess: () => setDialog(null) })}
        />
      )}
      {dialog === 'advance' && selected && (
        <AdvanceDialog source={selected} rounds={rounds} onClose={() => setDialog(null)} />
      )}
      <AlertDialog open={dialog === 'delete'} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its rubric goes with it. A round that has scores or submissions can’t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate(undefined)}>
              Delete round
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
