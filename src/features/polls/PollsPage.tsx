import { useQuery } from '@tanstack/react-query';
import { BarChart3, Lock, LockOpen, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { RolePicker } from '@/components/RolePicker';
import { audienceText } from '@/lib/audience';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { Pager, usePage } from '@/components/Pager';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { formatIST, fromISTInput } from '@/lib/datetime';
import {
  hasOptions,
  isSingleChoice,
  type Poll,
  POLL_TYPES,
  type PollType,
  typeLabel,
} from './poll-kinds';
import { PollAnswerForm } from './PollAnswerForm';
import { CreatePollSet, PollSetCard } from './PollSets';

const pollText = (p: Poll) => [
  p.question,
  p.group?.title,
  typeLabel(p.type),
  ...p.options.map((o) => o.label),
];

/** Polls on their own, and sets (all their questions, in order) where any question matched. */
function listItems(all: Poll[], matched: readonly Poll[]) {
  const hit = new Set(matched.map((p) => p.id));
  const sets = new Set(matched.flatMap((p) => (p.group ? [p.group.id] : [])));
  const seen = new Set<string>();
  const items: ({ kind: 'poll'; poll: Poll } | { kind: 'set'; id: string; questions: Poll[] })[] =
    [];
  for (const p of all) {
    if (!p.group) {
      if (hit.has(p.id)) items.push({ kind: 'poll', poll: p });
    } else if (sets.has(p.group.id) && !seen.has(p.group.id)) {
      seen.add(p.group.id);
      const questions = all
        .filter((q) => q.group?.id === p.group!.id)
        .sort((a, b) => a.group!.position - b.group!.position);
      items.push({ kind: 'set', id: p.group.id, questions });
    }
  }
  return items;
}

type Item = ReturnType<typeof listItems>[number];
const itemId = (i: Item) => (i.kind === 'poll' ? i.poll.id : i.id);
/** The poll a row describes: the poll, or a set's first question (they share settings). */
const lead = (i: Item) => (i.kind === 'poll' ? i.poll : i.questions[0]!);

/**
 * Polls on anything (food choices, feedback, ratings…), for any combination of
 * roles: a table with search; a row opens the poll's results and options.
 */
export function PollsPage() {
  const api = useApi();
  const { event, path } = useEventContext();
  const polls = useQuery({
    queryKey: ['event', event.id, 'polls'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/polls', path)),
  });
  const search = useListFilter(polls.data ?? [], pollText);
  const items = listItems(polls.data ?? [], search.filtered);
  const page = usePage(items);
  const [openId, setOpenId] = useState<string | null>(null);
  // Looked up again on every render, so the popup shows fresh results.
  const open = listItems(polls.data ?? [], polls.data ?? []).find((i) => itemId(i) === openId);

  return (
    <div className="grid gap-4">
      <CreatePoll />
      {polls.data && polls.data.length > 0 && (
        <SearchInput
          label="Search polls"
          className="sm:w-72"
          value={search.query}
          onChange={search.setQuery}
        />
      )}
      <ErrorAlert error={polls.error} />
      {polls.isPending && <TableSkeleton cols={4} />}
      {polls.data && items.length === 0 && (
        <EmptyState icon={BarChart3} title={search.active ? 'No poll matches.' : 'No polls yet.'} />
      )}
      {page.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label="Polls">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Poll</TableHead>
                <TableHead className="hidden md:table-cell">Who answers</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((item) => {
                const p = lead(item);
                const title = item.kind === 'poll' ? item.poll.question : p.group!.title;
                return (
                  <TableRow
                    key={itemId(item)}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      setOpenId(itemId(item));
                    }}
                  >
                    <TableCell className="whitespace-normal">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-left font-medium wrap-anywhere whitespace-normal text-foreground"
                        onClick={() => setOpenId(itemId(item))}
                      >
                        {title}
                      </Button>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {item.kind === 'poll'
                            ? typeLabel(item.poll.type)
                            : `${item.questions.length} ${item.questions.length === 1 ? 'question' : 'questions'}`}
                        </Badge>
                        {p.mealCheckpoints.length > 0 && <Badge variant="secondary">Meal</Badge>}
                        <span className="md:hidden">{audienceText(p.audience)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal text-muted-foreground md:table-cell">
                      {audienceText(p.audience)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {p.closed ? (
                        <Badge variant="secondary">Closed</Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        >
                          Open
                        </Badge>
                      )}
                      {p.closesAt && !p.closed && (
                        <div className="pt-1 text-xs text-muted-foreground">
                          closes {formatIST(p.closesAt)}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager {...page} />
      <Dialog open={open !== undefined} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && (
          <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
            <DialogTitle className="sr-only">
              {open.kind === 'poll' ? open.poll.question : open.questions[0]!.group!.title}
            </DialogTitle>
            {open.kind === 'poll' ? (
              <PollCard poll={open.poll} />
            ) : (
              <PollSetCard questions={open.questions} onDeleted={() => setOpenId(null)} />
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function PollCard({ poll }: { poll: Poll }) {
  const api = useApi();
  const { event } = useEventContext();
  const p = { params: { path: { eventId: event.id, pollId: poll.id } } };
  const toggleResults = useEventMutation(event.id, () =>
    unwrap(
      api.PATCH('/v1/events/{eventId}/polls/{pollId}', {
        ...p,
        body: { resultsVisible: !poll.resultsVisible },
      }),
    ),
  );
  const addOption = useEventMutation(event.id, (label: string) =>
    unwrap(api.POST('/v1/events/{eventId}/polls/{pollId}/options', { ...p, body: { label } })),
  );
  // Closing sets the closing time to now; reopening clears it.
  const setClosesAt = useEventMutation(event.id, (closesAt: string | null) =>
    unwrap(api.PATCH('/v1/events/{eventId}/polls/{pollId}', { ...p, body: { closesAt } })),
  );

  return (
    <Card className="min-w-0 border-0 bg-transparent shadow-none">
      <CardHeader className="pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="min-w-0 wrap-anywhere">{poll.question}</CardTitle>
          <Badge variant="outline">{typeLabel(poll.type)}</Badge>
          {poll.closed && <Badge variant="secondary">Closed</Badge>}
          {poll.mealCheckpoints.length > 0 && <Badge variant="secondary">Meal</Badge>}
        </div>
        <CardDescription>
          {audienceText(poll.audience)}
          {poll.closesAt && ` · ${poll.closed ? 'closed' : 'closes'} ${formatIST(poll.closesAt)}`}
          {poll.mealCheckpoints.length > 0 &&
            ` · used at ${poll.mealCheckpoints.map((c) => c.name).join(', ')}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <PollAnswerForm poll={poll} />
        <ErrorAlert error={toggleResults.error ?? addOption.error ?? setClosesAt.error} />
      </CardContent>
      {poll.canManage && (
        <CardFooter className="flex-wrap gap-2 border-t">
          <Button
            size="sm"
            variant="outline"
            disabled={toggleResults.isPending}
            onClick={() => toggleResults.mutate(undefined)}
          >
            {poll.resultsVisible
              ? 'Hide results from the audience'
              : 'Show results to the audience'}
          </Button>
          {poll.closed ? (
            <Button
              size="sm"
              variant="outline"
              disabled={setClosesAt.isPending}
              onClick={() => setClosesAt.mutate(null)}
            >
              <LockOpen aria-hidden /> Reopen poll
            </Button>
          ) : (
            <ConfirmButton
              size="sm"
              variant="outline"
              title="Close this poll now?"
              description={
                poll.mealCheckpoints.length > 0
                  ? 'Nobody can vote or change their vote any more. Meal checkpoints keep using it: people who didn’t vote get the default. You can reopen it.'
                  : 'Nobody can answer or change their answer any more. You can reopen it.'
              }
              confirmLabel="Close poll"
              disabled={setClosesAt.isPending}
              onConfirm={() => setClosesAt.mutate(new Date().toISOString())}
            >
              <Lock aria-hidden /> Close poll
            </ConfirmButton>
          )}
          {hasOptions(poll.type) && (
            <AddOption onAdd={(label) => addOption.mutate(label)} pending={addOption.isPending} />
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function AddOption({ onAdd, pending }: { onAdd: (label: string) => void; pending: boolean }) {
  const [label, setLabel] = useState('');
  return (
    <form
      className="flex min-w-0 flex-1 basis-56 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(label.trim());
        setLabel('');
      }}
    >
      <Input
        aria-label="New option"
        placeholder="Add an option"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Button size="sm" type="submit" variant="outline" disabled={!label.trim() || pending}>
        Add
      </Button>
    </form>
  );
}

function CreatePoll() {
  const api = useApi();
  const { event, path } = useEventContext();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<PollType>('choice');
  const [scaleMax, setScaleMax] = useState('5');
  const [options, setOptions] = useState('');
  const [audience, setAudience] = useState<Schemas['Role'][]>(['participant']);
  const [closesAt, setClosesAt] = useState('');
  const [resultsVisible, setResultsVisible] = useState(false);
  const [defaultIndex, setDefaultIndex] = useState('');
  const visibleId = useId();
  const labels = options
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const create = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/polls', {
        ...path,
        body: {
          question,
          type,
          ...(hasOptions(type) ? { options: labels } : {}),
          ...(type === 'rating' ? { scaleMax: Number(scaleMax) } : {}),
          audience,
          closesAt: closesAt ? fromISTInput(closesAt) : null,
          resultsVisible,
          ...(defaultIndex === '' || !isSingleChoice(type)
            ? {}
            : { defaultOptionIndex: Number(defaultIndex) }),
        },
      }),
    ),
  );

  const header = (
    <PageHeader title="Polls">
      {!open && (
        <>
          <CreatePollSet />
          <Button onClick={() => setOpen(true)}>
            <Plus aria-hidden /> New poll
          </Button>
        </>
      )}
    </PageHeader>
  );
  if (!open) return header;
  return (
    <>
      {header}
      <Card>
        <CardHeader>
          <CardTitle>New poll</CardTitle>
          <CardDescription>
            Ask for a choice, a few choices, text, a number, a rating or a date. A food poll is
            multiple choice or dropdown with a default option: checked-in people who don&apos;t vote
            get it. Link it to meal checkpoints on the Checkpoints page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(undefined, {
                onSuccess: () => {
                  setOpen(false);
                  setQuestion('');
                  setOptions('');
                },
              });
            }}
          >
            <FormField
              label="Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <Field>
              <FieldLabel htmlFor="poll-type">Answer type</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as PollType)}>
                <SelectTrigger id="poll-type" className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {type === 'rating' && (
              <Field>
                <FieldLabel htmlFor="poll-scale">Scale</FieldLabel>
                <Select value={scaleMax} onValueChange={setScaleMax}>
                  <SelectTrigger id="poll-scale" className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 9 }, (_, i) => String(i + 2)).map((n) => (
                      <SelectItem key={n} value={n}>
                        1 to {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {hasOptions(type) && (
              <Field>
                <FieldLabel htmlFor="poll-options">Options, one per line</FieldLabel>
                <Textarea
                  id="poll-options"
                  rows={4}
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                />
              </Field>
            )}
            {isSingleChoice(type) && (
              <Field>
                <FieldLabel htmlFor="poll-default">Default option</FieldLabel>
                <NativeSelect
                  id="poll-default"
                  className="w-full"
                  value={defaultIndex}
                  onChange={(e) => setDefaultIndex(e.target.value)}
                >
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {labels.map((l, i) => (
                    <NativeSelectOption key={`${l}-${i}`} value={i}>
                      {l}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>Needed for food polls.</FieldDescription>
              </Field>
            )}
            <RolePicker value={audience} onChange={setAudience} />
            <FormField
              label="Closes (IST, optional)"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
            <Field orientation="horizontal">
              <Checkbox
                id={visibleId}
                checked={resultsVisible}
                onCheckedChange={(c) => setResultsVisible(c === true)}
              />
              <FieldLabel htmlFor={visibleId} className="font-normal">
                The audience can see the results
              </FieldLabel>
            </Field>
            <ErrorAlert error={create.error} />
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  !question.trim() ||
                  (hasOptions(type) && labels.length < 2) ||
                  audience.length === 0 ||
                  create.isPending
                }
              >
                Create poll
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
