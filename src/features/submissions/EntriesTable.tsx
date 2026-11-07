import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Fragment, useState } from 'react';
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
import { answerText } from '@/features/fields/fields';
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

/** Who has submitted, when, and (expandable) what they answered. */
export function EntriesTable({ submission }: { submission: Submission }) {
  const { event } = useEventContext();
  const entries = useEntries(submission.id);
  const search = useListFilter(entries.data ?? [], entryText);
  const [open, setOpen] = useState<string | null>(null);
  const fields = [...submission.fields].sort((a, b) => a.position - b.position);
  const exportCsv = () =>
    download(
      `${slug(event.name)}-${slug(submission.title)}.csv`,
      entriesCsv({ ...submission, fields }, entries.data ?? []),
    );
  return (
    <section aria-label="Entries" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Entries</h3>
        {entries.data && entries.data.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <SearchInput
              label="Search entries"
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
          Deadline {formatIST(submission.deadline)}. Entries last saved after it are marked late.
        </p>
      )}
      <ErrorAlert error={entries.error} />
      {entries.isPending && <TableSkeleton rows={3} cols={3} />}
      {entries.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No team has submitted yet.</p>
      )}
      {search.active && search.filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No entry matches.</p>
      )}
      {search.filtered.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead className="hidden sm:table-cell">First submitted</TableHead>
              <TableHead>Last saved</TableHead>
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
                    </Button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatIST(e.createdAt)}</TableCell>
                  <TableCell className="whitespace-normal">
                    {formatIST(e.updatedAt)}
                    {e.late && (
                      <Badge variant="destructive" className="ml-2">
                        Late
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
                {open === e.id && (
                  <TableRow>
                    <TableCell colSpan={3} className="whitespace-normal">
                      <dl className="grid gap-2 text-sm">
                        {e.submittedBy && (
                          <p className="text-muted-foreground">
                            Saved last by {e.submittedBy.name}
                          </p>
                        )}
                        {fields.map((f) => (
                          <div key={f.id}>
                            <dt className="text-muted-foreground">{f.label}</dt>
                            <dd className="wrap-anywhere whitespace-pre-wrap">
                              {e.answers[f.id] === undefined
                                ? '–'
                                : answerText(e.answers[f.id], f.type)}
                            </dd>
                          </div>
                        ))}
                      </dl>
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
