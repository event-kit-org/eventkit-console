import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { PHASES, type Phase, type Round } from './rounds';

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

/** Tabs for the event's rounds, plus add / rename / delete and the phase of the selected one. */
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
  const [dialog, setDialog] = useState<'add' | 'rename' | null>(null);
  const create = useEventMutation(event.id, (name: string) =>
    unwrap(api.POST('/v1/events/{eventId}/rounds', { ...path, body: { name } })),
  );
  const patch = useEventMutation(event.id, (body: { name?: string; phase?: Phase }) =>
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
  const explain = PHASES.find((p) => p.value === selected?.phase)?.explain;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {selected && (
          <Tabs value={selected.id} onValueChange={onSelect} className="max-w-full overflow-x-auto">
            <TabsList>
              {rounds.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>
                  {r.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <Button variant="outline" size="sm" onClick={() => setDialog('add')}>
          <Plus aria-hidden /> Add round
        </Button>
      </div>
      {selected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <NativeSelect
            aria-label="Round phase"
            className="w-36"
            value={selected.phase}
            disabled={patch.isPending}
            onChange={(e) => patch.mutate({ phase: e.target.value as Phase })}
          >
            {PHASES.map((p) => (
              <NativeSelectOption key={p.value} value={p.value}>
                {p.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="flex-1 text-muted-foreground">{explain}</span>
          <Button size="sm" variant="ghost" onClick={() => setDialog('rename')}>
            <Pencil aria-hidden /> Rename
          </Button>
          <ConfirmButton
            size="sm"
            variant="ghost"
            title={`Delete ${selected.name}?`}
            description="Its rubric goes with it. A round that has scores or submissions can't be deleted."
            confirmLabel="Delete round"
            destructive
            onConfirm={() => remove.mutate(undefined)}
          >
            Delete round
          </ConfirmButton>
        </div>
      )}
      <ErrorAlert error={patch.error ?? remove.error} />
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
    </div>
  );
}
