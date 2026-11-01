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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
