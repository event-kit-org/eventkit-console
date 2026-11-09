import { useQuery } from '@tanstack/react-query';
import {
  Columns3,
  Download,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton, ConfirmDialog } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FilterMenu } from '@/components/FilterMenu';
import { SearchInput } from '@/components/SearchInput';
import { PageHeader } from '@/components/PageHeader';
import { CardsSkeleton } from '@/components/PageState';
import { StatusBadge } from '@/components/StatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { useListFilter } from '@/hooks/useListFilter';
import { useSearchParam } from '@/hooks/useSearchParam';
import { teamDisplayStatus } from '@/lib/status';
import { fillLabel, randomFill } from './assignments';
import { useTeams } from './queries';
import { assignmentsCsv, download, slug } from './teams-csv';

type List = Schemas['AssignmentList'];
type Team = Schemas['TeamSummary'];
const NONE = '__none';

function useLists() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'assignment-lists'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/assignment-lists', path)),
  });
}

/** Problem statements, tables, mentors and the like: one value per team on each list. */
export function AssignmentsPage() {
  const { event } = useEventContext();
  const lists = useLists();
  const teams = useTeams();
  const active = (teams.data ?? []).filter((t) => t.status !== 'cancelled');
  const all = lists.data ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Assignments"
        description="Give each team a problem statement, a table, a mentor or anything else. Participants see a list on their team page once you release it."
      >
        {all.length > 0 && (
          <Button
            variant="outline"
            onClick={() =>
              download(`${slug(event.name)}-assignments.csv`, assignmentsCsv(active, all))
            }
          >
            <Download aria-hidden /> Export CSV
          </Button>
        )}
        <NewListDialog />
      </PageHeader>
      <ErrorAlert error={lists.error ?? teams.error} />
      {lists.isPending ? (
        <CardsSkeleton />
      ) : all.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Plus aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No lists yet</EmptyTitle>
            <EmptyDescription>
              Start with a list such as “Problem statement” (options to pick from) or “Table” (a
              typed value per team).
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewListDialog />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle as="h3">Lists</CardTitle>
              <CardDescription>
                What teams get. Edit a list to change its options; release it when teams should see
                it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y" aria-label="Lists">
                {all.map((l) => (
                  <ListRow key={l.id} list={l} teams={active} />
                ))}
              </ul>
            </CardContent>
          </Card>
          <AssignmentGrid lists={all} teams={active} />
        </>
      )}
    </div>
  );
}

function NewListDialog() {
  const api = useApi();
  const { event, path } = useEventContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<List['kind']>('options');
  const create = useEventMutation(event.id, () =>
    unwrap(api.POST('/v1/events/{eventId}/assignment-lists', { ...path, body: { name, kind } })),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setName('');
          create.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> New list
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <DialogHeader>
            <DialogTitle>New assignment list</DialogTitle>
            <DialogDescription>Hidden from participants until you release it.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="list-name">Name</FieldLabel>
              <Input
                id="list-name"
                placeholder="e.g. Problem statement, Table, Mentor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Each team gets</FieldLabel>
              <RadioGroup value={kind} onValueChange={(v) => setKind(v as List['kind'])}>
                <Field orientation="horizontal">
                  <RadioGroupItem value="options" id="kind-options" />
                  <FieldLabel htmlFor="kind-options" className="font-normal">
                    One of a set of options (problem statements, mentors)
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="text" id="kind-text" />
                  <FieldLabel htmlFor="kind-text" className="font-normal">
                    A typed value (table number, Wi-Fi login)
                  </FieldLabel>
                </Field>
              </RadioGroup>
            </Field>
          </FieldGroup>
          <ErrorAlert error={create.error} />
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              Create list
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One list as a compact row: what it is, how far along, and its actions behind ⋯. */
function ListRow({ list, teams }: { list: List; teams: Team[] }) {
  const api = useApi();
  const { event } = useEventContext();
  const p = { params: { path: { eventId: event.id, listId: list.id } } };
  const [dialog, setDialog] = useState<'edit' | 'release' | 'delete' | null>(null);
  // The random fill being confirmed: worked out once, when the dialog opens.
  const [plan, setPlan] = useState<ReturnType<typeof randomFill> | null>(null);
  const release = useEventMutation(event.id, (show: boolean) =>
    unwrap(
      show
        ? api.POST('/v1/events/{eventId}/assignment-lists/{listId}/release', p)
        : api.POST('/v1/events/{eventId}/assignment-lists/{listId}/unrelease', p),
    ),
  );
  const remove = useEventMutation(event.id, () =>
    unwrap(api.DELETE('/v1/events/{eventId}/assignment-lists/{listId}', p)),
  );
  const unassigned = teams.filter((t) => !t.assignments[list.id]).map((t) => t.id);
  const fill = useEventMutation(event.id, (items: ReturnType<typeof randomFill>) =>
    unwrap(
      api.PUT('/v1/events/{eventId}/assignment-lists/{listId}/assignments', {
        ...p,
        body: { items },
      }),
    ),
  );
  const released = list.releasedAt !== null;
  const options = list.options.length;

  return (
    <li className="grid gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium wrap-anywhere">{list.name}</span>
            <Badge variant={released ? 'default' : 'secondary'}>
              {released ? 'Released' : 'Hidden'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {list.kind === 'options'
              ? `Options · ${options} ${options === 1 ? 'option' : 'options'}`
              : 'Typed values'}{' '}
            · {list.assignedTeams} of {teams.length} teams assigned
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialog('edit')}>
          <Pencil aria-hidden /> Edit
        </Button>
        {/* Not modal, so the dialog an item opens takes focus cleanly. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More for ${list.name}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {released ? (
              <DropdownMenuItem onSelect={() => release.mutate(false)}>
                <EyeOff aria-hidden /> Hide from participants
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setDialog('release')}>
                <Eye aria-hidden /> Release to participants
              </DropdownMenuItem>
            )}
            {list.kind === 'options' && (
              <DropdownMenuItem
                disabled={unassigned.length === 0 || options === 0}
                onSelect={() => setPlan(randomFill(unassigned, list.options))}
              >
                <Shuffle aria-hidden /> Random fill
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
              <Trash2 aria-hidden /> Delete list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ErrorAlert error={release.error ?? remove.error ?? fill.error} />
      {dialog === 'edit' && <EditListDialog list={list} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'release'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Release ${list.name}?`}
        description="Every team sees its value on its team page at once. You can hide it again."
        confirmLabel="Release"
        confirmDisabled={release.isPending}
        onConfirm={() => release.mutate(true)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Delete ${list.name}?`}
        description={`Every team's value on it goes too${
          list.assignedTeams > 0 ? ` (${list.assignedTeams} assigned)` : ''
        }. This can't be undone.`}
        confirmLabel="Delete list"
        destructive
        confirmDisabled={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
      <AlertDialog open={plan !== null} onOpenChange={(o) => !o && setPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fill {list.name} at random?</AlertDialogTitle>
            <AlertDialogDescription>
              {plan?.length} of {unassigned.length} unassigned teams get an option, spread evenly
              within each option&apos;s limit. Teams that already have one keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as is</AlertDialogCancel>
            <AlertDialogAction disabled={!plan?.length} onClick={() => plan && fill.mutate(plan)}>
              Fill {plan?.length} teams
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** Rename a list and, for options, edit what teams can get. Changes save as you make them. */
function EditListDialog({ list, onClose }: { list: List; onClose: () => void }) {
  const api = useApi();
  const { event } = useEventContext();
  const [name, setName] = useState(list.name);
  const rename = useEventMutation(event.id, (next: string) =>
    unwrap(
      api.PATCH('/v1/events/{eventId}/assignment-lists/{listId}', {
        params: { path: { eventId: event.id, listId: list.id } },
        body: { name: next },
      }),
    ),
  );
  const saveName = () => {
    const next = name.trim();
    if (next && next !== list.name) rename.mutate(next);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {list.name}</DialogTitle>
          <DialogDescription>
            {list.kind === 'options'
              ? 'Changes save as you make them. Teams pick up a changed option at once.'
              : 'Typed values are filled in per team, in the table below the lists.'}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`list-name-${list.id}`}>Name</FieldLabel>
          <Input
            id={`list-name-${list.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
        </Field>
        <ErrorAlert error={rename.error} />
        {list.kind === 'options' && <OptionsTable list={list} />}
        <DialogFooter>
          <Button
            onClick={() => {
              saveName();
              onClose();
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionsTable({ list }: { list: List }) {
  const api = useApi();
  const { event } = useEventContext();
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState('');
  const listPath = { eventId: event.id, listId: list.id };
  const add = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/assignment-lists/{listId}/options', {
        params: { path: listPath },
        body: { title, capacity: capacity ? Number(capacity) : null },
      }),
    ),
  );
  const edit = useEventMutation(
    event.id,
    (v: {
      optionId: string;
      body: { title?: string; description?: string | null; capacity?: number | null };
    }) =>
      unwrap(
        api.PATCH('/v1/events/{eventId}/assignment-lists/{listId}/options/{optionId}', {
          params: { path: { ...listPath, optionId: v.optionId } },
          body: v.body,
        }),
      ),
  );
  const remove = useEventMutation(event.id, (optionId: string) =>
    unwrap(
      api.DELETE('/v1/events/{eventId}/assignment-lists/{listId}/options/{optionId}', {
        params: { path: { ...listPath, optionId } },
      }),
    ),
  );

  return (
    <div className="grid gap-3">
      {list.options.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Option</TableHead>
              <TableHead className="w-24">Limit</TableHead>
              <TableHead className="w-28">Teams</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Delete</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.options.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="min-w-40 sm:min-w-56">
                  <div className="grid gap-1">
                    <Input
                      aria-label="Option title"
                      defaultValue={o.title}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== o.title) edit.mutate({ optionId: o.id, body: { title: v } });
                      }}
                    />
                    <Input
                      aria-label={`Description of ${o.title}`}
                      placeholder="Description (optional)"
                      defaultValue={o.description ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== o.description) {
                          edit.mutate({ optionId: o.id, body: { description: v } });
                        }
                      }}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Limit for ${o.title}`}
                    type="number"
                    min={1}
                    placeholder="None"
                    defaultValue={o.capacity ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== o.capacity) edit.mutate({ optionId: o.id, body: { capacity: v } });
                    }}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{fillLabel(o)}</TableCell>
                <TableCell>
                  <ConfirmButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${o.title}`}
                    title={`Delete ${o.title}?`}
                    description={
                      o.teams > 0
                        ? `${o.teams} team${o.teams === 1 ? '' : 's'} will be left without a value.`
                        : undefined
                    }
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => remove.mutate(o.id)}
                  >
                    <Trash2 aria-hidden />
                  </ConfirmButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(undefined, {
            onSuccess: () => {
              setTitle('');
              setCapacity('');
            },
          });
        }}
      >
        <Field className="min-w-0 flex-1 basis-40">
          <FieldLabel htmlFor={`new-option-${list.id}`}>New option</FieldLabel>
          <Input
            id={`new-option-${list.id}`}
            placeholder="e.g. Smart canteen"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field className="w-24">
          <FieldLabel htmlFor={`new-limit-${list.id}`}>Limit</FieldLabel>
          <Input
            id={`new-limit-${list.id}`}
            type="number"
            min={1}
            placeholder="None"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={!title.trim() || add.isPending}>
          <Plus aria-hidden /> Add
        </Button>
      </form>
      <ErrorAlert error={add.error ?? edit.error ?? remove.error} />
    </div>
  );
}

const teamText = (t: Team) => [
  t.name,
  ...t.members.flatMap((m) => [m.name, m.email, m.participantCode]),
  ...Object.values(t.assignments).map((a) => a.label),
];

/** How many lists the team table shows side by side; more and the columns squeeze. */
const MAX_COLUMNS = 3;

function AssignmentGrid({ lists, teams }: { lists: List[]; teams: Team[] }) {
  const [filter, setFilter] = useState('');
  const search = useListFilter(teams, teamText);
  // At most three lists as columns, so the table never squeezes; which ones is
  // picked in the Lists menu and kept in the address. Default: the first three.
  const [shownParam, setShown] = useSearchParam('lists');
  const picked = shownParam.split(',').filter((id) => lists.some((l) => l.id === id));
  const columns = (picked.length > 0 ? lists.filter((l) => picked.includes(l.id)) : lists).slice(
    0,
    MAX_COLUMNS,
  );
  const shownIds = new Set(columns.map((l) => l.id));
  const toggleColumn = (id: string, show: boolean) => {
    const next = new Set(shownIds);
    if (show) next.add(id);
    else next.delete(id);
    setShown([...next].join(','));
  };
  const shown = filter ? search.filtered.filter((t) => !t.assignments[filter]) : search.filtered;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Teams</CardTitle>
        <CardDescription>Changes save as you make them.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {teams.length > 0 && (
          <div className="flex min-w-0 items-center gap-2">
            <SearchInput
              label="Search teams"
              placeholder="Team, member or value"
              className="min-w-0 flex-1 sm:w-72 sm:flex-none"
              value={search.query}
              onChange={search.setQuery}
            />
            <FilterMenu
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                ['', 'All teams'],
                ...lists.map((l) => [l.id, `Unassigned in ${l.name}`] as const),
              ]}
              fallback=""
            />
            {lists.length > MAX_COLUMNS && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="shrink-0"
                    aria-label={`Lists shown: ${columns.length} of ${lists.length}`}
                  >
                    <Columns3 aria-hidden />
                    {/* Icon only while the toolbar is tight; the count reads out regardless. */}
                    <span className="hidden lg:inline">
                      {columns.length} of {lists.length} lists
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Lists in the table (up to {MAX_COLUMNS})
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {lists.map((l) => {
                    const on = shownIds.has(l.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={l.id}
                        checked={on}
                        // Three shown: untick one to pick another. One is always shown.
                        disabled={on ? columns.length === 1 : columns.length >= MAX_COLUMNS}
                        // Keep the menu open to swap several.
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(c) => toggleColumn(l.id, c === true)}
                      >
                        {l.name}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        {shown.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyDescription>
                {teams.length === 0
                  ? 'No teams have registered yet.'
                  : search.active
                    ? 'No team matches.'
                    : 'Every team has one.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card">Team</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                {columns.map((l) => (
                  <TableHead key={l.id} className="min-w-44">
                    {l.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="sticky left-0 z-10 max-w-36 bg-card font-medium whitespace-normal wrap-anywhere sm:max-w-56">
                    {t.name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <StatusBadge status={teamDisplayStatus(t)} />
                  </TableCell>
                  {columns.map((l) => (
                    <TableCell key={l.id}>
                      <AssignCell list={l} team={t} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <FieldDescription className="mt-3">
          Cancelled teams are left out. A full option can&apos;t be picked.
        </FieldDescription>
      </CardContent>
    </Card>
  );
}

function AssignCell({ list, team }: { list: List; team: Team }) {
  const api = useApi();
  const { event } = useEventContext();
  const current = team.assignments[list.id];
  const p = { params: { path: { eventId: event.id, listId: list.id, teamId: team.id } } };
  const save = useEventMutation(
    event.id,
    (value: { optionId: string } | { text: string } | null) =>
      value
        ? unwrap(
            api.PUT('/v1/events/{eventId}/assignment-lists/{listId}/teams/{teamId}', {
              ...p,
              body: value,
            }),
          )
        : unwrap(api.DELETE('/v1/events/{eventId}/assignment-lists/{listId}/teams/{teamId}', p)),
  );
  const label = `${list.name} for ${team.name}`;

  if (list.kind === 'text') {
    return (
      <Input
        aria-label={label}
        defaultValue={current?.label ?? ''}
        aria-invalid={save.isError || undefined}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v === (current?.label ?? '')) return;
          save.mutate(v ? { text: v } : null);
        }}
      />
    );
  }
  return (
    <Select
      value={current?.optionId ?? NONE}
      onValueChange={(v) => save.mutate(v === NONE ? null : { optionId: v })}
      disabled={save.isPending}
    >
      <SelectTrigger aria-label={label} className="w-full" aria-invalid={save.isError || undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {list.options.map((o) => (
          <SelectItem
            key={o.id}
            value={o.id}
            disabled={o.capacity !== null && o.teams >= o.capacity && o.id !== current?.optionId}
          >
            {o.title} <span className="text-muted-foreground">({fillLabel(o)})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
