import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert, Link2, QrCode, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { unwrap } from '@/api/client';
import { uploadFile } from '@/api/upload';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Loading } from '@/components/PageState';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { AnswerList } from '@/features/fields/FieldInputs';
import { memberFields, teamFields } from '@/features/fields/fields';
import { useFields } from '@/features/fields/queries';
import { formatIST } from '@/lib/datetime';
import { teamDisplayStatus } from '@/lib/status';
import { formatMoney } from '@/lib/money';

export function TeamDetailPage() {
  const { teamId = '' } = useParams();
  const api = useApi();
  const { event } = useEventContext();
  const params = { params: { path: { eventId: event.id, teamId } } };
  const fields = useFields().data ?? [];
  const [newLink, setNewLink] = useState<{
    name: string;
    token: string;
    url: string | null;
  } | null>(null);
  const team = useQuery({
    queryKey: ['event', event.id, 'team', teamId],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/teams/{teamId}', params)),
  });

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
  const reissue = useEventMutation(event.id, (id: string) =>
    unwrap(api.POST('/v1/events/{eventId}/registrations/{registrationId}/reissue-link', reg(id))),
  );
  const rotateQr = useEventMutation(event.id, (id: string) =>
    unwrap(api.POST('/v1/events/{eventId}/registrations/{registrationId}/rotate-qr', reg(id))),
  );
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

  if (team.isPending) return <Loading />;
  if (team.isError) return <ErrorAlert error={team.error} />;
  const t = team.data;

  return (
    <div className="grid gap-4">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <Link to=".." relative="path">
          <ArrowLeft aria-hidden /> All teams
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t.name}</h2>
          <StatusBadge
            status={teamDisplayStatus({
              status: t.status,
              latestProofStatus: t.payment.proofs[0]?.status ?? null,
            })}
          />
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
        </div>
      </div>
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
        </CardHeader>
        <CardContent className="grid gap-3">
          {newLink && (
            <Alert>
              <Link2 aria-hidden />
              <AlertTitle>New personal link for {newLink.name}</AlertTitle>
              <AlertDescription>
                Shown once; send it to them.{' '}
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
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {m.participantCode}
                    </code>
                    {m.isLeader && <Badge variant="outline">leader</Badge>}
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
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
                  <ConfirmButton
                    size="sm"
                    variant="outline"
                    title={`Give ${m.name} a new personal link?`}
                    description="Their current link stops working."
                    confirmLabel="New link"
                    onConfirm={() =>
                      reissue.mutate(m.registrationId, {
                        onSuccess: (link) => setNewLink({ name: m.name, ...link }),
                      })
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
                  {m.status === 'cancelled' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => regAction.mutate({ id: m.registrationId, action: 'restore' })}
                    >
                      Restore
                    </Button>
                  ) : (
                    <ConfirmButton
                      size="sm"
                      variant="outline"
                      title={`Cancel ${m.name}'s registration?`}
                      description={
                        m.isLeader
                          ? 'This is the leader: the whole team will be cancelled.'
                          : undefined
                      }
                      confirmLabel="Cancel registration"
                      destructive
                      onConfirm={() => regAction.mutate({ id: m.registrationId, action: 'cancel' })}
                    >
                      Cancel
                    </ConfirmButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {event.paymentMode !== 'none' && t.status !== 'cancelled' && (
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
              accept="image/jpeg,image/png,image/webp,application/pdf"
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
            <ul className="grid gap-2 text-sm">
              {t.payment.proofs.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                  <span className="text-muted-foreground">uploaded {formatIST(p.uploadedAt)}</span>
                  <Badge
                    variant={p.status === 'rejected' ? 'destructive' : 'secondary'}
                    className="capitalize"
                  >
                    {p.status}
                  </Badge>
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
