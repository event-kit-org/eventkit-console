import { Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';

const DEFAULT_REASONS = ['Bathroom', 'Emergency', 'Medical', 'Food / outside break', 'Other'];

/**
 * The quick reasons volunteers pick from when someone goes out through an entry
 * & exit checkpoint: a table, edited in a popup.
 */
export function ExitReasonsCard() {
  const { event } = useEventContext();
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exit reasons</CardTitle>
        <CardDescription>
          At an entry & exit checkpoint, volunteers pick one of these (or type another) when someone
          leaves the venue.
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label="Exit reasons">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {event.exitReasons.map((r, i) => (
                <TableRow key={r}>
                  <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                  <TableCell className="whitespace-normal wrap-anywhere">{r}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {editing && <EditReasonsDialog onClose={() => setEditing(false)} />}
    </Card>
  );
}

function EditReasonsDialog({ onClose }: { onClose: () => void }) {
  const api = useApi();
  const { event, path } = useEventContext();
  const [reasons, setReasons] = useState<string[]>(event.exitReasons);
  const [draft, setDraft] = useState('');
  const save = useEventMutation(event.id, (exitReasons: string[]) =>
    unwrap(api.PATCH('/v1/events/{eventId}', { ...path, body: { exitReasons } })),
  );
  const cleaned = reasons.map((r) => r.trim()).filter(Boolean);
  const duplicate = new Set(cleaned.map((r) => r.toLowerCase())).size !== cleaned.length;
  const changed = JSON.stringify(cleaned) !== JSON.stringify(event.exitReasons);
  const add = () => {
    const r = draft.trim();
    if (!r || reasons.length >= 20) return;
    setReasons([...reasons, r]);
    setDraft('');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit exit reasons</DialogTitle>
          <DialogDescription>Up to 20, each up to 40 characters.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2" aria-label="Exit reasons to save">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <Input
                aria-label={`Reason ${i + 1}`}
                value={r}
                maxLength={40}
                onChange={(e) => setReasons(reasons.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${r || `reason ${i + 1}`}`}
                disabled={reasons.length <= 1}
                onClick={() => setReasons(reasons.filter((_, j) => j !== i))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            aria-label="New reason"
            placeholder="Add a reason, e.g. Phone call"
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!draft.trim() || reasons.length >= 20}>
            <Plus aria-hidden /> Add
          </Button>
        </form>
        {duplicate && <p className="text-sm text-destructive">Each reason must be different.</p>}
        <ErrorAlert error={save.error} />
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setReasons(DEFAULT_REASONS)}>
            <RotateCcw aria-hidden /> Defaults
          </Button>
          <Button
            disabled={!changed || duplicate || cleaned.length === 0 || save.isPending}
            onClick={() => save.mutate(cleaned, { onSuccess: onClose })}
          >
            Save reasons
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
