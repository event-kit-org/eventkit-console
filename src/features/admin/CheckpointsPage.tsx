import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
    return <Alert>Checkpoints are part of the scanning feature. Turn it on in Settings.</Alert>;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>New checkpoint</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit((v) => create.mutate(v, { onSuccess: () => form.reset() }))}
            noValidate
          >
            <FormField
              label="Name"
              placeholder="e.g. Main gate, Lunch day 1"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <div className="grid gap-2">
              <Label htmlFor="cp-type">Type</Label>
              <Select id="cp-type" {...form.register('type')}>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
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
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="cp-poll">Food poll (optional)</Label>
                <Select id="cp-poll" {...form.register('pollId')}>
                  <option value="">None</option>
                  {foodPolls.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.question}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Scanning shows each person&apos;s choice; people who didn&apos;t vote get the
                  poll&apos;s default. Only polls with a default option are listed.
                </p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" {...form.register('allowRepeat')} />
              Allow repeat scans (e.g. re-entry)
            </label>
            <div className="sm:col-span-2">
              <ErrorAlert error={create.error} />
              <Button type="submit" disabled={create.isPending}>
                Add checkpoint
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ErrorAlert error={checkpoints.error ?? remove.error} />
      <ul className="grid gap-2">
        {checkpoints.data?.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 text-sm"
          >
            <div>
              <span className="font-medium">{c.name}</span> · {TYPE_LABEL[c.type]}
              {c.allowRepeat && ' · repeats allowed'}
              <div className="text-xs text-muted-foreground">
                {c.opensAt ? `From ${formatIST(c.opensAt)}` : 'Always open'}
                {c.closesAt && ` until ${formatIST(c.closesAt)}`}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => remove.mutate(c.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
