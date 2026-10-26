import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { RolePicker } from '@/components/RolePicker';
import { audienceText } from '@/lib/audience';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      {polls.data?.length === 0 && <p className="text-sm text-muted-foreground">No polls yet.</p>}
      {polls.data?.map((p) => (
        <PollCard key={p.id} poll={p} />
      ))}
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{poll.question}</CardTitle>
          {poll.closed && <Badge>Closed</Badge>}
          {poll.mealCheckpoints.length > 0 && <Badge>Meal</Badge>}
        </div>
        <CardDescription>
          {audienceText(poll.audience)}
          {poll.closesAt && ` · closes ${formatIST(poll.closesAt)}`}
          {poll.mealCheckpoints.length > 0 &&
            ` · used at ${poll.mealCheckpoints.map((c) => c.name).join(', ')}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="grid gap-2" aria-label="Options">
          {poll.options.map((o) => (
            <li key={o.id} className="flex items-center gap-2 text-sm">
              {poll.canVote ? (
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="radio"
                    name={`poll-${poll.id}`}
                    checked={(option || poll.myVote) === o.id}
                    onChange={() => setOption(o.id)}
                  />
                  {o.label}
                </label>
              ) : (
                <span className="flex-1">
                  {o.label}
                  {poll.myVote === o.id && ' (your choice)'}
                </span>
              )}
              {poll.defaultOptionId === o.id && (
                <span className="text-xs text-muted-foreground">default</span>
              )}
              {showResults && <span className="tabular-nums">{o.votes}</span>}
            </li>
          ))}
        </ul>
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
        {poll.canManage && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
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
          </div>
        )}
        <ErrorAlert error={vote.error ?? toggleResults.error ?? addOption.error} />
      </CardContent>
    </Card>
  );
}

function AddOption({ onAdd, pending }: { onAdd: (label: string) => void; pending: boolean }) {
  const [label, setLabel] = useState('');
  return (
    <form
      className="flex gap-2"
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

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>New poll</Button>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>New poll</CardTitle>
        <CardDescription>
          A food poll needs a default option: checked-in people who don&apos;t vote get it. Link it
          to meal checkpoints on the Checkpoints page.
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
          <div className="grid gap-2">
            <Label htmlFor="poll-options">Options, one per line</Label>
            <Textarea
              id="poll-options"
              rows={4}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="poll-default">Default option</Label>
            <select
              id="poll-default"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={defaultIndex}
              onChange={(e) => setDefaultIndex(e.target.value)}
            >
              <option value="">None</option>
              {labels.map((l, i) => (
                <option key={`${l}-${i}`} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <RolePicker value={audience} onChange={setAudience} />
          <FormField
            label="Closes (IST, optional)"
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={resultsVisible}
              onChange={(e) => setResultsVisible(e.target.checked)}
            />
            The audience can see the results
          </label>
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
  );
}
