import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';

/** Admins: the rubric (name, description, max score, order) and who sees the leaderboard. */
export function CriteriaEditor({ criteria }: { criteria: Schemas['Criterion'][] }) {
  const api = useApi();
  const { event, path } = useEventContext();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  const add = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/criteria', {
        ...path,
        body: { name, description, maxScore: Number(maxScore) },
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
        <CardTitle>Rubric</CardTitle>
        <CardDescription>
          Judges score each criterion from 0 to its maximum. A team&apos;s total is the average of
          the judges&apos; totals.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ol className="grid divide-y rounded-lg border text-sm">
          {criteria.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 p-3">
              <span>
                <span className="font-medium">{c.name}</span>{' '}
                <span className="text-muted-foreground">· out of {c.maxScore}</span>
                {c.description && (
                  <span className="block text-muted-foreground">{c.description}</span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate(c.id)}
              >
                Remove
              </Button>
            </li>
          ))}
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
        <ErrorAlert error={add.error ?? remove.error ?? visibility.error} />
      </CardContent>
    </Card>
  );
}
