import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CircleAlert, Link2, QrCode, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { type Schemas, unwrap } from '@/api/client';
import { uploadFile } from '@/api/upload';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { CardsSkeleton } from '@/components/PageState';
import { Skeleton } from '@/components/ui/skeleton';
import { ProofStatusBadge, StatusBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useDetailCrumb } from '@/components/detail-crumb';
import { useEventContext } from '@/features/events/event-context';
import { useTracks } from '@/features/judging/Tracks';
import { useEventMutation } from '@/hooks/useEventMutation';
import { AnswerList } from '@/features/fields/FieldInputs';
import { memberFields, teamFields } from '@/features/fields/fields';
import { useFields } from '@/features/fields/queries';
import { formatIST } from '@/lib/datetime';
import { teamDisplayStatus } from '@/lib/status';
import { formatMoney } from '@/lib/money';
import { useReleaseTeams } from './release';
import { PendingReleaseBadge } from './TeamRelease';
import {
  AddMemberDialog,
  EditMemberDialog,
  EditTeamDialog,
  SendLinkMenu,
} from './TeamMemberDialogs';

export function TeamDetailPage() {
  const { teamId = '' } = useParams();
  const { state } = useLocation();
  const api = useApi();
  const { event, role, features } = useEventContext();
  // Reviewers shortlist, confirm and cancel; links, QR codes, receipts and deleting are for admins.
  const admin = role === 'admin';
  const params = { params: { path: { eventId: event.id, teamId } } };
  const fields = useFields().data ?? [];
  const [newLink, setNewLink] = useState<{
    name: string;
    token: string;
    url: string | null;
    emailedTo: string | null;
  } | null>(null);
  // A new link can go to the team leader by email.
  const [emailLeader, setEmailLeader] = useState(true);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const team = useQuery({
    queryKey: ['event', event.id, 'team', teamId],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/teams/{teamId}', params)),
  });
  useDetailCrumb(team.data?.name);

  const move = useEventMutation(event.id, (action: 'shortlist' | 'confirm') =>
    unwrap(
      action === 'shortlist'
        ? api.POST('/v1/events/{eventId}/teams/{teamId}/shortlist', params)
        : api.POST('/v1/events/{eventId}/teams/{teamId}/confirm', params),
    ),
  );
  const regAction = useEventMutation(
    event.id,
    ({ id, action }: { id: string; action: 'cancel' | 'restore' }) => {
      const p = { params: { path: { eventId: event.id, registrationId: id } } };
      return unwrap(
        action === 'cancel'
          ? api.POST('/v1/events/{eventId}/registrations/{registrationId}/cancel', p)
          : api.POST('/v1/events/{eventId}/registrations/{registrationId}/restore', p),
      );
    },
  );

  const reg = (registrationId: string) => ({
    params: { path: { eventId: event.id, registrationId } },
  });
  const reissue = useEventMutation(event.id, (v: { id: string; emailLeader: boolean }) =>
    unwrap(
      api.POST('/v1/events/{eventId}/registrations/{registrationId}/reissue-link', {
        ...reg(v.id),
        body: { emailLeader: v.emailLeader },
      }),
    ),
  );
  const rotateQr = useEventMutation(event.id, (id: string) =>
    unwrap(api.POST('/v1/events/{eventId}/registrations/{registrationId}/rotate-qr', reg(id))),
  );
  const release = useReleaseTeams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Leaves the page first, so the deleted team isn't fetched again.
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/v1/events/{eventId}/teams/{teamId}', params)),
    onSuccess: () => {
      navigate('..', { relative: 'path' });
      queryClient.removeQueries({ queryKey: ['event', event.id, 'team', teamId] });
      return queryClient.invalidateQueries({ queryKey: ['event', event.id] });
    },
  });
  const attach = useEventMutation(event.id, async (file: File) => {
    const receiptKey = await uploadFile(api, event.id, 'receipt', file, fetch, teamId);
    return unwrap(
      api.POST('/v1/events/{eventId}/teams/{teamId}/payment-proofs', {
        ...params,
        body: { receiptKey },
      }),
    );
  });

  if (team.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-28" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <CardsSkeleton count={2} />
      </div>
    );
  }
  if (team.isError) return <ErrorAlert error={team.error} />;
  const t = team.data;
  // Cancelling the leader cancels the team; restoring them brings it back.
  const leader = t.members.find((m) => m.isLeader);
  const teamCancelled = leader?.status === 'cancelled';

  return (
    <div className="grid gap-4">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        {/* Back to the list as it was: same search and filter. */}
        <Link to={`..${(state as { list?: string } | null)?.list ?? ''}`} relative="path">
          <ArrowLeft aria-hidden /> All teams
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="min-w-0 text-xl font-semibold tracking-tight wrap-anywhere">{t.name}</h2>
          <StatusBadge
            status={teamDisplayStatus({
              status: t.status,
              latestProofStatus: t.payment.proofs[0]?.status ?? null,
            })}
          />
          {t.release?.pending && <PendingReleaseBadge />}
        </div>
        <div className="flex flex-wrap gap-2">
          {event.paymentMode === 'after_shortlist' && t.status === 'registered' && (
            <Button onClick={() => move.mutate('shortlist')} disabled={move.isPending}>
              Shortlist team
            </Button>
          )}
          {event.paymentMode === 'none' && t.status === 'registered' && (
            <Button onClick={() => move.mutate('confirm')} disabled={move.isPending}>
              Confirm team
            </Button>
          )}
          {t.release?.pending && (
            <ConfirmButton
              title={`Release ${t.name}'s result?`}
              description={`The team's portal shows "${t.status}" straight away. This can't be taken back.`}
              confirmLabel="Release"
              disabled={release.isPending}
              onConfirm={() => release.mutate({ stage: 'all', teamIds: [t.id] })}
            >
              <Send aria-hidden /> Release decision
            </ConfirmButton>
          )}
          {admin && <EditTeamDialog team={t} questions={teamFields(fields)} />}
          {leader &&
            (teamCancelled ? (
              <Button
                variant="outline"
                disabled={regAction.isPending}
                onClick={() => regAction.mutate({ id: leader.registrationId, action: 'restore' })}
              >
                <RotateCcw aria-hidden /> Restore registration
              </Button>
            ) : (
              <ConfirmButton
                variant="outline"
                title={`Cancel ${t.name}'s registration?`}
                description="The whole team is cancelled and its places free up. You can restore it later."
                confirmLabel="Cancel registration"
                destructive
                disabled={regAction.isPending}
                onConfirm={() => regAction.mutate({ id: leader.registrationId, action: 'cancel' })}
              >
                <Ban aria-hidden /> Cancel registration
              </ConfirmButton>
            ))}
          {admin && (
            <ConfirmButton
              variant="outline"
              title={`Delete ${t.name}?`}
              description={`This deletes the team and its ${t.members.length} ${
                t.members.length === 1 ? 'member' : 'members'
              } for good: registrations, check-ins, votes, receipts and scores. Their places free up. This can't be undone; to keep a record, cancel the team instead.`}
              confirmLabel="Delete team"
              destructive
              disabled={remove.isPending}
              onConfirm={() => remove.mutate()}
            >
              <Trash2 aria-hidden /> Delete team
            </ConfirmButton>
          )}
        </div>
      </div>
      <Decisions team={t} />
      {admin && <TeamTrack teamId={t.id} trackId={t.trackId} />}
      {t.belowMinimum && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Cancellations left this team below the minimum of {event.minTeamSize}. Decide whether it
            can still take part.
          </AlertDescription>
        </Alert>
      )}
      <AnswerList fields={teamFields(fields)} answers={t.answers} />
      <ErrorAlert
        error={
          move.error ??
          release.error ??
          regAction.error ??
          reissue.error ??
          rotateQr.error ??
          attach.error ??
          remove.error
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {t.members.length} {t.members.length === 1 ? 'person' : 'people'}
          </CardDescription>
          {admin &&
            t.status !== 'cancelled' &&
            t.members.filter((m) => m.status !== 'cancelled').length < event.maxTeamSize && (
              <CardAction>
                <AddMemberDialog team={t} questions={memberFields(fields)} />
              </CardAction>
            )}
        </CardHeader>
        <CardContent className="grid gap-3">
          {sentNote && (
            <Alert>
              <Send aria-hidden />
              <AlertDescription>{sentNote}</AlertDescription>
            </Alert>
          )}
          {newLink && (
            <Alert>
              <Link2 aria-hidden />
              <AlertTitle>New personal link for {newLink.name}</AlertTitle>
              <AlertDescription>
                {newLink.emailedTo
                  ? `Emailed to the team leader (${newLink.emailedTo}) to pass on. Also shown here once:`
                  : 'Shown once; send it to them.'}{' '}
                <code className="font-mono text-xs break-all text-foreground">
                  {newLink.url ?? newLink.token}
                </code>
              </AlertDescription>
            </Alert>
          )}
          <ul className="divide-y">
            {t.members.map((m) => (
              <li
                key={m.registrationId}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium wrap-anywhere">{m.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {m.participantCode}
                    </code>
                    {m.isLeader && <Badge variant="outline">leader</Badge>}
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="text-xs break-all text-muted-foreground">
                    {[
                      m.email,
                      m.phone,
                      m.linkLastUsedAt
                        ? `link last opened ${formatIST(m.linkLastUsedAt)}`
                        : 'link never opened',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <AnswerList fields={memberFields(fields)} answers={m.answers} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {admin && m.status !== 'cancelled' && <EditMemberDialog member={m} />}
                  {admin && m.status !== 'cancelled' && (
                    <SendLinkMenu member={m} onSent={setSentNote} />
                  )}
                  {admin && (
                    <>
                      <ConfirmButton
                        size="sm"
                        variant="outline"
                        title={`Give ${m.name} a new personal link?`}
                        description="Their current link stops working."
                        body={
                          features.mailing && (
                            <Field orientation="horizontal">
                              <Checkbox
                                id={`email-leader-${m.registrationId}`}
                                checked={emailLeader}
                                onCheckedChange={(c) => setEmailLeader(c === true)}
                              />
                              <FieldLabel
                                htmlFor={`email-leader-${m.registrationId}`}
                                className="font-normal"
                              >
                                Email it to the team leader to pass on
                              </FieldLabel>
                            </Field>
                          )
                        }
                        confirmLabel="New link"
                        onConfirm={() =>
                          reissue.mutate(
                            { id: m.registrationId, emailLeader: features.mailing && emailLeader },
                            { onSuccess: (link) => setNewLink({ name: m.name, ...link }) },
                          )
                        }
                      >
                        <Link2 aria-hidden /> New link
                      </ConfirmButton>
                      <ConfirmButton
                        size="sm"
                        variant="outline"
                        title={`Give ${m.name} a new QR code?`}
                        description="The old one stops scanning."
                        confirmLabel="New QR"
                        onConfirm={() => rotateQr.mutate(m.registrationId)}
                      >
                        <QrCode aria-hidden /> New QR
                      </ConfirmButton>
                    </>
                  )}
                  {/* A member cancelled on their own (e.g. removed by the leader) comes back
                      here; a cancelled team comes back as a whole, from the top. */}
                  {m.status === 'cancelled' && !teamCancelled && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => regAction.mutate({ id: m.registrationId, action: 'restore' })}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {t.assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>
              Participants see a list once it is released. Change them on{' '}
              <Link to="../../assignments" relative="path" className="underline underline-offset-4">
                Assignments
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              {t.assignments.map((a) => (
                <div key={a.listId} className="grid gap-0.5">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    {a.listName}
                    <Badge variant={a.released ? 'default' : 'secondary'}>
                      {a.released ? 'Released' : 'Hidden'}
                    </Badge>
                  </dt>
                  <dd className="font-medium">{a.option?.title ?? a.text}</dd>
                  {a.option?.description && (
                    <dd className="text-muted-foreground">{a.option.description}</dd>
                  )}
                  {a.assignedBy && (
                    <dd className="text-xs text-muted-foreground">
                      by {a.assignedBy.name}, {formatIST(a.assignedAt)}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
      {admin && event.paymentMode !== 'none' && t.status !== 'cancelled' && (
        <Card>
          <CardHeader>
            <CardTitle>Attach a receipt</CardTitle>
            <CardDescription>
              When the team paid but could not upload the receipt themselves.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              className="max-w-sm"
              aria-label="Receipt file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) attach.mutate(file);
                e.target.value = '';
              }}
            />
          </CardContent>
        </Card>
      )}
      {t.payment.proofs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            {t.payment.paidAmount !== null && (
              <p className="mb-3 text-sm font-medium">
                Paid {formatMoney(t.payment.paidAmount, t.payment.currency)}
              </p>
            )}
            {t.payment.paidAmount !== null && t.payment.unpaid.length > 0 && (
              <p className="mb-3 text-sm">
                Still to pay for {t.payment.unpaid.map((u) => u.name).join(', ')}:{' '}
                {formatMoney(t.payment.amountDue ?? 0, t.payment.currency)}, with another receipt.
              </p>
            )}
            <ul className="grid gap-2 text-sm">
              {t.payment.proofs.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                  {p.paidAmount !== null && p.paidAmount !== p.amount && (
                    <span className="tabular-nums">
                      (received {formatMoney(p.paidAmount, p.currency)})
                    </span>
                  )}
                  <span className="text-muted-foreground">uploaded {formatIST(p.uploadedAt)}</span>
                  <ProofStatusBadge status={p.status} />
                  {p.rejectionNote && (
                    <span className="text-muted-foreground">— {p.rejectionNote}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Who shortlisted and confirmed the team, so organisers sharing the list can see. */
function Decisions({ team }: { team: Schemas['Team'] }) {
  const lines = [
    ['Shortlisted', team.shortlistedBy],
    ['Confirmed', team.confirmedBy],
  ] as const;
  const shown = lines.filter(([, d]) => d);
  if (shown.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {shown
        .map(([what, d]) => `${what} by ${d!.name}${d!.at ? ` · ${formatIST(d!.at)}` : ''}`)
        .join('. ')}
    </p>
  );
}

/** Admin: the track the team competes in (shown once the event has tracks). */
function TeamTrack({ teamId, trackId }: { teamId: string; trackId: string | null }) {
  const api = useApi();
  const { event } = useEventContext();
  const tracks = useTracks();
  const set = useEventMutation(event.id, (id: string | null) =>
    unwrap(
      api.PUT('/v1/events/{eventId}/teams/{teamId}/track', {
        params: { path: { eventId: event.id, teamId } },
        body: { trackId: id },
      }),
    ),
  );
  if (!tracks.data?.length) return null;
  return (
    <Field className="max-w-xs">
      <FieldLabel htmlFor="team-track">Track</FieldLabel>
      <NativeSelect
        id="team-track"
        value={trackId ?? ''}
        disabled={set.isPending}
        onChange={(e) => set.mutate(e.target.value || null)}
      >
        <NativeSelectOption value="">No track</NativeSelectOption>
        {tracks.data.map((tr) => (
          <NativeSelectOption key={tr.id} value={tr.id}>
            {tr.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <ErrorAlert error={set.error} />
    </Field>
  );
}
