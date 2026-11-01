import { Plus, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';

/** Whether shortlists and confirmations wait for an organiser to release them. */
export function StagedReleaseCard() {
  const api = useApi();
  const { event, path } = useEventContext();
  const [confirming, setConfirming] = useState(false);
  const save = useEventMutation(event.id, (stagedRelease: boolean) =>
    unwrap(api.PATCH('/v1/events/{eventId}', { ...path, body: { stagedRelease } })),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staged release</CardTitle>
        <CardDescription>
          When on, shortlisting or confirming a team doesn&apos;t show on its portal until you
          release it from Teams, so you can finish reviewing and announce results in batches.
          Turning it off releases everything held back.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-3">
          <Switch
            id="staged-release"
            checked={event.stagedRelease}
            disabled={save.isPending}
            onCheckedChange={(on) => (on ? save.mutate(true) : setConfirming(true))}
          />
          <Label htmlFor="staged-release" className="font-normal">
            Hold decisions until I release them
          </Label>
        </div>
        <ErrorAlert error={save.error} />
      </CardContent>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off staged release?</AlertDialogTitle>
            <AlertDialogDescription>
              Every shortlist and confirmation not released yet shows to its team right away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep holding</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate(false)}>
              Release all and turn off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const DEFAULT_REASONS = ['Bathroom', 'Emergency', 'Medical', 'Food / outside break', 'Other'];

/** The quick reasons volunteers pick from when someone leaves through an exit checkpoint. */
export function ExitReasonsCard() {
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
    <Card>
      <CardHeader>
        <CardTitle>Exit reasons</CardTitle>
        <CardDescription>
          At an exit checkpoint, volunteers pick one of these (or type another) when someone leaves
          the venue.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <ul className="grid gap-2" aria-label="Exit reasons">
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
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          disabled={!changed || duplicate || cleaned.length === 0 || save.isPending}
          onClick={() => save.mutate(cleaned, { onSuccess: () => setReasons(cleaned) })}
        >
          Save reasons
        </Button>
        <Button variant="ghost" onClick={() => setReasons(DEFAULT_REASONS)}>
          <RotateCcw aria-hidden /> Defaults
        </Button>
      </CardFooter>
    </Card>
  );
}
