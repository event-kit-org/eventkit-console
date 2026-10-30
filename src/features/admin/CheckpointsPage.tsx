import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Info, MapPin } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { EmptyState, RowsSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST, fromISTInput } from '@/lib/datetime';

const schema = z.object({
  name: z.string().trim().min(1, 'Name the checkpoint.').max(100),
  type: z.enum(['entry', 'meal', 'swag', 'session']),
  opensAt: z.string(),
  closesAt: z.string(),
  allowRepeat: z.boolean(),
  pollId: z.string(),
});
type Values = z.infer<typeof schema>;

const TYPE_LABEL = { entry: 'Entry', meal: 'Meal', swag: 'Swag', session: 'Session' };

export function CheckpointsPage() {
  const api = useApi();
  const { event, path, features } = useEventContext();
  const checkpoints = useQuery({
    queryKey: ['event', event.id, 'checkpoints'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/checkpoints', path)),
    enabled: features.scanning,
  });
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

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Checkpoints"
        description="Places where volunteers scan people's QR codes: the gate, meals, swag, sessions."
      />
      <Card>
        <CardHeader>
          <CardTitle>New checkpoint</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={form.handleSubmit((v) => create.mutate(v, { onSuccess: () => form.reset() }))}
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
              <div>
                <Button type="submit" disabled={create.isPending}>
                  Add checkpoint
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <ErrorAlert error={checkpoints.error ?? remove.error} />
      {checkpoints.isPending && <RowsSkeleton />}
      {checkpoints.data?.length === 0 && <EmptyState icon={MapPin} title="No checkpoints yet." />}
      <ul className="grid gap-2">
        {checkpoints.data?.map((c) => (
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
            <ConfirmButton
              size="sm"
              variant="outline"
              title={`Delete ${c.name}?`}
              description="This can't be undone."
              confirmLabel="Delete"
              destructive
              onConfirm={() => remove.mutate(c.id)}
            >
              Delete
            </ConfirmButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
