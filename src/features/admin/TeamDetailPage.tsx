import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { unwrap } from '@/api/client';
import { uploadFile } from '@/api/upload';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const attach = useEventMutation(event.id, async (file: File) => {
    const receiptKey = await uploadFile(api, event.id, 'receipt', file, fetch, teamId);
    return unwrap(
      api.POST('/v1/events/{eventId}/teams/{teamId}/payment-proofs', {
        ...params,
        body: { receiptKey },
      }),
    );
  });

  if (team.isPending) return <p className="text-muted-foreground">Loading…</p>;
  if (team.isError) return <ErrorAlert error={team.error} />;
  const t = team.data;

  return (
    <div className="grid gap-4">
      <Link to=".." relative="path" className="text-sm underline">
        ← All teams
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{t.name}</h2>
        <StatusBadge
          status={teamDisplayStatus({
            status: t.status,
            latestProofStatus: t.payment.proofs[0]?.status ?? null,
          })}
        />
      </div>
      {t.belowMinimum && (
        <Alert variant="destructive">
          Cancellations left this team below the minimum of {event.minTeamSize}. Decide whether it
          can still take part.
        </Alert>
      )}
      <AnswerList fields={teamFields(fields)} answers={t.answers} />
      <ErrorAlert
        error={move.error ?? regAction.error ?? reissue.error ?? rotateQr.error ?? attach.error}
      />
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
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {newLink && (
            <Alert className="mb-3">
              New personal link for {newLink.name} (shown once; send it to them):{' '}
              <span className="break-all font-mono text-xs">{newLink.url ?? newLink.token}</span>
            </Alert>
          )}
          <ul className="grid gap-3">
            {t.members.map((m) => (
              <li
                key={m.registrationId}
                className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0"
              >
                <span>
                  <span className="font-medium">{m.name}</span>{' '}
                  <span className="font-mono text-xs">{m.participantCode}</span>
                  {m.isLeader && <span className="ml-1 text-xs">(leader)</span>}
                  <div className="text-xs text-muted-foreground">
                    {m.email} · {m.phone} ·{' '}
                    {m.linkLastUsedAt
                      ? `link last opened ${formatIST(m.linkLastUsedAt)}`
                      : 'link never opened'}
                  </div>
                  <AnswerList fields={memberFields(fields)} answers={m.answers} />
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={m.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Give ${m.name} a new personal link? Their current link stops working.`,
                        )
                      ) {
                        reissue.mutate(m.registrationId, {
                          onSuccess: (link) => setNewLink({ name: m.name, ...link }),
                        });
                      }
                    }}
                  >
                    New link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm(`Give ${m.name} a new QR code? The old one stops scanning.`)
                      )
                        rotateQr.mutate(m.registrationId);
                    }}
                  >
                    New QR
                  </Button>
                  {m.status === 'cancelled' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => regAction.mutate({ id: m.registrationId, action: 'restore' })}
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const whole = m.isLeader
                          ? ' This is the leader: the whole team will be cancelled.'
                          : '';
                        if (window.confirm(`Cancel ${m.name}'s registration?${whole}`)) {
                          regAction.mutate({ id: m.registrationId, action: 'cancel' });
                        }
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {event.paymentMode !== 'none' && t.status !== 'cancelled' && (
        <Card>
          <CardHeader>
            <CardTitle>Attach a receipt</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="text-muted-foreground">
              When the team paid but could not upload the receipt themselves.
            </p>
            <input
              type="file"
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
                <li key={p.id}>
                  {formatMoney(p.amount, p.currency)} · uploaded {formatIST(p.uploadedAt)} ·{' '}
                  <span className="capitalize">{p.status}</span>
                  {p.rejectionNote && (
                    <span className="text-muted-foreground"> — {p.rejectionNote}</span>
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
