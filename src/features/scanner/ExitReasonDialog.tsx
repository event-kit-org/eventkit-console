import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const OTHER = '__other__';

/**
 * At an exit checkpoint: why the person is leaving, picked from the event's
 * quick reasons, or typed. The scan is sent only once a reason is confirmed.
 */
export function ExitReasonDialog({
  code,
  reasons,
  onConfirm,
  onCancel,
}: {
  /** The scanned code waiting for a reason (null: closed). */
  code: string | null;
  reasons: string[];
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={code !== null} onOpenChange={(open) => !open && onCancel()}>
      {/* A fresh form for each scan. */}
      <ReasonForm key={code} reasons={reasons} onConfirm={onConfirm} onCancel={onCancel} />
    </Dialog>
  );
}

function ReasonForm({
  reasons,
  onConfirm,
  onCancel,
}: {
  reasons: string[];
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState('');
  const [typed, setTyped] = useState('');
  const reason = choice === OTHER ? typed.trim() : choice;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Why are they leaving?</DialogTitle>
        <DialogDescription>
          They show as outside until they scan back in at the entry.
        </DialogDescription>
      </DialogHeader>
      <form
        id="exit-reason"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason) onConfirm(reason);
        }}
      >
        <Field>
          <FieldLabel htmlFor="exit-reason-select">Reason</FieldLabel>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="exit-reason-select" className="w-full">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
              <SelectItem value={OTHER}>Something else…</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {choice === OTHER && (
          <Field>
            <FieldLabel htmlFor="exit-reason-text">Describe it</FieldLabel>
            <Textarea
              id="exit-reason-text"
              maxLength={200}
              value={typed}
              autoFocus
              onChange={(e) => setTyped(e.target.value)}
            />
          </Field>
        )}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form="exit-reason" disabled={!reason}>
          Mark as left
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
