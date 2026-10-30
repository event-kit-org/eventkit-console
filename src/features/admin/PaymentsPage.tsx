import { FileText, Receipt } from 'lucide-react';
import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { CardsSkeleton, EmptyState } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { useProofs } from './queries';

type Status = Schemas['PaymentProofStatus'];

const TABS: [Status, string][] = [
  ['pending', 'Waiting for review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];

export function PaymentsPage() {
  const [status, setStatus] = useState<Status>('pending');
  const proofs = useProofs(status);

  return (
    <div className="grid gap-4">
      <PageHeader title="Payments" description="Receipts teams uploaded. You approve each one." />
      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
        <TabsList aria-label="Show">
          {TABS.map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ErrorAlert error={proofs.error} />
      {proofs.isPending && <CardsSkeleton />}
      {proofs.data?.length === 0 && <EmptyState icon={Receipt} title="Nothing here." />}
      <div className="grid gap-4 lg:grid-cols-2">
        {proofs.data?.map((p) => (
          <ProofCard key={p.id} proof={p} />
        ))}
      </div>
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
        {proof.status !== 'pending' && (
          <CardAction>
            <Badge
              variant={proof.status === 'rejected' ? 'destructive' : 'secondary'}
              className="capitalize"
            >
              {proof.status}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        {isImage ? (
          <a href={proof.receiptUrl} target="_blank" rel="noreferrer" className="w-fit">
            <img
              src={proof.receiptUrl}
              alt={`Receipt from ${proof.team.name}`}
              className="max-h-80 rounded-md border object-contain"
            />
          </a>
        ) : (
          <Button variant="outline" className="w-fit" asChild>
            <a href={proof.receiptUrl} target="_blank" rel="noreferrer">
              <FileText aria-hidden /> Open receipt (PDF)
            </a>
          </Button>
        )}
        {proof.rejectionNote && <p className="text-sm">Rejected: {proof.rejectionNote}</p>}
        <ErrorAlert error={approve.error ?? reject.error} />
        {proof.status === 'pending' && rejecting && (
          <Textarea
            aria-label="Reason for rejecting"
            placeholder="Tell the team what is wrong, e.g. the amount does not match."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </CardContent>
      {proof.status === 'pending' && (
        <CardFooter className="gap-2">
          <Button onClick={() => approve.mutate(undefined)} disabled={approve.isPending}>
            Approve
          </Button>
          {rejecting ? (
            <>
              <Button
                variant="destructive"
                disabled={!note.trim() || reject.isPending}
                onClick={() => reject.mutate(undefined)}
              >
                Reject with note
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
