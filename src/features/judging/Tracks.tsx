import { useQuery } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { RowsSkeleton } from '@/components/PageState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';

export type Track = Schemas['Track'];

export function useTracks() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'tracks'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/tracks', path)),
  });
}

/** Admin: the tracks teams compete in. Each team is in one at most (set on its page). */
export function Tracks() {
  const api = useApi();
  const { event } = useEventContext();
  const tracks = useTracks();
  const [name, setName] = useState('');
  const p = (trackId: string) => ({ params: { path: { eventId: event.id, trackId } } });
  const add = useEventMutation(event.id, (n: string) =>
    unwrap(
      api.POST('/v1/events/{eventId}/tracks', {
        params: { path: { eventId: event.id } },
        body: { name: n },
      }),
    ),
  );
  const rename = useEventMutation(event.id, ({ id, name: n }: { id: string; name: string }) =>
    unwrap(api.PATCH('/v1/events/{eventId}/tracks/{trackId}', { ...p(id), body: { name: n } })),
  );
  const remove = useEventMutation(event.id, (id: string) =>
    unwrap(api.DELETE('/v1/events/{eventId}/tracks/{trackId}', p(id))),
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(name.trim(), { onSuccess: () => setName('') });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracks</CardTitle>
        <CardDescription>
          The tracks teams compete in, each with its own leaderboard if you want one. Put a team in
          a track on its page.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ErrorAlert error={tracks.error ?? add.error ?? rename.error ?? remove.error} />
        {tracks.isPending && <RowsSkeleton rows={2} />}
        {tracks.data && tracks.data.length > 0 && (
          <ul className="grid divide-y rounded-lg border" aria-label="Tracks">
            {tracks.data.map((t) => (
              <TrackRow
                key={t.id}
                track={t}
                busy={rename.isPending || remove.isPending}
                onRename={(n) => rename.mutate({ id: t.id, name: n })}
                onRemove={() => remove.mutate(t.id)}
              />
            ))}
          </ul>
        )}
        <form className="flex flex-wrap gap-2" onSubmit={submit}>
          <Input
            aria-label="New track"
            placeholder="e.g. AI, Hardware"
            className="min-w-0 flex-1 basis-48"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!name.trim() || add.isPending}>
            <Plus aria-hidden /> Add track
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TrackRow({
  track: t,
  busy,
  onRename,
  onRemove,
}: {
  track: Track;
  busy: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.name);
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      {editing ? (
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onRename(name.trim());
            setEditing(false);
          }}
        >
          <Input
            aria-label={`Name of ${t.name}`}
            className="h-8 min-w-0 flex-1"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Button type="submit" size="icon-sm" aria-label="Save name" disabled={!name.trim()}>
            <Check aria-hidden />
          </Button>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 font-medium wrap-anywhere">{t.name}</span>
          <Badge variant="secondary">
            {t.teamCount} {t.teamCount === 1 ? 'team' : 'teams'}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${t.name}`}
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
          </Button>
          <ConfirmButton
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${t.name}`}
            title={`Delete the ${t.name} track?`}
            description="Its teams are taken out of it, and its leaderboards rank every team. Scores stay."
            confirmLabel="Delete track"
            destructive
            disabled={busy}
            onConfirm={onRemove}
          >
            <Trash2 aria-hidden />
          </ConfirmButton>
        </>
      )}
    </li>
  );
}
