import { ChevronDown, ChevronRight, Download, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { TableSkeleton } from '@/components/PageState';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
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
  const [open, setOpen] = useState<string | null>(null);
  const fields = [...submission.fields].sort((a, b) => a.position - b.position);
  const exportCsv = () =>
    download(
      `${slug(event.name)}-${slug(submission.title)}.csv`,
      entriesCsv({ ...submission, fields }, entries.data ?? []),
    );
  return (
    <section aria-label="Responses" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Responses</h3>
        {entries.data && entries.data.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <SearchInput
              label="Search responses"
              placeholder="Team or answer"
              value={search.query}
              onChange={search.setQuery}
            />
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download aria-hidden /> Download CSV
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
      {search.filtered.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {search.filtered.map((e) => (
              <Fragment key={e.id}>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto min-h-8 justify-start text-left whitespace-normal"
                      aria-expanded={open === e.id}
                      aria-label={`Answers from ${e.team.name}`}
                      onClick={() => setOpen(open === e.id ? null : e.id)}
                    >
                      {open === e.id ? <ChevronDown /> : <ChevronRight />}
                      {e.team.name}
                      {perTeam.get(e.team.id)! > 1 && (
                        <span className="text-muted-foreground">#{number.get(e.id)}</span>
                      )}
                    </Button>
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
                {open === e.id && (
                  <TableRow>
                    <TableCell colSpan={2} className="whitespace-normal">
                      <div className="grid gap-3 text-sm">
                        <dl className="grid gap-2">
                          {e.submittedBy && (
                            <p className="text-muted-foreground">Sent by {e.submittedBy.name}</p>
                          )}
                          {fields.map((f) => (
                            <div key={f.id} className="grid gap-0.5">
                              <dt className="text-muted-foreground">{f.label}</dt>
                              <dd className="min-w-0">
                                <AnswerValue type={f.type} value={e.answers[f.id]} />
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {role === 'admin' && (
                          <ConfirmButton
                            variant="outline"
                            size="sm"
                            className="justify-self-start"
                            title={`Delete this response from ${e.team.name}?`}
                            description="Its answers go, so the team can submit again (for example after sending wrong details). This can't be undone."
                            confirmLabel="Delete response"
                            destructive
                            disabled={remove.isPending}
                            onConfirm={() => {
                              setOpen(null);
                              remove.mutate(e.id);
                            }}
                          >
                            <Trash2 aria-hidden /> Delete response
                          </ConfirmButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
