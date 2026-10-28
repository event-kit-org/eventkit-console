import { useQuery } from '@tanstack/react-query';
import { BarChart3, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { RolePicker } from '@/components/RolePicker';
import { audienceText } from '@/lib/audience';
import { EmptyState } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST, fromISTInput } from '@/lib/datetime';

type Poll = Schemas['Poll'];

/** Polls on anything (food choices included), for any combination of roles. */
export function PollsPage() {
  const api = useApi();
  const { event, path } = useEventContext();
  const polls = useQuery({
    queryKey: ['event', event.id, 'polls'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/polls', path)),
  });

  return (
    <div className="grid gap-4">
      <CreatePoll />
      <ErrorAlert error={polls.error} />
      {polls.data?.length === 0 && <EmptyState icon={BarChart3} title="No polls yet." />}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {polls.data?.map((p) => (
          <PollCard key={p.id} poll={p} />
        ))}
      </div>
    </div>
  );
}

function PollCard({ poll }: { poll: Poll }) {
  const api = useApi();
  const { event } = useEventContext();
  const [option, setOption] = useState('');
  const p = { params: { path: { eventId: event.id, pollId: poll.id } } };
  const vote = useEventMutation(event.id, (optionId: string) =>
    unwrap(api.PUT('/v1/events/{eventId}/polls/{pollId}/vote', { ...p, body: { optionId } })),
  );
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
  const showResults = poll.totalVotes !== null;
  const id = useId();
  const total = poll.totalVotes ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{poll.question}</CardTitle>
          {poll.closed && <Badge variant="secondary">Closed</Badge>}
          {poll.mealCheckpoints.length > 0 && <Badge variant="secondary">Meal</Badge>}
        </div>
        <CardDescription>
          {audienceText(poll.audience)}
          {poll.closesAt && ` · closes ${formatIST(poll.closesAt)}`}
          {poll.mealCheckpoints.length > 0 &&
            ` · used at ${poll.mealCheckpoints.map((c) => c.name).join(', ')}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <RadioGroup
          aria-label={poll.question}
          value={option || poll.myVote || ''}
          onValueChange={setOption}
          disabled={!poll.canVote}
          className="gap-2"
        >
          <ul className="grid gap-2" aria-label="Options">
            {poll.options.map((o) => (
              <li
                key={o.id}
                className="relative grid gap-1.5 overflow-hidden rounded-lg border px-3 py-2 text-sm"
              >
                {showResults && total > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-muted"
                    style={{ width: `${((o.votes ?? 0) / total) * 100}%` }}
                    aria-hidden
                  />
                )}
                <div className="relative flex items-center gap-2">
                  {poll.canVote ? (
                    <>
                      <RadioGroupItem value={o.id} id={`${id}-${o.id}`} />
                      <label htmlFor={`${id}-${o.id}`} className="flex-1 cursor-pointer">
                        {o.label}
                      </label>
                    </>
                  ) : (
                    <span className="flex-1">
                      {o.label}
                      {poll.myVote === o.id && ' (your choice)'}
                    </span>
                  )}
                  {poll.defaultOptionId === o.id && <Badge variant="outline">default</Badge>}
                  {showResults && <span className="font-medium tabular-nums">{o.votes}</span>}
                </div>
              </li>
            ))}
          </ul>
        </RadioGroup>
        {showResults && (
          <p className="text-xs text-muted-foreground">{poll.totalVotes} votes in total.</p>
        )}
        {poll.canVote && (
          <div>
            <Button
              size="sm"
              disabled={!option || option === poll.myVote || vote.isPending}
              onClick={() => vote.mutate(option)}
            >
              {poll.myVote ? 'Change vote' : 'Vote'}
            </Button>
          </div>
        )}
        <ErrorAlert error={vote.error ?? toggleResults.error ?? addOption.error} />
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
          <AddOption onAdd={(label) => addOption.mutate(label)} pending={addOption.isPending} />
        </CardFooter>
      )}
    </Card>
  );
}

function AddOption({ onAdd, pending }: { onAdd: (label: string) => void; pending: boolean }) {
  const [label, setLabel] = useState('');
  return (
    <form
      className="flex flex-1 gap-2"
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
          options: labels,
          audience,
          closesAt: closesAt ? fromISTInput(closesAt) : null,
          resultsVisible,
          ...(defaultIndex === '' ? {} : { defaultOptionIndex: Number(defaultIndex) }),
        },
      }),
    ),
  );

  const header = (
    <PageHeader title="Polls">
      {!open && (
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden /> New poll
        </Button>
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
            A food poll needs a default option: checked-in people who don&apos;t vote get it. Link
            it to meal checkpoints on the Checkpoints page.
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
              <FieldLabel htmlFor="poll-options">Options, one per line</FieldLabel>
              <Textarea
                id="poll-options"
                rows={4}
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            </Field>
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
                  !question.trim() || labels.length < 2 || audience.length === 0 || create.isPending
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
