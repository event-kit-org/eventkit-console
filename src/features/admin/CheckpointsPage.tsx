import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Ellipsis, Info, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { EmptyState, RowsSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { EditCheckpointDialog } from './EditCheckpointDialog';
import { ExitReasonsCard } from './ExitReasonsCard';
import { formatIST, fromISTInput } from '@/lib/datetime';
import { useListFilter } from '@/hooks/useListFilter';

const schema = z.object({
  name: z.string().trim().min(1, 'Name the checkpoint.').max(100),
  type: z.enum(['entry', 'gate', 'meal', 'swag', 'session']),
  opensAt: z.string(),
  closesAt: z.string(),
  allowRepeat: z.boolean(),
  pollId: z.string(),
});
type Values = z.infer<typeof schema>;

const TYPE_LABEL = {
  entry: 'Check-in',
  gate: 'Entry & exit',
  meal: 'Meal',
  swag: 'Swag',
  session: 'Session',
};

type Checkpoint = Schemas['Checkpoint'];

const checkpointText = (c: { name: string; type: string }) => [c.name, c.type];

export function CheckpointsPage() {
  const api = useApi();
  const { event, path, features } = useEventContext();
  const checkpoints = useQuery({
    queryKey: ['event', event.id, 'checkpoints'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/checkpoints', path)),
    enabled: features.scanning,
  });
  const search = useListFilter(checkpoints.data ?? [], checkpointText);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Checkpoint | null>(null);
  const [deleting, setDeleting] = useState<Checkpoint | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: 'entry',
      opensAt: '',
      closesAt: '',
      allowRepeat: false,
      pollId: '',
    },
  });
  const type = useWatch({ control: form.control, name: 'type' });
  // Meal checkpoints can show what each person chose in a food poll (one with a default).
  const polls = useQuery({
    queryKey: ['event', event.id, 'polls'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/polls', path)),
    enabled: features.scanning && type === 'meal',
  });
  const foodPolls = (polls.data ?? []).filter((p) => p.defaultOptionId !== null);
  const create = useEventMutation(event.id, (v: Values) =>
    unwrap(
      api.POST('/v1/events/{eventId}/checkpoints', {
        ...path,
        body: {
          name: v.name,
          type: v.type,
          opensAt: v.opensAt ? fromISTInput(v.opensAt) : null,
          closesAt: v.closesAt ? fromISTInput(v.closesAt) : null,
          allowRepeat: v.allowRepeat,
          pollId: v.type === 'meal' && v.pollId ? v.pollId : null,
        },
      }),
    ),
  );
  const remove = useEventMutation(event.id, (checkpointId: string) =>
    unwrap(
      api.DELETE('/v1/events/{eventId}/checkpoints/{checkpointId}', {
        params: { path: { eventId: event.id, checkpointId } },
      }),
    ),
  );

  if (!features.scanning) {
    return (
      <Alert>
        <Info aria-hidden />
        <AlertDescription>
          Checkpoints are part of the scanning feature. Turn it on in Settings.
        </AlertDescription>
      </Alert>
    );
  }

  const closeAdd = (open: boolean) => {
    setAdding(open);
    if (!open) {
      form.reset();
      create.reset();
    }
  };

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Checkpoints"
        description="Places where volunteers scan people's QR codes: check-in, the venue door (in and out), meals, swag, sessions."
      >
        {checkpoints.data && checkpoints.data.length > 0 && (
          <SearchInput
            label="Search checkpoints"
            className="w-48 sm:w-56"
            value={search.query}
            onChange={search.setQuery}
          />
        )}
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Add checkpoint
        </Button>
      </PageHeader>
      <Dialog open={adding} onOpenChange={closeAdd}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New checkpoint</DialogTitle>
            <DialogDescription>
              Volunteers scan people here on the event's portal.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={form.handleSubmit((v) =>
              create.mutate(v, { onSuccess: () => closeAdd(false) }),
            )}
            noValidate
          >
            <FormField
              label="Name"
              placeholder="e.g. Main gate, Lunch day 1"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Field>
              <FieldLabel htmlFor="cp-type">Type</FieldLabel>
              <NativeSelect id="cp-type" className="w-full" {...form.register('type')}>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <FormField
              label="Opens (IST, optional)"
              type="datetime-local"
              {...form.register('opensAt')}
            />
            <FormField
              label="Closes (IST, optional)"
              type="datetime-local"
              {...form.register('closesAt')}
            />
            {type === 'meal' && (
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="cp-poll">Food poll (optional)</FieldLabel>
                <NativeSelect id="cp-poll" className="w-full" {...form.register('pollId')}>
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {foodPolls.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.question}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  Scanning shows each person&apos;s choice; people who didn&apos;t vote get the
                  poll&apos;s default. Only polls with a default option are listed.
                </FieldDescription>
              </Field>
            )}
            {type === 'gate' && (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                The venue&apos;s door after check-in. Scanning someone inside lets them out (the
                volunteer picks a reason); scanning them again lets them back in.
              </p>
            )}
            <Controller
              control={form.control}
              name="allowRepeat"
              render={({ field }) => (
                <Field orientation="horizontal" className="sm:col-span-2">
                  <Checkbox
                    id="cp-repeat"
                    checked={field.value}
                    onCheckedChange={(c) => field.onChange(c === true)}
                  />
                  <FieldLabel htmlFor="cp-repeat" className="font-normal">
                    Allow repeat scans (e.g. re-entry)
                  </FieldLabel>
                </Field>
              )}
            />
            <div className="grid gap-3 sm:col-span-2">
              <ErrorAlert error={create.error} />
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Add checkpoint
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ErrorAlert error={checkpoints.error ?? remove.error} />
      {checkpoints.isPending && <RowsSkeleton />}
      {checkpoints.data && search.filtered.length === 0 && (
        <EmptyState
          icon={MapPin}
          title={search.active ? 'No checkpoint matches.' : 'No checkpoints yet.'}
        />
      )}
      <ul className="grid gap-2">
        {search.filtered.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm"
          >
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <Badge variant="secondary">{TYPE_LABEL[c.type]}</Badge>
                {c.allowRepeat && <Badge variant="outline">repeats allowed</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {c.opensAt ? `From ${formatIST(c.opensAt)}` : 'Always open'}
                {c.closesAt && ` until ${formatIST(c.closesAt)}`}
              </div>
            </div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`More for ${c.name}`}>
                  <Ellipsis aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(c)}>
                  <Pencil aria-hidden /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      {editing && <EditCheckpointDialog checkpoint={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
      <ExitReasonsCard />
    </div>
  );
}
