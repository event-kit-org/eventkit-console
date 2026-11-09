import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST } from '@/lib/datetime';

/** The registration window. (Exporting teams is on the Teams page.) */
export function ManageEventCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage event</CardTitle>
        <CardDescription>The registration window.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegistrationWindow />
      </CardContent>
    </Card>
  );
}

/** Deleting the event, on its own card. Only the owner sees it. */
export function DangerZoneCard() {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>Actions here can&apos;t be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <DeleteEvent />
      </CardContent>
    </Card>
  );
}

function RegistrationWindow() {
  const api = useApi();
  const { event, path } = useEventContext();
  // Read when the page opens, and again after closing it here.
  const [now, setNow] = useState(() => Date.now());
  const opens = new Date(event.registrationStart).getTime();
  const closes = new Date(event.registrationDeadline).getTime();
  const state = now < opens ? 'not open yet' : now < closes ? 'open' : 'closed';
  const close = useEventMutation(event.id, () =>
    unwrap(
      api.PATCH('/v1/events/{eventId}', {
        ...path,
        body: { registrationDeadline: new Date().toISOString() },
      }),
    ),
  );

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 font-medium">
        Registration
        <Badge variant={state === 'open' ? 'default' : 'secondary'}>{state}</Badge>
      </div>
      <p className="text-muted-foreground">
        {formatIST(event.registrationStart)} to {formatIST(event.registrationDeadline)}.{' '}
        {state === 'open'
          ? 'Close it now to stop new teams at once.'
          : 'To change the dates or reopen it, edit the deadline in Event details below.'}
      </p>
      <ErrorAlert error={close.error} />
      {state === 'open' && (
        <div>
          <ConfirmButton
            size="sm"
            variant="outline"
            title="Close registration now?"
            description="New teams can't register from now on. Registered teams aren't affected. You can reopen it by moving the deadline in Event details."
            confirmLabel="Close registration"
            disabled={close.isPending}
            onConfirm={() => close.mutate(undefined, { onSuccess: () => setNow(Date.now()) })}
          >
            <LockKeyhole aria-hidden /> Close registration now
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

function DeleteEvent() {
  const api = useApi();
  const { event, path } = useEventContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const remove = useMutation({
    mutationFn: () =>
      unwrap(api.DELETE('/v1/events/{eventId}', { ...path, body: { confirmName: typed } })),
    onSuccess: () => {
      navigate('/');
      queryClient.removeQueries({ queryKey: ['event', event.id] });
      return queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
  const matches = typed.trim() === event.name.trim();

  return (
    <div className="grid gap-2 text-sm">
      <div className="font-medium text-destructive">Delete event</div>
      <p className="text-muted-foreground">
        Deletes the event for good, with every team, registration, link, poll, check-in, score and
        staff account in it. Export the teams first if you need a record.
      </p>
      <div>
        <AlertDialog onOpenChange={(open) => !open && setTyped('')}>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <Trash2 aria-hidden /> Delete event
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {event.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything in this event is deleted for good. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (matches) remove.mutate();
              }}
            >
              <Label htmlFor="confirm-event-name">
                Type <span className="font-semibold">{event.name}</span> to confirm
              </Label>
              <Input
                id="confirm-event-name"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
              <ErrorAlert error={remove.error} />
              <AlertDialogFooter className="mt-2">
                <AlertDialogCancel type="button">Keep</AlertDialogCancel>
                <Button type="submit" variant="destructive" disabled={!matches || remove.isPending}>
                  Delete event
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
