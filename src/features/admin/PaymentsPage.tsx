import { Eye, FileText, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FilterMenu } from '@/components/FilterMenu';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { ProofStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { useListFilter } from '@/hooks/useListFilter';
import { useSearchParam } from '@/hooks/useSearchParam';
import { formatIST } from '@/lib/datetime';
import { formatMoney, rupeesToPaise } from '@/lib/money';
import { useProofs } from './queries';

type Status = Schemas['PaymentProofStatus'];
type Proof = Schemas['PaymentProofForReview'];

const STATUSES = [
  ['pending', 'Waiting for review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
] as const;

const proofText = (p: Proof) => [p.team.name, p.uploadedBy.name, ...p.members.map((m) => m.name)];

/** Who a receipt pays for: the members' names, or how many when they aren't known. */
const payingFor = (p: Proof) =>
  p.members.length > 0
    ? p.members.map((m) => m.name).join(', ')
    : `${p.memberCount} ${p.memberCount === 1 ? 'person' : 'people'}`;

export function PaymentsPage() {
  const { event } = useEventContext();
  // In the address, like the other lists' filters.
  const [status, setStatus] = useSearchParam('status', 'pending');
  const proofs = useProofs(status as Status);
  const search = useListFilter(proofs.data ?? [], proofText);
  const [open, setOpen] = useState<Proof | null>(null);
  const list = search.filtered;
  const all = proofs.data ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader title="Payments" description="Receipts teams uploaded. You approve each one." />
      <div className="flex min-w-0 items-center gap-2">
        <SearchInput
          label="Search receipts"
          placeholder="Team or member"
          className="min-w-0 flex-1 sm:w-72 sm:flex-none"
          value={search.query}
          onChange={search.setQuery}
        />
        {/* Always one status picked, so the button always says which. */}
        <FilterMenu
          label="Show"
          value={status}
          onChange={setStatus}
          options={STATUSES}
          fallback=""
        />
      </div>
      {proofs.data && all.length > 0 && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {list.length === all.length
            ? `${all.length} ${all.length === 1 ? 'receipt' : 'receipts'}`
            : `${list.length} of ${all.length} receipts`}
        </p>
      )}
      <ErrorAlert error={proofs.error} />
      {proofs.isPending && <TableSkeleton cols={5} />}
      {proofs.data && list.length === 0 && (
        <EmptyState
          icon={Receipt}
          title={
            search.active
              ? 'No receipt matches.'
              : status === 'pending'
                ? 'Nothing waiting for review.'
                : 'Nothing here.'
          }
        />
      )}
      {list.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell">For</TableHead>
                <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead>
                  <span className="sr-only">Receipt</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-normal">
                    <Link
                      to={`/events/${event.id}/teams/${p.team.id}`}
                      className="font-medium wrap-anywhere hover:underline"
                    >
                      {p.team.name}
                    </Link>
                    {/* What the hidden columns hold, on small screens. */}
                    <div className="text-xs text-muted-foreground lg:hidden">
                      {formatIST(p.uploadedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(p.amount, p.currency)}
                    {p.paidAmount !== null && p.paidAmount !== p.amount && (
                      <div className="text-xs text-muted-foreground">
                        received {formatMoney(p.paidAmount, p.currency)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-64 whitespace-normal text-muted-foreground md:table-cell">
                    {payingFor(p)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {formatIST(p.uploadedAt)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <ProofStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={p.status === 'pending' ? 'default' : 'outline'}
                      onClick={() => setOpen(p)}
                      aria-label={`View receipt from ${p.team.name}`}
                    >
                      <Eye aria-hidden />
                      <span className="hidden xl:inline">View receipt</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {open && <ReceiptDialog proof={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One receipt, large, with what it's for; pending ones are approved or rejected here. */
function ReceiptDialog({ proof, onClose }: { proof: Proof; onClose: () => void }) {
  const api = useApi();
  const { event } = useEventContext();
  const [rejecting, setRejecting] = useState(false);
  // Approving can't be undone: one more "are you sure?" after typing the amount.
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
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
  const pending = proof.status === 'pending';
  // A receipt confirms the people it pays for: the team, or only those who
  // joined after it paid (a top-up).
  const whoItConfirms = payingFor(proof);
  const places = proof.memberCount === 1 ? 'a place' : 'their places';
  const busy = approve.isPending || reject.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 wrap-anywhere">
            {proof.team.name}
            <ProofStatusBadge status={proof.status} />
          </DialogTitle>
          <DialogDescription>
            {formatMoney(proof.amount, proof.currency)} for {payingFor(proof)} · uploaded by{' '}
            {proof.uploadedBy.name}, {formatIST(proof.uploadedAt)}
            {proof.paidAmount !== null && (
              <> · received {formatMoney(proof.paidAmount, proof.currency)}</>
            )}
          </DialogDescription>
        </DialogHeader>
        {isImage ? (
          <a href={proof.receiptUrl} target="_blank" rel="noreferrer" className="block">
            <img
              src={proof.receiptUrl}
              alt={`Receipt from ${proof.team.name}`}
              className="mx-auto max-h-[55dvh] rounded-md border object-contain"
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
        {pending &&
          (rejecting ? (
            <Field>
              <FieldLabel htmlFor={`reject-${proof.id}`}>Reason for rejecting</FieldLabel>
              <Textarea
                id={`reject-${proof.id}`}
                placeholder="Tell the team what is wrong, e.g. the amount does not match."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor={`received-${proof.id}`}>Amount received (₹)</FieldLabel>
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
              <FieldDescription>
                What the receipt shows was paid. Approving confirms {whoItConfirms} and takes up{' '}
                {places}; it can&apos;t be undone.
              </FieldDescription>
            </Field>
          ))}
        {pending && (
          <DialogFooter className="gap-2">
            {rejecting ? (
              <>
                <Button variant="ghost" onClick={() => setRejecting(false)}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  disabled={!note.trim() || busy}
                  onClick={() => reject.mutate(undefined, { onSuccess: onClose })}
                >
                  Reject with note
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                  Reject
                </Button>
                <Button disabled={!validAmount || busy} onClick={() => setConfirming(true)}>
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        )}
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={`Approve ${validAmount ? formatMoney(paidAmount, proof.currency) : 'this receipt'} from ${proof.team.name}?`}
          description={`Confirms ${whoItConfirms} and takes up ${places}. This can't be undone.`}
          confirmLabel="Approve"
          confirmDisabled={busy}
          onConfirm={() => approve.mutate(undefined, { onSuccess: onClose })}
        />
      </DialogContent>
    </Dialog>
  );
}
