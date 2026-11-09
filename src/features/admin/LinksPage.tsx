import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Ban, Check, Copy, Ellipsis, KeyRound, Link2, Plus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmButton';
import { CopyButton } from '@/components/CopyButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { Pager, usePage } from '@/components/Pager';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEventContext } from '@/features/events/event-context';
import { roleLabel } from '@/features/events/roles';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST, fromISTInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { useListFilter } from '@/hooks/useListFilter';

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

type LinkRow = Schemas['InviteLink'];
const linkText = (l: LinkRow) => [l.label, l.role, l.url];

export function LinksPage() {
  const api = useApi();
  const { event, path, features } = useEventContext();
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const links = useQuery({
    queryKey: ['event', event.id, 'links'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/invite-links', path)),
  });
  const search = useListFilter(links.data ?? [], linkText);
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

  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<LinkRow | null>(null);
  const page = usePage(search.filtered);
  const closeCreate = (open: boolean) => {
    setCreating(open);
    if (!open) {
      setCreated(null);
      create.reset();
      form.reset({ role: 'participant', label: '', password: '', expiresAt: '' });
    }
  };

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Links"
        description="Teams register through a registration link; volunteers and judges join through a staff link."
      >
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden /> New link
        </Button>
      </PageHeader>
      {!event.portalUrl && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <TriangleAlert aria-hidden />
          <AlertDescription className="text-current">
            <p>
              Links point to your event's portal. Set its URL in{' '}
              <Link to="../portal">Portal connection</Link> to get shareable links.
            </p>
          </AlertDescription>
        </Alert>
      )}
      <Dialog open={creating} onOpenChange={closeCreate}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          {created ? (
            <div className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Link created</DialogTitle>
                <DialogDescription>
                  {created.requiresPassword
                    ? 'Share the password separately from the link.'
                    : 'Share it wherever teams will find it.'}
                </DialogDescription>
              </DialogHeader>
              {created.url ? (
                <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/50 p-2">
                  <code className="min-w-0 flex-1 font-mono text-xs break-all">{created.url}</code>
                  <CopyButton value={created.url} label="link" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set the portal URL in Portal connection to get a shareable link.
                </p>
              )}
              <DialogFooter>
                <Button onClick={() => closeCreate(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) =>
                create.mutate(v, { onSuccess: (l) => setCreated(l) }),
              )}
              noValidate
            >
              <DialogHeader>
                <DialogTitle>New link</DialogTitle>
                <DialogDescription>
                  Staff links need a password, which you share separately.
                </DialogDescription>
              </DialogHeader>
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
              <ErrorAlert error={create.error} />
              {role === 'participant' && !features.registration && (
                <p className="text-sm text-destructive">
                  Registration links need the registration feature.
                </p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Create link
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ErrorAlert error={links.error ?? revoke.error} />
      {links.isPending && <TableSkeleton cols={4} />}
      {links.data && links.data.length > 0 && (
        <SearchInput
          label="Search links"
          className="sm:w-72"
          value={search.query}
          onChange={search.setQuery}
        />
      )}
      {links.data && search.filtered.length === 0 && (
        <EmptyState icon={Link2} title={search.active ? 'No link matches.' : 'No links yet.'} />
      )}
      {page.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label="Your links">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead className="hidden lg:table-cell">URL</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((l) => {
                const status = l.revokedAt
                  ? `Revoked ${formatIST(l.revokedAt)}`
                  : l.expiresAt
                    ? `Expires ${formatIST(l.expiresAt)}`
                    : 'No expiry';
                return (
                  <TableRow key={l.id} className={cn(l.revokedAt && 'opacity-60')}>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {l.kind === 'registration'
                            ? 'Registration'
                            : `Staff: ${roleLabel[l.role]}`}
                        </span>
                        {l.label && <Badge variant="secondary">{l.label}</Badge>}
                        {l.requiresPassword && (
                          <Badge variant="outline">
                            <KeyRound aria-hidden /> password
                          </Badge>
                        )}
                      </div>
                      {/* What the hidden column holds, on phones. */}
                      <div className="text-xs text-muted-foreground sm:hidden">{status}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {l.url ? (
                        <code className="block max-w-64 truncate font-mono text-xs" title={l.url}>
                          {l.url}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {status}
                    </TableCell>
                    <TableCell>
                      {!l.revokedAt && (
                        <div className="flex items-center justify-end gap-1">
                          {l.url && (
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={copied === l.url ? 'Copied' : 'Copy link'}
                              onClick={() => void copy(l.url!)}
                            >
                              {copied === l.url ? <Check aria-hidden /> : <Copy aria-hidden />}
                              <span className="hidden xl:inline">
                                {copied === l.url ? 'Copied' : 'Copy link'}
                              </span>
                            </Button>
                          )}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="More for this link"
                              >
                                <Ellipsis aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setRevoking(l.id)}
                              >
                                <Ban aria-hidden /> Revoke
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager {...page} />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke this link?"
        description="It stops working at once. This can't be undone."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => revoking && revoke.mutate(revoking)}
      />
    </div>
  );
}
