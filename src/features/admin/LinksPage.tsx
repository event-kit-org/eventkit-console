import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useEventContext } from '@/features/events/event-context';
import { roleLabel } from '@/features/events/roles';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST, fromISTInput } from '@/lib/datetime';
import { Link } from 'react-router';

const schema = z
  .object({
    role: z.enum(['participant', 'volunteer', 'judge']),
    label: z.string().trim().max(100),
    password: z.string(),
    expiresAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.role !== 'participant' && v.password.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Staff links need a password of 8+ characters.',
      });
    }
  });
type Values = z.infer<typeof schema>;

export function LinksPage() {
  const api = useApi();
  const { event, path, features } = useEventContext();
  const [copied, setCopied] = useState<string | null>(null);
  const links = useQuery({
    queryKey: ['event', event.id, 'links'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/invite-links', path)),
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'participant', label: '', password: '', expiresAt: '' },
  });
  const create = useEventMutation(event.id, (v: Values) =>
    unwrap(
      api.POST('/v1/events/{eventId}/invite-links', {
        ...path,
        body: {
          role: v.role,
          ...(v.label ? { label: v.label } : {}),
          ...(v.role !== 'participant' ? { password: v.password } : {}),
          ...(v.expiresAt ? { expiresAt: fromISTInput(v.expiresAt) } : {}),
        },
      }),
    ),
  );
  const revoke = useEventMutation(event.id, (linkId: string) =>
    unwrap(
      api.DELETE('/v1/events/{eventId}/invite-links/{linkId}', {
        params: { path: { eventId: event.id, linkId } },
      }),
    ),
  );
  const role = useWatch({ control: form.control, name: 'role' });

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
  };

  return (
    <div className="grid gap-4">
      {!event.portalUrl && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          Links point to your event's portal. Set its URL in{' '}
          <Link className="underline" to="../settings">
            Portal &amp; settings
          </Link>{' '}
          to get shareable links.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>New link</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit((v) =>
              create.mutate(v, { onSuccess: () => form.reset({ ...v, label: '', password: '' }) }),
            )}
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="link-role">Role</Label>
              <Select id="link-role" {...form.register('role')}>
                {(['participant', 'volunteer', 'judge'] as const).map((r) => (
                  <option key={r} value={r}>
                    {r === 'participant' ? 'Registration (teams)' : `Staff: ${roleLabel[r]}`}
                  </option>
                ))}
              </Select>
            </div>
            <FormField
              label="Label (optional)"
              placeholder="e.g. Instagram"
              {...form.register('label')}
            />
            {role !== 'participant' && (
              <FormField
                label="Link password"
                type="password"
                autoComplete="new-password"
                hint="Share it separately from the link."
                error={form.formState.errors.password?.message}
                {...form.register('password')}
              />
            )}
            <FormField
              label="Expires (IST, optional)"
              type="datetime-local"
              {...form.register('expiresAt')}
            />
            <div className="sm:col-span-2">
              <ErrorAlert error={create.error} />
              {role === 'participant' && !features.registration && (
                <p className="mb-2 text-sm text-destructive">
                  Registration links need the registration feature.
                </p>
              )}
              <Button type="submit" disabled={create.isPending}>
                Create link
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ErrorAlert error={links.error ?? revoke.error} />
      <ul className="grid gap-2">
        {links.data?.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 text-sm"
          >
            <div>
              <span className="font-medium">
                {l.kind === 'registration' ? 'Registration' : `Staff: ${roleLabel[l.role]}`}
              </span>
              {l.label && <span> · {l.label}</span>}
              {l.requiresPassword && <span className="text-muted-foreground"> · password</span>}
              <div className="text-xs text-muted-foreground">
                {l.revokedAt
                  ? `Revoked ${formatIST(l.revokedAt)}`
                  : l.expiresAt
                    ? `Expires ${formatIST(l.expiresAt)}`
                    : 'No expiry'}
              </div>
              {l.url && <div className="break-all font-mono text-xs">{l.url}</div>}
            </div>
            {!l.revokedAt && (
              <div className="flex gap-2">
                {l.url && (
                  <Button size="sm" variant="outline" onClick={() => void copy(l.url!)}>
                    {copied === l.url ? 'Copied' : 'Copy link'}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => revoke.mutate(l.id)}>
                  Revoke
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
