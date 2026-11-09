import { FileText, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { CardsSkeleton, EmptyState } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { useListFilter } from '@/hooks/useListFilter';
import { formatIST } from '@/lib/datetime';
import { formatMoney, rupeesToPaise } from '@/lib/money';
import { useProofs } from './queries';

type Status = Schemas['PaymentProofStatus'];

const TABS: [Status, string][] = [
  ['pending', 'Waiting for review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];

type Proof = Schemas['PaymentProofForReview'];
const proofText = (p: Proof) => [p.team.name, p.uploadedBy.name, ...p.members.map((m) => m.name)];

export function PaymentsPage() {
  const [status, setStatus] = useState<Status>('pending');
  const proofs = useProofs(status);
  const search = useListFilter(proofs.data ?? [], proofText);

  return (
    <div className="grid gap-4">
      <PageHeader title="Payments" description="Receipts teams uploaded. You approve each one." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={status}
          onValueChange={(v) => setStatus(v as Status)}
          className="w-full sm:w-auto"
        >
          <TabsList aria-label="Show" className="w-full sm:w-fit">
            {TABS.map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="min-w-0 flex-1 sm:flex-none">
                <span className="truncate">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchInput
          label="Search receipts"
          placeholder="Team or member"
          value={search.query}
          onChange={search.setQuery}
        />
      </div>
      <ErrorAlert error={proofs.error} />
      {proofs.isPending && <CardsSkeleton />}
      {proofs.data && search.filtered.length === 0 && (
        <EmptyState
          icon={Receipt}
          title={search.active ? 'No receipt matches.' : 'Nothing here.'}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {search.filtered.map((p) => (
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
  // Typed from the receipt: what teams are charged can differ from the event's fee.
  const [received, setReceived] = useState('');
  const paidAmount = received.trim() === '' ? NaN : rupeesToPaise(Number(received));
  const validAmount = Number.isFinite(paidAmount) && paidAmount >= 0;
  const p = { params: { path: { eventId: event.id, proofId: proof.id } } };
  const approve = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/payment-proofs/{proofId}/approve', {
        ...p,
        body: { paidAmount },
      }),
    ),
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
        <CardTitle>
          <Link
            to={`/events/${event.id}/teams/${proof.team.id}`}
            className="wrap-anywhere underline-offset-4 hover:underline"
          >
            {proof.team.name}
          </Link>
        </CardTitle>
        <CardDescription>
          {formatMoney(proof.amount, proof.currency)} for{' '}
          {proof.members.length > 0
            ? proof.members.map((m) => m.name).join(', ')
            : `${proof.memberCount} ${proof.memberCount === 1 ? 'person' : 'people'}`}{' '}
          · uploaded by {proof.uploadedBy.name}, {formatIST(proof.uploadedAt)}
          {proof.paidAmount !== null && (
            <> · received {formatMoney(proof.paidAmount, proof.currency)}</>
          )}
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
          <ConfirmButton
            title="Approve this receipt?"
            description={`Enter what the receipt shows was paid. ${proof.team.name} will be confirmed and take up a place. This cannot be undone.`}
            confirmLabel="Approve"
            body={
              <div className="grid gap-2">
                <Label htmlFor={`received-${proof.id}`}>Amount received (₹)</Label>
                <Input
                  id={`received-${proof.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="max-w-40"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
              </div>
            }
            confirmDisabled={!validAmount}
            onConfirm={() => approve.mutate(undefined)}
            disabled={approve.isPending}
          >
            Approve
          </ConfirmButton>
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
