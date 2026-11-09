import { useQuery } from '@tanstack/react-query';
import { Pencil, Settings2, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { TableSkeleton } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export function useSavedBoards() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'leaderboards'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/leaderboards', path)),
  });
}

/**
 * Admin: a leaderboard over one or more rounds (overall, per track, the top N,
 * weighted, normalised), with its settings top right.
 */
export function SavedBoardCard({ board, onEdit }: { board: Saved; onEdit: () => void }) {
  const api = useApi();
  const { event } = useEventContext();
  const [deleting, setDeleting] = useState(false);
  const remove = useEventMutation(event.id, () =>
    unwrap(
      api.DELETE('/v1/events/{eventId}/leaderboards/{leaderboardId}', {
        params: { path: { eventId: event.id, leaderboardId: board.id } },
      }),
    ),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="wrap-anywhere">{board.name}</CardTitle>
        <CardDescription>
          {summary(board)} · {VISIBILITY[board.visibility]}
        </CardDescription>
        <CardAction>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Leaderboard settings">
                <Settings2 aria-hidden />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil aria-hidden /> Edit leaderboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 aria-hidden /> Delete leaderboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ErrorAlert error={remove.error} />
        <Results board={board} />
      </CardContent>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${board.name}?`}
        description="The leaderboard goes; scores and rounds stay."
        confirmLabel="Delete leaderboard"
        destructive
        onConfirm={() => remove.mutate(undefined)}
      />
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
export function BoardDialog({
  board,
  rounds,
  onClose,
  onSaved,
}: {
  board: Saved | null;
  rounds: Round[];
  onClose: () => void;
  /** Called with the saved board, to show it. */
  onSaved?: (board: Saved) => void;
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
    save.mutate(undefined, {
      onSuccess: (saved) => {
        onSaved?.(saved);
        onClose();
      },
    });
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
