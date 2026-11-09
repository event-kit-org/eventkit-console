import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { RowsSkeleton, TableSkeleton } from '@/components/PageState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import type { Round } from './rounds';
import { useTracks } from './Tracks';

type Saved = Schemas['SavedLeaderboard'];
type Method = Saved['method'];
type Visibility = Saved['visibility'];

const METHODS: { value: Method; label: string; explain: string }[] = [
  { value: 'sum', label: 'Add up', explain: 'Each round’s total times its weight, added up.' },
  {
    value: 'percent',
    label: 'Average %',
    explain: 'Each round as a % of its maximum, so rounds of any size count by weight.',
  },
  { value: 'average', label: 'Average', explain: 'The weighted average of the round totals.' },
];
const VISIBILITY: Record<Visibility, string> = {
  admins: 'Admins only',
  judges: 'Admins and judges',
  public: 'Everyone',
};

const num = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(2));

/**
 * Admin: leaderboards over one or more rounds: overall, per track, the top N,
 * weighted, normalised, and who sees each.
 */
export function SavedLeaderboards({ rounds }: { rounds: Round[] }) {
  const api = useApi();
  const { event, path } = useEventContext();
  const boards = useQuery({
    queryKey: ['event', event.id, 'leaderboards'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/leaderboards', path)),
  });
  const [editing, setEditing] = useState<Saved | 'new' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const remove = useEventMutation(event.id, (id: string) =>
    unwrap(
      api.DELETE('/v1/events/{eventId}/leaderboards/{leaderboardId}', {
        params: { path: { eventId: event.id, leaderboardId: id } },
      }),
    ),
  );
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1.5">
          <CardTitle>Saved leaderboards</CardTitle>
          <CardDescription>
            Rank teams across rounds: overall, per track, the top few. Each has its own way of
            adding up and its own audience.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden /> New leaderboard
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ErrorAlert error={boards.error ?? remove.error} />
        {boards.isPending && <RowsSkeleton rows={2} />}
        {boards.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            None yet. Each round still has its own leaderboard above.
          </p>
        )}
        {boards.data && boards.data.length > 0 && (
          <ul className="grid divide-y rounded-lg border" aria-label="Saved leaderboards">
            {boards.data.map((b) => (
              <li key={b.id} className="grid gap-3 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-auto min-h-8 min-w-0 flex-1 justify-start text-left whitespace-normal"
                    aria-expanded={open === b.id}
                    onClick={() => setOpen(open === b.id ? null : b.id)}
                  >
                    {open === b.id ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                    <span className="grid min-w-0 gap-0.5">
                      <span className="font-medium wrap-anywhere">{b.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {summary(b)}
                      </span>
                    </span>
                  </Button>
                  <Badge variant="secondary">{VISIBILITY[b.visibility]}</Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${b.name}`}
                    onClick={() => setEditing(b)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${b.name}`}
                    title={`Delete ${b.name}?`}
                    description="The leaderboard goes; scores and rounds stay."
                    confirmLabel="Delete leaderboard"
                    destructive
                    disabled={remove.isPending}
                    onConfirm={() => remove.mutate(b.id)}
                  >
                    <Trash2 aria-hidden />
                  </ConfirmButton>
                </div>
                {open === b.id && <Results board={b} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing && (
        <BoardDialog
          key={editing === 'new' ? 'new' : editing.id}
          board={editing === 'new' ? null : editing}
          rounds={rounds}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function summary(b: Saved) {
  return [
    b.track ? b.track.name : 'Every team',
    b.topN ? `top ${b.topN}` : null,
    b.rounds
      .map((r) => (r.weight === 1 ? r.round.name : `${r.round.name} ×${r.weight}`))
      .join(' + '),
    b.rounds.length > 1 ? METHODS.find((m) => m.value === b.method)!.label : null,
    b.normalise ? 'normalised' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A saved leaderboard's ranking, with each round's total. */
function Results({ board }: { board: Saved }) {
  const api = useApi();
  const { event } = useEventContext();
  const results = useQuery({
    queryKey: ['event', event.id, 'leaderboards', board.id, 'results'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/leaderboards/{leaderboardId}/results', {
          params: { path: { eventId: event.id, leaderboardId: board.id } },
        }),
      ),
  });
  return (
    <div className="grid gap-2">
      <ErrorAlert error={results.error} />
      {results.isPending && <TableSkeleton rows={3} />}
      {results.data?.entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No scores yet.</p>
      )}
      {results.data && results.data.entries.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Team</TableHead>
              {board.rounds.length > 1 &&
                board.rounds.map((r) => (
                  <TableHead key={r.round.id} className="hidden text-right md:table-cell">
                    {r.round.name}
                  </TableHead>
                ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.data.entries.map((e) => (
              <TableRow key={e.team.id}>
                <TableCell className="font-medium tabular-nums">{e.rank}</TableCell>
                <TableCell className="whitespace-normal wrap-anywhere">{e.team.name}</TableCell>
                {board.rounds.length > 1 &&
                  e.rounds.map((r) => (
                    <TableCell
                      key={r.roundId}
                      className="hidden text-right tabular-nums md:table-cell"
                    >
                      {r.total === null ? '—' : num(r.total)}
                    </TableCell>
                  ))}
                <TableCell className="text-right tabular-nums">
                  {num(e.total)}
                  {board.method === 'percent' ? '%' : ` / ${num(e.maxTotal)}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** Set up or change a saved leaderboard. */
function BoardDialog({
  board,
  rounds,
  onClose,
}: {
  board: Saved | null;
  rounds: Round[];
  onClose: () => void;
}) {
  const api = useApi();
  const { event } = useEventContext();
  const tracks = useTracks();
  const [name, setName] = useState(board?.name ?? '');
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(board?.rounds.map((r) => [r.round.id, String(r.weight)]) ?? []),
  );
  const [method, setMethod] = useState<Method>(board?.method ?? 'sum');
  const [normalise, setNormalise] = useState(board?.normalise ?? false);
  const [trackId, setTrackId] = useState(board?.track?.id ?? '');
  const [topN, setTopN] = useState(board?.topN ? String(board.topN) : '');
  const [visibility, setVisibility] = useState<Visibility>(board?.visibility ?? 'admins');
  const chosen = rounds.filter((r) => weights[r.id] !== undefined);
  const badWeight = chosen.some((r) => !(Number(weights[r.id]) >= 0) || weights[r.id] === '');
  const save = useEventMutation(event.id, () => {
    const body = {
      name: name.trim(),
      method,
      normalise,
      trackId: trackId || null,
      topN: topN ? Number(topN) : null,
      visibility,
      rounds: chosen.map((r) => ({ roundId: r.id, weight: Number(weights[r.id]) })),
    };
    return unwrap(
      board
        ? api.PATCH('/v1/events/{eventId}/leaderboards/{leaderboardId}', {
            params: { path: { eventId: event.id, leaderboardId: board.id } },
            body,
          })
        : api.POST('/v1/events/{eventId}/leaderboards', {
            params: { path: { eventId: event.id } },
            body,
          }),
    );
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, { onSuccess: onClose });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{board ? `Edit ${board.name}` : 'New leaderboard'}</DialogTitle>
            <DialogDescription>
              Pick the rounds it counts and how they add up. Rounds a team didn’t reach count as 0.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="lb-name">Name</Label>
            <Input
              id="lb-name"
              placeholder="e.g. Overall, AI track winners"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Rounds and weights</legend>
            {rounds.map((r) => {
              const on = weights[r.id] !== undefined;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    id={`lb-round-${r.id}`}
                    checked={on}
                    onCheckedChange={(c) =>
                      setWeights((w) => {
                        const next = { ...w };
                        if (c) next[r.id] = '1';
                        else delete next[r.id];
                        return next;
                      })
                    }
                  />
                  <Label
                    htmlFor={`lb-round-${r.id}`}
                    className="min-w-0 flex-1 font-normal wrap-anywhere"
                  >
                    {r.name}
                  </Label>
                  {on && (
                    <Input
                      aria-label={`Weight of ${r.name}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="any"
                      className="h-8 w-20"
                      value={weights[r.id]}
                      onChange={(e) => setWeights((w) => ({ ...w, [r.id]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
          </fieldset>
          {chosen.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="lb-method">How rounds add up</Label>
              <NativeSelect
                id="lb-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
              >
                {METHODS.map((m) => (
                  <NativeSelectOption key={m.value} value={m.value}>
                    {m.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <p className="text-sm text-muted-foreground">
                {METHODS.find((m) => m.value === method)!.explain}
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lb-track">Track</Label>
              <NativeSelect
                id="lb-track"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
              >
                <NativeSelectOption value="">Every team</NativeSelectOption>
                {tracks.data?.map((t) => (
                  <NativeSelectOption key={t.id} value={t.id}>
                    {t.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lb-top">Show the top (optional)</Label>
              <Input
                id="lb-top"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                placeholder="All teams"
                value={topN}
                onChange={(e) => setTopN(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lb-visibility">Who sees it</Label>
            <NativeSelect
              id="lb-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
                <NativeSelectOption key={v} value={v}>
                  {VISIBILITY[v]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-sm text-muted-foreground">
              Everyone: participants see it on the portal from the event day, over released and
              closed rounds only.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Switch
              id="lb-normalise"
              checked={normalise}
              onCheckedChange={setNormalise}
              className="mt-0.5"
            />
            <Label htmlFor="lb-normalise" className="font-normal">
              Even out lenient and harsh judges
            </Label>
          </div>
          <ErrorAlert error={save.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || chosen.length === 0 || badWeight || save.isPending}
            >
              {board ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
