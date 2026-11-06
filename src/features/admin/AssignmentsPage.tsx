import { useQuery } from '@tanstack/react-query';
import { Download, Eye, EyeOff, MoreHorizontal, Plus, Shuffle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  DropdownMenuContent,
  DropdownMenuItem,
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
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
          <div className="grid gap-4 xl:grid-cols-2">
            {all.map((l) => (
              <ListCard key={l.id} list={l} teams={active} />
            ))}
          </div>
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

function ListCard({ list, teams }: { list: List; teams: Team[] }) {
  const api = useApi();
  const { event } = useEventContext();
  const p = { params: { path: { eventId: event.id, listId: list.id } } };
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

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{list.name}</CardTitle>
        <CardDescription>
          {list.kind === 'options' ? 'Options' : 'Typed values'} · {list.assignedTeams} of{' '}
          {teams.length} teams assigned
        </CardDescription>
        <CardAction className="flex items-center gap-1">
          <Badge variant={released ? 'default' : 'secondary'}>
            {released ? 'Released' : 'Hidden'}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More for ${list.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {list.kind === 'options' && (
                <DropdownMenuItem
                  disabled={unassigned.length === 0 || list.options.length === 0}
                  onSelect={() => setPlan(randomFill(unassigned, list.options))}
                >
                  <Shuffle aria-hidden /> Random fill
                </DropdownMenuItem>
              )}
              {released && (
                <DropdownMenuItem onSelect={() => release.mutate(false)}>
                  <EyeOff aria-hidden /> Hide from participants
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(undefined)}>
                <Trash2 aria-hidden /> Delete list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {list.kind === 'options' && <OptionsTable list={list} />}
        <ErrorAlert error={release.error ?? remove.error ?? fill.error} />
        {!released && (
          <ConfirmButton
            variant="outline"
            className="w-fit"
            title={`Release ${list.name}?`}
            description="Every team sees its value on its team page at once. You can hide it again."
            confirmLabel="Release"
            onConfirm={() => release.mutate(true)}
            disabled={release.isPending}
          >
            <Eye aria-hidden /> Release to participants
          </ConfirmButton>
        )}
      </CardContent>
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
    </Card>
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
                <TableCell className="min-w-56">
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
        <Field className="min-w-48 flex-1">
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

function AssignmentGrid({ lists, teams }: { lists: List[]; teams: Team[] }) {
  const [filter, setFilter] = useState('');
  const shown = filter ? teams.filter((t) => !t.assignments[filter]) : teams;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Teams</CardTitle>
        <CardDescription>Changes save as you make them.</CardDescription>
        <CardAction>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="assign-filter" className="sr-only">
              Show
            </FieldLabel>
            <NativeSelect
              id="assign-filter"
              size="sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <NativeSelectOption value="">All teams</NativeSelectOption>
              {lists.map((l) => (
                <NativeSelectOption key={l.id} value={l.id}>
                  Unassigned in {l.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </CardAction>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyDescription>
                {teams.length === 0 ? 'No teams have registered yet.' : 'Every team has one.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
                {lists.map((l) => (
                  <TableHead key={l.id} className="min-w-44">
                    {l.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={teamDisplayStatus(t)} />
                  </TableCell>
                  {lists.map((l) => (
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
