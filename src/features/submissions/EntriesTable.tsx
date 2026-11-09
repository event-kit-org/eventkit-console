import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { TableSkeleton } from '@/components/PageState';
import { Pager, usePage } from '@/components/Pager';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { download, slug } from '@/features/admin/teams-csv';
import { useEventContext } from '@/features/events/event-context';
import { AnswerValue } from '@/features/fields/AnswerValue';
import { answerText } from '@/features/fields/fields';
import { useEventMutation } from '@/hooks/useEventMutation';
import { useListFilter } from '@/hooks/useListFilter';
import { formatIST } from '@/lib/datetime';
import { entriesCsv } from './entries-csv';
import { type Submission, useEntries } from './queries';

type Entry = NonNullable<ReturnType<typeof useEntries>['data']>[number];

/** An entry is found by its team, who saved it, or any answer. */
const entryText = (e: Entry) => [
  e.team.name,
  e.submittedBy?.name,
  ...Object.values(e.answers).map((v) => answerText(v)),
];

/** Every response teams sent, when, and (expandable) what they answered. */
export function EntriesTable({ submission }: { submission: Submission }) {
  const api = useApi();
  const { event, role } = useEventContext();
  const entries = useEntries(submission.id);
  // Deleting a response sent by mistake lets the team send it again.
  const remove = useEventMutation(event.id, (entryId: string) =>
    unwrap(
      api.DELETE('/v1/events/{eventId}/submissions/{submissionId}/entries/{entryId}', {
        params: { path: { eventId: event.id, submissionId: submission.id, entryId } },
      }),
    ),
  );
  // How many responses each team sent, to number them.
  const perTeam = new Map<string, number>();
  for (const e of entries.data ?? []) perTeam.set(e.team.id, (perTeam.get(e.team.id) ?? 0) + 1);
  const seen = new Map<string, number>();
  const number = new Map(
    (entries.data ?? []).map((e) => {
      const n = (seen.get(e.team.id) ?? 0) + 1;
      seen.set(e.team.id, n);
      // Each team's newest comes first: the newest is its highest number.
      return [e.id, perTeam.get(e.team.id)! - n + 1];
    }),
  );
  const search = useListFilter(entries.data ?? [], entryText);
  const page = usePage(search.filtered);
  const [openId, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const open = entries.data?.find((e) => e.id === openId) ?? null;
  const fields = [...submission.fields].sort((a, b) => a.position - b.position);
  const exportCsv = () =>
    download(
      `${slug(event.name)}-${slug(submission.title)}.csv`,
      entriesCsv({ ...submission, fields }, entries.data ?? []),
    );
  const label = (e: Entry) =>
    perTeam.get(e.team.id)! > 1 ? `${e.team.name} #${number.get(e.id)}` : e.team.name;
  return (
    <section aria-label="Responses" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Responses</h3>
        {entries.data && entries.data.length > 0 && (
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <SearchInput
              label="Search responses"
              placeholder="Team or answer"
              className="min-w-0 flex-1 sm:w-64 sm:flex-none"
              value={search.query}
              onChange={search.setQuery}
            />
            <Button variant="outline" onClick={exportCsv} aria-label="Download CSV">
              <Download aria-hidden />
              <span className="hidden sm:inline">Download CSV</span>
            </Button>
          </div>
        )}
      </div>
      {submission.deadline && (
        <p className="text-sm text-muted-foreground">
          Deadline {formatIST(submission.deadline)}. Responses sent after it are marked late.
        </p>
      )}
      <ErrorAlert error={entries.error ?? remove.error} />
      {entries.isPending && <TableSkeleton rows={3} cols={3} />}
      {entries.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No team has submitted yet.</p>
      )}
      {search.active && search.filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No response matches.</p>
      )}
      {page.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label="Responses">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="hidden sm:table-cell">Sent by</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((e) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer"
                  onClick={(ev) => {
                    if ((ev.target as HTMLElement).closest('button')) return;
                    setOpen(e.id);
                  }}
                >
                  <TableCell className="whitespace-normal">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-left whitespace-normal text-foreground"
                      aria-label={`Answers from ${label(e)}`}
                      onClick={() => setOpen(e.id)}
                    >
                      {label(e)}
                    </Button>
                  </TableCell>
                  <TableCell className="hidden whitespace-normal text-muted-foreground wrap-anywhere sm:table-cell">
                    {e.submittedBy?.name ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {formatIST(e.createdAt)}
                    {e.late && (
                      <Badge variant="destructive" className="ml-2">
                        Late
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager {...page} />
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 wrap-anywhere">
                {label(open)}
                {open.late && <Badge variant="destructive">Late</Badge>}
              </DialogTitle>
              <DialogDescription>
                Sent {formatIST(open.createdAt)}
                {open.submittedBy && <> by {open.submittedBy.name}</>}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid gap-3 text-sm">
              {fields.map((f) => (
                <div key={f.id} className="grid gap-0.5">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0">
                    <AnswerValue type={f.type} value={open.answers[f.id]} />
                  </dd>
                </div>
              ))}
            </dl>
            {role === 'admin' && (
              <DialogFooter>
                <Button
                  variant="outline"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={() => setDeleting(open)}
                >
                  <Trash2 aria-hidden /> Delete response
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete this response from ${deleting?.team.name}?`}
        description="Its answers go, so the team can submit again (for example after sending wrong details). This can't be undone."
        confirmLabel="Delete response"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          setOpen(null);
          remove.mutate(deleting.id);
        }}
      />
    </section>
  );
}
