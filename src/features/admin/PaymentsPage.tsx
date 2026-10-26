import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { useProofs } from './queries';

type Status = Schemas['PaymentProofStatus'];

export function PaymentsPage() {
  const [status, setStatus] = useState<Status>('pending');
  const proofs = useProofs(status);

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="proof-status" className="text-sm">
          Show
        </label>
        <Select
          id="proof-status"
          className="w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          <option value="pending">Waiting for review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>
      <ErrorAlert error={proofs.error} />
      {proofs.data?.length === 0 && <p className="text-muted-foreground">Nothing here.</p>}
      {proofs.data?.map((p) => (
        <ProofCard key={p.id} proof={p} />
      ))}
    </div>
  );
}

function ProofCard({ proof }: { proof: Schemas['PaymentProofForReview'] }) {
  const api = useApi();
  const { event } = useEventContext();
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const p = { params: { path: { eventId: event.id, proofId: proof.id } } };
  const approve = useEventMutation(event.id, () =>
    unwrap(api.POST('/v1/events/{eventId}/payment-proofs/{proofId}/approve', p)),
  );
  const reject = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/payment-proofs/{proofId}/reject', { ...p, body: { note } }),
    ),
  );
  // Keys end in the file's real extension (checked by the API on upload).
  const isImage = !new URL(proof.receiptUrl).pathname.endsWith('.pdf');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{proof.team.name}</CardTitle>
        <CardDescription>
          {formatMoney(proof.amount, proof.currency)} for {proof.memberCount}{' '}
          {proof.memberCount === 1 ? 'person' : 'people'} · uploaded by {proof.uploadedBy.name},{' '}
          {formatIST(proof.uploadedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isImage ? (
          <a href={proof.receiptUrl} target="_blank" rel="noreferrer">
            <img
              src={proof.receiptUrl}
              alt={`Receipt from ${proof.team.name}`}
              className="max-h-80 rounded border"
            />
          </a>
        ) : (
          <a className="underline" href={proof.receiptUrl} target="_blank" rel="noreferrer">
            Open receipt (PDF)
          </a>
        )}
        {proof.rejectionNote && <p className="text-sm">Rejected: {proof.rejectionNote}</p>}
        <ErrorAlert error={approve.error ?? reject.error} />
        {proof.status === 'pending' && (
          <div className="grid gap-2">
            {rejecting && (
              <Textarea
                aria-label="Reason for rejecting"
                placeholder="Tell the team what is wrong, e.g. the amount does not match."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button onClick={() => approve.mutate(undefined)} disabled={approve.isPending}>
                Approve
              </Button>
              {rejecting ? (
                <Button
                  variant="destructive"
                  disabled={!note.trim() || reject.isPending}
                  onClick={() => reject.mutate(undefined)}
                >
                  Reject with note
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setRejecting(true)}>
                  Reject
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
