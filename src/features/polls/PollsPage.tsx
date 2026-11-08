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
import { CardsSkeleton, EmptyState } from '@/components/PageState';
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

/** Polls on anything (food choices, feedback, ratings…), for any combination of roles. */
export function PollsPage() {
  const api = useApi();
  const { event, path } = useEventContext();
  const polls = useQuery({
    queryKey: ['event', event.id, 'polls'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/polls', path)),
  });
  const search = useListFilter(polls.data ?? [], pollText);
  const items = listItems(polls.data ?? [], search.filtered);

  return (
    <div className="grid gap-4">
      <CreatePoll />
      {polls.data && polls.data.length > 0 && (
        <SearchInput label="Search polls" value={search.query} onChange={search.setQuery} />
      )}
      <ErrorAlert error={polls.error} />
      {polls.isPending && <CardsSkeleton />}
      {polls.data && items.length === 0 && (
        <EmptyState icon={BarChart3} title={search.active ? 'No poll matches.' : 'No polls yet.'} />
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {items.map((item) =>
          item.kind === 'poll' ? (
            <PollCard key={item.poll.id} poll={item.poll} />
          ) : (
            <PollSetCard key={item.id} questions={item.questions} />
          ),
        )}
      </div>
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
    <Card className="min-w-0">
      <CardHeader>
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
