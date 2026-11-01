import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { fromISTInput, toISTInput } from '@/lib/datetime';

type Checkpoint = Schemas['Checkpoint'];
const ANY_ENTRY = '__any__';

/** Edits a checkpoint's name, opening hours, repeat scans and (exits) the entry it pairs with. */
export function EditCheckpointDialog({
  checkpoint,
  entries,
}: {
  checkpoint: Checkpoint;
  /** The event's entry checkpoints, for pairing an exit. */
  entries: Checkpoint[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Edit ${checkpoint.name}`}>
          Edit
        </Button>
      </DialogTrigger>
      {/* A fresh form each time it opens, from the checkpoint as it is now. */}
      {open && <EditForm checkpoint={checkpoint} entries={entries} onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

function EditForm({
  checkpoint,
  entries,
  onDone,
}: {
  checkpoint: Checkpoint;
  entries: Checkpoint[];
  onDone: () => void;
}) {
  const api = useApi();
  const { event } = useEventContext();
  const [name, setName] = useState(checkpoint.name);
  const [opensAt, setOpensAt] = useState(checkpoint.opensAt ? toISTInput(checkpoint.opensAt) : '');
  const [closesAt, setClosesAt] = useState(
    checkpoint.closesAt ? toISTInput(checkpoint.closesAt) : '',
  );
  const [allowRepeat, setAllowRepeat] = useState(checkpoint.allowRepeat);
  const [linked, setLinked] = useState(checkpoint.linkedCheckpointId ?? '');
  const isExit = checkpoint.type === 'exit';
  const badWindow = opensAt !== '' && closesAt !== '' && closesAt <= opensAt;

  const save = useEventMutation(event.id, () =>
    unwrap(
      api.PATCH('/v1/events/{eventId}/checkpoints/{checkpointId}', {
        params: { path: { eventId: event.id, checkpointId: checkpoint.id } },
        body: {
          name: name.trim(),
          opensAt: opensAt ? fromISTInput(opensAt) : null,
          closesAt: closesAt ? fromISTInput(closesAt) : null,
          allowRepeat,
          ...(isExit ? { linkedCheckpointId: linked || null } : {}),
        },
      }),
    ),
  );

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit {checkpoint.name}</DialogTitle>
        <DialogDescription>
          Leave the times empty to keep the checkpoint open all the time.
        </DialogDescription>
      </DialogHeader>
      <form
        id="edit-checkpoint"
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || badWindow) return;
          save.mutate(undefined, { onSuccess: onDone });
        }}
      >
        <FormField
          label="Name"
          value={name}
          maxLength={100}
          error={name.trim() ? undefined : 'Name the checkpoint.'}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Opens (IST, optional)"
            type="datetime-local"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
          />
          <FormField
            label="Closes (IST, optional)"
            type="datetime-local"
            value={closesAt}
            error={badWindow ? 'Must close after it opens.' : undefined}
            onChange={(e) => setClosesAt(e.target.value)}
          />
        </div>
        {isExit && (
          <Field>
            <FieldLabel htmlFor="edit-pair">Pairs with entry checkpoint</FieldLabel>
            <Select
              value={linked || ANY_ENTRY}
              onValueChange={(v) => setLinked(v === ANY_ENTRY ? '' : v)}
            >
              <SelectTrigger id="edit-pair" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_ENTRY}>Any entry checkpoint</SelectItem>
                {entries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Where people scan back in after leaving here.</FieldDescription>
          </Field>
        )}
        <Field orientation="horizontal">
          <Checkbox
            id="edit-repeat"
            checked={allowRepeat}
            onCheckedChange={(c) => setAllowRepeat(c === true)}
          />
          <FieldLabel htmlFor="edit-repeat" className="font-normal">
            Allow repeat scans
          </FieldLabel>
        </Field>
        <ErrorAlert error={save.error} />
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="edit-checkpoint"
          disabled={save.isPending || !name.trim() || badWindow}
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
