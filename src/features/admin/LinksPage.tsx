import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Link2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useEventContext } from '@/features/events/event-context';
import { roleLabel } from '@/features/events/roles';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST, fromISTInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';

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
      <PageHeader
        title="Links"
        description="Teams register through a registration link; volunteers and judges join through a staff link."
      />
      {!event.portalUrl && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <TriangleAlert aria-hidden />
          <AlertDescription className="text-current">
            <p>
              Links point to your event's portal. Set its URL in{' '}
              <Link to="../settings">Portal &amp; settings</Link> to get shareable links.
            </p>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>New link</CardTitle>
          <CardDescription>
            Staff links need a password, which you share separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={form.handleSubmit((v) =>
              create.mutate(v, { onSuccess: () => form.reset({ ...v, label: '', password: '' }) }),
            )}
            noValidate
          >
            <Field>
              <FieldLabel htmlFor="link-role">Role</FieldLabel>
              <NativeSelect id="link-role" className="w-full" {...form.register('role')}>
                {(['participant', 'volunteer', 'judge'] as const).map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {r === 'participant' ? 'Registration (teams)' : `Staff: ${roleLabel[r]}`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
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
            <div className="grid gap-3 sm:col-span-2">
              <ErrorAlert error={create.error} />
              {role === 'participant' && !features.registration && (
                <p className="text-sm text-destructive">
                  Registration links need the registration feature.
                </p>
              )}
              <div>
                <Button type="submit" disabled={create.isPending}>
                  Create link
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <ErrorAlert error={links.error ?? revoke.error} />
      {links.isPending && <RowsSkeleton />}
      {links.data?.length === 0 && <EmptyState icon={Link2} title="No links yet." />}
      <ul className="grid gap-2" aria-label="Your links">
        {links.data?.map((l) => (
          <li
            key={l.id}
            className={cn(
              'flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm',
              l.revokedAt && 'opacity-60',
            )}
          >
            <div className="grid min-w-0 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {l.kind === 'registration' ? 'Registration' : `Staff: ${roleLabel[l.role]}`}
                </span>
                {l.label && <Badge variant="secondary">{l.label}</Badge>}
                {l.requiresPassword && (
                  <Badge variant="outline">
                    <KeyRound aria-hidden /> password
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {l.revokedAt
                  ? `Revoked ${formatIST(l.revokedAt)}`
                  : l.expiresAt
                    ? `Expires ${formatIST(l.expiresAt)}`
                    : 'No expiry'}
              </div>
              {l.url && (
                <code className="w-fit max-w-full rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
                  {l.url}
                </code>
              )}
            </div>
            {!l.revokedAt && (
              <div className="flex gap-2">
                {l.url && (
                  <Button size="sm" variant="outline" onClick={() => void copy(l.url!)}>
                    {copied === l.url ? <Check aria-hidden /> : <Copy aria-hidden />}
                    {copied === l.url ? 'Copied' : 'Copy link'}
                  </Button>
                )}
                <ConfirmButton
                  size="sm"
                  variant="outline"
                  title="Revoke this link?"
                  description="It stops working at once. This can't be undone."
                  confirmLabel="Revoke"
                  destructive
                  onConfirm={() => revoke.mutate(l.id)}
                >
                  Revoke
                </ConfirmButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
