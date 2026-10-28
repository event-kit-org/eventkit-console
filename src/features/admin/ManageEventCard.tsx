import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, LockKeyhole, Trash2 } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useEventContext } from '@/features/events/event-context';
import { useFields } from '@/features/fields/queries';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST } from '@/lib/datetime';
import { download, slug, teamsCsv } from './teams-csv';

/** Registration window, exporting teams, and deleting the event. */
export function ManageEventCard() {
  const { isOwner } = useEventContext();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage event</CardTitle>
        <CardDescription>
          {isOwner ? 'Registration, exports, and deleting the event.' : 'Registration and exports.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <RegistrationWindow />
        <Separator />
        <ExportTeams />
        {/* Only the owner deletes the event. */}
        {isOwner && (
          <>
            <Separator />
            <DeleteEvent />
          </>
        )}
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

function ExportTeams() {
  const api = useApi();
  const { event, path } = useEventContext();
  const fields = useFields().data ?? [];
  const exportCsv = useMutation({
    mutationFn: async () => {
      const list = await unwrap(api.GET('/v1/events/{eventId}/teams', path));
      const teams = await Promise.all(
        list.map((t) =>
          unwrap(
            api.GET('/v1/events/{eventId}/teams/{teamId}', {
              params: { path: { eventId: event.id, teamId: t.id } },
            }),
          ),
        ),
      );
      download(`${slug(event.name)}-teams.csv`, teamsCsv(teams, fields));
      return teams.length;
    },
  });

  return (
    <div className="grid gap-2 text-sm">
      <div className="font-medium">Export teams</div>
      <p className="text-muted-foreground">
        Every member as a row (CSV, opens in Excel or Google Sheets): team, participant ID, contact
        details, status, payment and form answers.
      </p>
      <ErrorAlert error={exportCsv.error} />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={exportCsv.isPending}
          onClick={() => exportCsv.mutate()}
        >
          <Download aria-hidden /> {exportCsv.isPending ? 'Preparing…' : 'Download CSV'}
        </Button>
        {exportCsv.isSuccess && (
          <span role="status" className="text-muted-foreground">
            {exportCsv.data} {exportCsv.data === 1 ? 'team' : 'teams'} exported.
          </span>
        )}
      </div>
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
