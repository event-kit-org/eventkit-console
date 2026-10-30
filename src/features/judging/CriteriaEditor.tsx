import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { RowsSkeleton } from '@/components/PageState';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import type { Round } from './rounds';

/** Admins: the rubric (name, description, max score, order) and who sees the leaderboard. */
export function CriteriaEditor({
  round,
  rounds,
  criteria,
  loading = false,
}: {
  round: Round;
  rounds: Round[];
  criteria: Schemas['Criterion'][];
  loading?: boolean;
}) {
  const api = useApi();
  const { event, path } = useEventContext();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  const add = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/criteria', {
        ...path,
        body: { name, description, maxScore: Number(maxScore), roundId: round.id },
      }),
    ),
  );
  const remove = useEventMutation(event.id, (criterionId: string) =>
    unwrap(
      api.DELETE('/v1/events/{eventId}/criteria/{criterionId}', {
        params: { path: { eventId: event.id, criterionId } },
      }),
    ),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const update = useEventMutation(
    event.id,
    ({ id, ...body }: { id: string; name: string; description: string; maxScore: number }) =>
      unwrap(
        api.PATCH('/v1/events/{eventId}/criteria/{criterionId}', {
          params: { path: { eventId: event.id, criterionId: id } },
          body,
        }),
      ),
  );
  const duplicate = useEventMutation(event.id, (fromRoundId: string) =>
    unwrap(
      api.POST('/v1/events/{eventId}/rounds/{roundId}/criteria/duplicate', {
        params: { path: { eventId: event.id, roundId: round.id } },
        body: { fromRoundId },
      }),
    ),
  );
  const others = rounds.filter((r) => r.id !== round.id);
  const visibility = useEventMutation(event.id, () =>
    unwrap(
      api.PATCH('/v1/events/{eventId}', {
        ...path,
        body: { leaderboardVisible: !event.leaderboardVisible },
      }),
    ),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rubric: {round.name}</CardTitle>
        <CardDescription>
          Judges score each criterion from 0 to its maximum. A team&apos;s total is the average of
          the judges&apos; totals.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {loading && <RowsSkeleton rows={2} />}
        <ol className="grid divide-y rounded-lg border text-sm">
          {criteria.map((c) =>
            editing === c.id ? (
              <li key={c.id} className="p-3">
                <CriterionForm
                  criterion={c}
                  pending={update.isPending}
                  onCancel={() => setEditing(null)}
                  onSave={(v) =>
                    update.mutate({ id: c.id, ...v }, { onSuccess: () => setEditing(null) })
                  }
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-start justify-between gap-2 p-3">
                <span>
                  <span className="font-medium">{c.name}</span>{' '}
                  <span className="text-muted-foreground">· out of {c.maxScore}</span>
                  {c.description && (
                    <span className="block text-muted-foreground">{c.description}</span>
                  )}
                </span>
                <span className="flex shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => setEditing(c.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${c.name}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(c.id)}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            ),
          )}
        </ol>
        <form
          className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, {
              onSuccess: () => {
                setName('');
                setDescription('');
              },
            });
          }}
        >
          <FormField label="Criterion" value={name} onChange={(e) => setName(e.target.value)} />
          <FormField
            label="Description for judges"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FormField
            label="Maximum score"
            type="number"
            min={1}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
          <div className="sm:col-span-3">
            <Button
              type="submit"
              variant="outline"
              disabled={!name.trim() || !(Number(maxScore) >= 1) || add.isPending}
            >
              Add criterion
            </Button>
          </div>
        </form>
        {others.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="justify-self-start"
                disabled={duplicate.isPending}
              >
                Duplicate criteria from…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {others.map((r) => (
                <DropdownMenuItem key={r.id} onSelect={() => duplicate.mutate(r.id)}>
                  {r.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <span>
            Leaderboard:{' '}
            {event.leaderboardVisible ? 'everyone can see it' : 'admins and judges only'}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={visibility.isPending}
            onClick={() => visibility.mutate(undefined)}
          >
            {event.leaderboardVisible ? 'Hide from everyone' : 'Show to everyone'}
          </Button>
        </div>
        <ErrorAlert
          error={add.error ?? remove.error ?? update.error ?? duplicate.error ?? visibility.error}
        />
      </CardContent>
    </Card>
  );
}

/** Inline editor for one criterion's name, description and maximum score. */
function CriterionForm({
  criterion,
  pending,
  onSave,
  onCancel,
}: {
  criterion: Schemas['Criterion'];
  pending: boolean;
  onSave: (v: { name: string; description: string; maxScore: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(criterion.name);
  const [description, setDescription] = useState(criterion.description);
  const [maxScore, setMaxScore] = useState(String(criterion.maxScore));
  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: name.trim(), description, maxScore: Number(maxScore) });
      }}
    >
      <FormField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <FormField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <FormField
        label="Max score"
        type="number"
        min={1}
        value={maxScore}
        onChange={(e) => setMaxScore(e.target.value)}
      />
      <div className="flex gap-2 sm:col-span-3">
        <Button
          type="submit"
          size="sm"
          disabled={!name.trim() || !(Number(maxScore) >= 1) || pending}
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
