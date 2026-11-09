import { Copy, Download, Ellipsis, FileUp, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FilterMenu } from '@/components/FilterMenu';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, TableSkeleton } from '@/components/PageState';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
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
import { PhaseBadge, useRounds } from '@/features/judging/rounds';
import { useEventMutation } from '@/hooks/useEventMutation';
import { useListFilter } from '@/hooks/useListFilter';
import { useSearchParam } from '@/hooks/useSearchParam';
import { formatIST, fromISTInput } from '@/lib/datetime';
import { type Submission, useSubmissions } from './queries';
import { useRoundExport } from './round-export';

const submissionText = (s: Submission) => [s.title, s.round.name, s.description];

/**
 * Admin: what teams submit in each round (a project link, a deck...), as a
 * table. A row opens the submission; its ⋯ holds the rest.
 */
export function SubmissionsPage() {
  const api = useApi();
  const { event } = useEventContext();
  const navigate = useNavigate();
  const rounds = useRounds();
  const submissions = useSubmissions();
  const [round, setRound] = useSearchParam('round', '');
  const inRound = useMemo(
    () => (submissions.data ?? []).filter((s) => !round || s.round.id === round),
    [submissions.data, round],
  );
  const search = useListFilter(inRound, submissionText);
  const page = usePage(search.filtered);
  const [deleting, setDeleting] = useState<Submission | null>(null);
  const params = (submissionId: string) => ({
    params: { path: { eventId: event.id, submissionId } },
  });
  const duplicate = useEventMutation(event.id, (id: string) =>
    unwrap(api.POST('/v1/events/{eventId}/submissions/{submissionId}/duplicate', params(id))),
  );
  const remove = useEventMutation(event.id, (id: string) =>
    unwrap(api.DELETE('/v1/events/{eventId}/submissions/{submissionId}', params(id))),
  );
  const exportRound = useRoundExport();
  const loading = rounds.isPending || submissions.isPending;
  const all = submissions.data ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Submissions"
        description="What teams hand in during each round. Participants see a round's submissions once the round is released."
      >
        {rounds.data && rounds.data.length > 0 && <CreateDialog />}
      </PageHeader>
      {all.length > 0 && (
        <div className="flex min-w-0 items-center gap-2">
          <SearchInput
            label="Search submissions"
            placeholder="Title or round"
            className="min-w-0 flex-1 sm:w-72 sm:flex-none"
            value={search.query}
            onChange={search.setQuery}
          />
          <FilterMenu
            value={round}
            onChange={setRound}
            fallback=""
            options={[
              ['', 'All rounds'],
              ...(rounds.data ?? []).map((r) => [r.id, r.name] as const),
            ]}
          />
        </div>
      )}
      <ErrorAlert
        error={
          rounds.error ?? submissions.error ?? duplicate.error ?? remove.error ?? exportRound.error
        }
      />
      {loading && <TableSkeleton cols={4} />}
      {rounds.data?.length === 0 && (
        <EmptyState icon={FileUp} title="No rounds yet">
          Add a round on the Judging page first; every submission belongs to a round.
        </EmptyState>
      )}
      {rounds.data &&
        rounds.data.length > 0 &&
        submissions.data &&
        search.filtered.length === 0 && (
          <EmptyState
            icon={FileUp}
            title={all.length === 0 ? 'No submissions yet' : 'No submission matches.'}
          >
            {all.length === 0 && 'Create one for teams to hand in their work.'}
          </EmptyState>
        )}
      {page.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label="Submissions">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Submission</TableHead>
                <TableHead className="hidden md:table-cell">Round</TableHead>
                <TableHead className="text-right">Responses</TableHead>
                <TableHead className="hidden sm:table-cell">Due</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    // The title link and the ⋯ menu handle their own clicks.
                    if ((e.target as HTMLElement).closest('a,button,[role=menu]')) return;
                    void navigate(s.id);
                  }}
                >
                  <TableCell className="whitespace-normal">
                    <Link to={s.id} className="font-medium wrap-anywhere hover:underline">
                      {s.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {s.fields.length} {s.fields.length === 1 ? 'question' : 'questions'}
                      <span className="md:hidden"> · {s.round.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-normal md:table-cell">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="wrap-anywhere">{s.round.name}</span>
                      <PhaseBadge phase={s.round.phase} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.entryCount}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {s.deadline ? formatIST(s.deadline) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={`More for ${s.title}`}>
                          <Ellipsis aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuItem
                          disabled={duplicate.isPending}
                          onSelect={() => duplicate.mutate(s.id)}
                        >
                          <Copy aria-hidden /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={exportRound.isPending}
                          onSelect={() => exportRound.mutate(s.round)}
                        >
                          <Download aria-hidden /> Download {s.round.name} (CSV)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(s)}>
                          <Trash2 aria-hidden /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager {...page} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.title}"?`}
        description="A submission teams have already answered can't be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function CreateDialog() {
  const api = useApi();
  const { event, path } = useEventContext();
  const rounds = useRounds();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roundId, setRoundId] = useState('');
  const [question, setQuestion] = useState('');
  const [deadline, setDeadline] = useState('');
  const navigate = useNavigate();
  const chosen = roundId || rounds.data?.[0]?.id || '';
  const create = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/submissions', {
        ...path,
        body: {
          title: title.trim(),
          roundId: chosen,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(deadline ? { deadline: fromISTInput(deadline) } : {}),
          // Every submission has at least one question; more are added on its page.
          fields: [{ label: question.trim(), type: 'long_text', required: true }],
        },
      }),
    ),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> New submission
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(undefined, {
              onSuccess: (created) => {
                setOpen(false);
                setTitle('');
                setDescription('');
                setQuestion('');
                setDeadline('');
                void navigate(created.id);
              },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New submission</DialogTitle>
            <DialogDescription>
              Start with its first question; add more questions and change their types on the next
              page.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid gap-2">
            <Label htmlFor="new-submission-description">Description</Label>
            <Textarea
              id="new-submission-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <FormField
            label="First question"
            placeholder="e.g. Link to your project repository"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <FormField
            label="Deadline (optional, IST)"
            type="datetime-local"
            hint="Teams can still submit after it; late entries are marked."
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <div className="grid gap-2">
            <Label htmlFor="new-submission-round">Round</Label>
            <NativeSelect
              id="new-submission-round"
              value={chosen}
              onChange={(e) => setRoundId(e.target.value)}
            >
              {rounds.data?.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>
                  {r.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <ErrorAlert error={create.error} />
          <DialogFooter>
            <Button
              type="submit"
              disabled={!title.trim() || !question.trim() || !chosen || create.isPending}
            >
              Create submission
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
