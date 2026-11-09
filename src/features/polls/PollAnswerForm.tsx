import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useId, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { RowsSkeleton } from '@/components/PageState';
import { SearchInput } from '@/components/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cell, download, slug } from '@/features/admin/teams-csv';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { useListFilter } from '@/hooks/useListFilter';
import { formatIST, fromISTInput, toISTInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';

import { hasOptions, type Poll } from './poll-kinds';

type Answer = { optionId?: string; optionIds?: string[]; value?: string | number };

/** Answer a poll of any type (when you are in its audience), with results where shown. */
export function PollAnswerForm({ poll }: { poll: Poll }) {
  const api = useApi();
  const { event } = useEventContext();
  const id = useId();
  const mine = poll.myAnswer;
  const [choice, setChoice] = useState(mine?.optionId ?? poll.myVote ?? '');
  const [many, setMany] = useState<string[]>(mine?.optionIds ?? []);
  const [text, setText] = useState(() => {
    const v = mine?.value;
    if (v === null || v === undefined) return '';
    return poll.type === 'datetime' && typeof v === 'string' ? toISTInput(v) : String(v);
  });
  const vote = useEventMutation(event.id, (body: Answer) =>
    unwrap(
      api.PUT('/v1/events/{eventId}/polls/{pollId}/vote', {
        params: { path: { eventId: event.id, pollId: poll.id } },
        body,
      }),
    ),
  );
  const total = poll.totalVotes ?? 0;
  const showResults = poll.totalVotes !== null;

  if (hasOptions(poll.type)) {
    const multi = poll.type === 'multi_choice';
    const answer: Answer = multi ? { optionIds: many } : { optionId: choice };
    const changed = multi
      ? [...many].sort().join() !== [...(mine?.optionIds ?? [])].sort().join()
      : choice !== (mine?.optionId ?? poll.myVote ?? '');
    const options = (
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
                  {multi ? (
                    <Checkbox
                      id={`${id}-${o.id}`}
                      checked={many.includes(o.id)}
                      onCheckedChange={(c) =>
                        setMany((m) => (c === true ? [...m, o.id] : m.filter((x) => x !== o.id)))
                      }
                    />
                  ) : (
                    <RadioGroupItem value={o.id} id={`${id}-${o.id}`} />
                  )}
                  <label
                    htmlFor={`${id}-${o.id}`}
                    className="min-w-0 flex-1 cursor-pointer wrap-anywhere"
                  >
                    {o.label}
                  </label>
                </>
              ) : (
                <span className="min-w-0 flex-1 wrap-anywhere">
                  {o.label}
                  {((mine?.optionId ?? poll.myVote) === o.id || mine?.optionIds.includes(o.id)) &&
                    ' (your choice)'}
                </span>
              )}
              {poll.defaultOptionId === o.id && <Badge variant="outline">default</Badge>}
              {showResults && <span className="font-medium tabular-nums">{o.votes}</span>}
            </div>
          </li>
        ))}
      </ul>
    );
    return (
      <div className="grid gap-3">
        {multi ? (
          <div role="group" aria-label={poll.question}>
            {options}
          </div>
        ) : (
          <RadioGroup
            aria-label={poll.question}
            value={choice}
            onValueChange={setChoice}
            disabled={!poll.canVote}
            className="gap-2"
          >
            {options}
          </RadioGroup>
        )}
        {showResults && (
          <p className="text-xs text-muted-foreground">
            {poll.totalVotes} {multi ? 'people answered' : 'votes in total'}.
          </p>
        )}
        {poll.canVote && (
          <div>
            <Button
              size="sm"
              disabled={!changed || (multi ? many.length === 0 : !choice) || vote.isPending}
              onClick={() => vote.mutate(answer)}
            >
              {mine ? 'Change vote' : 'Vote'}
            </Button>
          </div>
        )}
        <ErrorAlert error={vote.error} />
      </div>
    );
  }

  const value =
    poll.type === 'number' || poll.type === 'rating'
      ? Number(text)
      : poll.type === 'datetime'
        ? fromISTInput(text)
        : text;
  const scale = Array.from({ length: poll.scaleMax ?? 5 }, (_, i) => String(i + 1));
  return (
    <div className="grid gap-3">
      {poll.canVote && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            vote.mutate({ value });
          }}
        >
          {poll.type === 'rating' ? (
            <RadioGroup
              aria-label={poll.question}
              value={text}
              onValueChange={setText}
              className="flex flex-wrap gap-2"
            >
              {scale.map((n) => (
                <label
                  key={n}
                  htmlFor={`${id}-r${n}`}
                  className={cn(
                    'flex size-10 cursor-pointer items-center justify-center rounded-lg border text-sm tabular-nums has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground',
                  )}
                >
                  <RadioGroupItem value={n} id={`${id}-r${n}`} className="sr-only" />
                  {n}
                </label>
              ))}
            </RadioGroup>
          ) : poll.type === 'long_text' ? (
            <Textarea
              aria-label={poll.question}
              rows={3}
              maxLength={5000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <Input
              aria-label={poll.question}
              type={
                poll.type === 'number'
                  ? 'number'
                  : poll.type === 'datetime'
                    ? 'datetime-local'
                    : 'text'
              }
              inputMode={poll.type === 'number' ? 'decimal' : undefined}
              maxLength={poll.type === 'short_text' ? 1000 : undefined}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
          <div>
            <Button size="sm" type="submit" disabled={!text.trim() || vote.isPending}>
              {mine ? 'Change answer' : 'Answer'}
            </Button>
          </div>
        </form>
      )}
      {!poll.canVote && mine && (
        <p className="text-sm text-muted-foreground">
          Your answer: <span className="text-foreground">{answerText(poll, mine.value)}</span>
        </p>
      )}
      <ErrorAlert error={vote.error} />
      {showResults && <ValueResults poll={poll} />}
    </div>
  );
}

const answerText = (poll: Poll, v: string | number | null | undefined) =>
  v === null || v === undefined
    ? ''
    : poll.type === 'datetime' && typeof v === 'string'
      ? formatIST(v)
      : String(v);

/** Statistics for number and rating polls; the answers themselves for the rest. */
function ValueResults({ poll }: { poll: Poll }) {
  const stats = poll.stats;
  return (
    <div className="grid gap-3">
      {stats && (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {(
            [
              ['Answers', stats.count],
              ['Average', stats.average],
              ['Lowest', stats.min],
              ['Highest', stats.max],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="rounded-lg border p-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{v ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {stats?.distribution && (
        <ul className="grid gap-1" aria-label="How many gave each rating">
          {stats.distribution.map((d) => (
            <li key={d.value} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-right tabular-nums">{d.value}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: stats.count ? `${(d.count / stats.count) * 100}%` : 0 }}
                />
              </div>
              <span className="w-8 text-right text-muted-foreground tabular-nums">{d.count}</span>
            </li>
          ))}
        </ul>
      )}
      <AnswerList poll={poll} />
    </div>
  );
}

type ValueAnswer = Schemas['PollValueAnswer'];
const valueText = (a: ValueAnswer) => [String(a.value), a.by];

/** Every answer, newest first, searchable and downloadable. Loaded when opened. */
function AnswerList({ poll }: { poll: Poll }) {
  const api = useApi();
  const { event } = useEventContext();
  const [open, setOpen] = useState(false);
  const answers = useQuery({
    queryKey: ['event', event.id, 'polls', poll.id, 'answers'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/polls/{pollId}/answers', {
          params: { path: { eventId: event.id, pollId: poll.id }, query: { limit: 500 } },
        }),
      ),
    enabled: open,
  });
  const search = useListFilter(answers.data ?? [], valueText);
  const exportCsv = () => {
    const rows = [
      ['Answer', 'By', 'Answered (IST)'],
      ...(answers.data ?? []).map((a) => [
        answerText(poll, a.value),
        a.by ?? '',
        formatIST(a.respondedAt),
      ]),
    ];
    download(
      `${slug(event.name)}-${slug(poll.question).slice(0, 40)}.csv`,
      rows.map((r) => r.map(cell).join(',')).join('\r\n'),
    );
  };
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button size="sm" variant="ghost" className="-ml-2">
          {open ? 'Hide answers' : `Show answers (${poll.totalVotes ?? 0})`}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-2 pt-2">
        <ErrorAlert error={answers.error} />
        {answers.isPending && <RowsSkeleton rows={2} />}
        {answers.data && answers.data.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput label="Search answers" value={search.query} onChange={search.setQuery} />
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download aria-hidden /> CSV
            </Button>
          </div>
        )}
        {answers.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No answers yet.</p>
        )}
        <ul className="grid max-h-80 gap-2 overflow-y-auto empty:hidden">
          {search.filtered.map((a, i) => (
            <li key={`${a.respondedAt}-${i}`} className="rounded-lg border p-2 text-sm">
              <p className="wrap-anywhere whitespace-pre-wrap">{answerText(poll, a.value)}</p>
              <p className="text-xs text-muted-foreground">
                {a.by ? `${a.by} · ` : ''}
                {formatIST(a.respondedAt)}
              </p>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
