import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { TableSkeleton } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatIST } from '@/lib/datetime';
import { type Submission, useEntries } from './queries';

/** Who has submitted, when, and (expandable) what they answered. */
export function EntriesTable({ submission }: { submission: Submission }) {
  const entries = useEntries(submission.id);
  const [open, setOpen] = useState<string | null>(null);
  const fields = [...submission.fields].sort((a, b) => a.position - b.position);
  return (
    <section aria-label="Entries" className="grid gap-3">
      <h3 className="font-medium">Entries</h3>
      <ErrorAlert error={entries.error} />
      {entries.isPending && <TableSkeleton rows={3} cols={3} />}
      {entries.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No team has submitted yet.</p>
      )}
      {entries.data && entries.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.data.map((e) => (
              <Fragment key={e.id}>
                <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={open === e.id}
                      aria-label={`Answers from ${e.team.name}`}
                      onClick={() => setOpen(open === e.id ? null : e.id)}
                    >
                      {open === e.id ? <ChevronDown /> : <ChevronRight />}
                      {e.team.name}
                    </Button>
                  </TableCell>
                  <TableCell>{formatIST(e.createdAt)}</TableCell>
                  <TableCell>{formatIST(e.updatedAt)}</TableCell>
                </TableRow>
                {open === e.id && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <dl className="grid gap-2 text-sm">
                        {e.submittedBy && (
                          <p className="text-muted-foreground">
                            Saved last by {e.submittedBy.name}
                          </p>
                        )}
                        {fields.map((f) => (
                          <div key={f.id}>
                            <dt className="text-muted-foreground">{f.label}</dt>
                            <dd className="whitespace-pre-wrap">
                              {e.answers[f.id] === undefined ? '–' : String(e.answers[f.id])}
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
