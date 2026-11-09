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
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { fromISTInput, toISTInput } from '@/lib/datetime';

type Checkpoint = Schemas['Checkpoint'];

/** Edits a checkpoint's name, opening hours and repeat scans (opened from its ⋯ menu). */
export function EditCheckpointDialog({
  checkpoint,
  onClose,
}: {
  checkpoint: Checkpoint;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <EditForm checkpoint={checkpoint} onDone={onClose} />
    </Dialog>
  );
}

function EditForm({ checkpoint, onDone }: { checkpoint: Checkpoint; onDone: () => void }) {
  const api = useApi();
  const { event } = useEventContext();
  const [name, setName] = useState(checkpoint.name);
  const [opensAt, setOpensAt] = useState(checkpoint.opensAt ? toISTInput(checkpoint.opensAt) : '');
  const [closesAt, setClosesAt] = useState(
    checkpoint.closesAt ? toISTInput(checkpoint.closesAt) : '',
  );
  const [allowRepeat, setAllowRepeat] = useState(checkpoint.allowRepeat);
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
