import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ellipsis, LogOut, Pencil, UserCog, UserMinus, UserPlus } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { type Schemas, unwrap } from '@/api/client';
import { useApi, useAuth } from '@/auth/context';
import { ConfirmButton, ConfirmDialog } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { Pager, usePage } from '@/components/Pager';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { roleLabel } from '@/features/events/roles';
import { useEventMutation } from '@/hooks/useEventMutation';
import { useListFilter } from '@/hooks/useListFilter';

type Member = Schemas['Member'];
type StaffRole = 'volunteer' | 'judge';
type OrganiserRole = 'admin' | 'reviewer';
const STAFF_ROLES: StaffRole[] = ['volunteer', 'judge'];
const ORGANISER_ROLES: OrganiserRole[] = ['admin', 'reviewer'];
const ORGANISER_LABEL: Record<OrganiserRole, string> = { admin: 'Co-admin', reviewer: 'Reviewer' };
const isOrganiser = (m: Member) => m.role === 'admin' || m.role === 'reviewer';

function useMembers() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useQuery({
    queryKey: ['event', event.id, 'members'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/members', path)),
  });
}

function useMemberActions() {
  const api = useApi();
  const { event } = useEventContext();
  const p = (userId: string) => ({ params: { path: { eventId: event.id, userId } } });
  const change = useEventMutation(
    event.id,
    ({ userId, role }: { userId: string; role: StaffRole | OrganiserRole }) =>
      unwrap(api.PATCH('/v1/events/{eventId}/members/{userId}', { ...p(userId), body: { role } })),
  );
  const remove = useEventMutation(event.id, (userId: string) =>
    unwrap(api.DELETE('/v1/events/{eventId}/members/{userId}', p(userId))),
  );
  // Admins score teams on the portal only while this is on; they stay admins.
  const judging = useEventMutation(
    event.id,
    ({ userId, canJudge }: { userId: string; canJudge: boolean }) =>
      unwrap(
        api.PUT('/v1/events/{eventId}/members/{userId}/judging', {
          ...p(userId),
          body: { canJudge },
        }),
      ),
  );
  return { change, remove, judging };
}

const organiserRole = (m: Member) =>
  m.isOwner ? 'Owner' : ORGANISER_LABEL[m.role as OrganiserRole];

/**
 * The owner, co-admins and reviewers: a table, each edited in a popup. Only the
 * owner adds organisers, changes their role or removes them; any admin turns
 * judging on for an admin.
 */
export function PeoplePage() {
  const { isOwner } = useEventContext();
  const { user } = useAuth();
  const members = useMembers();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const organisers = members.data?.filter(isOrganiser) ?? [];
  const canEdit = (m: Member) =>
    m.role === 'admin' || (isOwner && !m.isOwner) || (!m.isOwner && m.userId === user?.id);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Team & roles"
        description="Co-admins can do everything except delete the event, billing, API keys and organisers. Reviewers work through teams and payments: shortlisting, confirming and receipts. Both need an eventKit account. Admins score teams on the portal only once judging is allowed for them."
      >
        {isOwner && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden /> Add member
          </Button>
        )}
      </PageHeader>
      <ErrorAlert error={members.error} />
      {members.isPending && <TableSkeleton rows={3} cols={3} />}
      {members.data && (
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label="Organisers">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>
                  <span className="sr-only">Edit</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organisers.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium wrap-anywhere">
                      {m.name}
                      {m.userId === user?.id && (
                        <span className="font-normal text-muted-foreground"> (you)</span>
                      )}
                    </div>
                    <div className="text-xs break-all text-muted-foreground">{m.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{organiserRole(m)}</span>
                      {m.role === 'admin' && m.canJudge && (
                        <Badge variant="secondary">Judges</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit(m) && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Edit ${m.name}`}
                        onClick={() => setEditing(m)}
                      >
                        <Pencil aria-hidden />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {adding && <AddOrganiserDialog onClose={() => setAdding(false)} />}
      {editing && (
        <EditOrganiserDialog
          key={editing.userId}
          member={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Allow judging, change role, remove (or leave, for yourself). */
function EditOrganiserDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const { isOwner } = useEventContext();
  const { user } = useAuth();
  const { change, remove, judging } = useMemberActions();
  const [role, setRole] = useState(member.role as OrganiserRole);
  const [canJudge, setCanJudge] = useState(member.canJudge);
  const [confirm, setConfirm] = useState(false);
  const self = member.userId === user?.id;
  const ownerControls = isOwner && !member.isOwner;
  const busy = change.isPending || judging.isPending || remove.isPending;
  const dirty = role !== member.role || (role === 'admin' && canJudge !== member.canJudge);
  const save = async () => {
    if (role !== member.role) await change.mutateAsync({ userId: member.userId, role });
    if (role === 'admin' && canJudge !== member.canJudge) {
      await judging.mutateAsync({ userId: member.userId, canJudge });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">Edit {member.name}</DialogTitle>
          <DialogDescription className="break-all">{member.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field data-disabled={!ownerControls || undefined}>
            <FieldLabel htmlFor="organiser-role">Role</FieldLabel>
            <NativeSelect
              id="organiser-role"
              className="w-full"
              disabled={!ownerControls}
              value={member.isOwner ? 'owner' : role}
              onChange={(e) => setRole(e.target.value as OrganiserRole)}
            >
              {member.isOwner && <NativeSelectOption value="owner">Owner</NativeSelectOption>}
              {ORGANISER_ROLES.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {ORGANISER_LABEL[r]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {!ownerControls && (
              <FieldDescription>
                {member.isOwner
                  ? "The owner's role can't change."
                  : 'Only the owner changes roles.'}
              </FieldDescription>
            )}
          </Field>
          {role === 'admin' && (
            <Field orientation="horizontal">
              <Switch id="organiser-judges" checked={canJudge} onCheckedChange={setCanJudge} />
              <div className="grid gap-1">
                <FieldLabel htmlFor="organiser-judges">Allow judging</FieldLabel>
                <FieldDescription>They score teams on the event's portal.</FieldDescription>
              </div>
            </Field>
          )}
          <ErrorAlert error={change.error ?? judging.error ?? remove.error} />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {ownerControls ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <UserMinus aria-hidden /> Remove member
            </Button>
          ) : self && !member.isOwner ? (
            <LeaveEvent />
          ) : (
            <span />
          )}
          {(ownerControls || role === 'admin') && (
            <Button disabled={!dirty || busy} onClick={() => void save().catch(() => {})}>
              Save
            </Button>
          )}
        </DialogFooter>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={`Remove ${member.name} from the event?`}
          description="They stop seeing the event in their console straight away. Their eventKit account stays."
          confirmLabel="Remove"
          destructive
          onConfirm={() => remove.mutate(member.userId, { onSuccess: onClose })}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddOrganiserDialog({ onClose }: { onClose: () => void }) {
  const api = useApi();
  const { event, path } = useEventContext();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganiserRole>('reviewer');
  const add = useEventMutation(event.id, () =>
    unwrap(api.POST('/v1/events/{eventId}/members', { ...path, body: { email, role } })),
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(undefined, { onSuccess: onClose });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit} aria-label="Add an organiser">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              They need an eventKit account first: send them this console's sign-up page.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="organiser-email">Their eventKit email</FieldLabel>
            <Input
              id="organiser-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="organiser-new-role">Role</FieldLabel>
            <NativeSelect
              id="organiser-new-role"
              className="w-full"
              value={role}
              onChange={(e) => setRole(e.target.value as OrganiserRole)}
            >
              {ORGANISER_ROLES.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {ORGANISER_LABEL[r]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <ErrorAlert error={add.error} />
          <DialogFooter>
            <Button type="submit" disabled={add.isPending || !email.trim()}>
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const memberText = (m: Member) => [m.name, m.email, m.phone, roleLabel[m.role]];

/** Volunteers and judges: portal accounts made through staff links. */
export function StaffPage() {
  const members = useMembers();
  const { change, remove } = useMemberActions();
  const staff = useMemo(() => members.data?.filter((m) => !isOrganiser(m)) ?? [], [members.data]);
  const search = useListFilter(staff, memberText);
  const page = usePage(search.filtered);
  const [removing, setRemoving] = useState<Member | null>(null);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Staff"
        description="Volunteers and judges join through a staff link (Links) and sign in on the event's portal. Removing someone ends their access."
      />
      <ErrorAlert error={members.error ?? change.error ?? remove.error} />
      {members.isPending && <TableSkeleton rows={4} cols={3} />}
      {staff.length > 0 && (
        <SearchInput
          label="Search staff"
          placeholder="Name, email or role"
          value={search.query}
          onChange={search.setQuery}
        />
      )}
      {members.data &&
        (staff.length === 0 ? (
          <EmptyState icon={UserCog} title="No staff yet." />
        ) : search.filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody matches.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table aria-label="Staff">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium wrap-anywhere">{m.name}</div>
                      <div className="text-xs break-all text-muted-foreground">
                        {m.email}
                        {m.phone && ` · ${m.phone}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        size="sm"
                        aria-label={`Role of ${m.name}`}
                        className="w-28 sm:w-36"
                        value={m.role}
                        onChange={(e) =>
                          change.mutate({ userId: m.userId, role: e.target.value as StaffRole })
                        }
                      >
                        {STAFF_ROLES.map((r) => (
                          <NativeSelectOption key={r} value={r}>
                            {roleLabel[r]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={`More for ${m.name}`}>
                            <Ellipsis aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(m)}>
                            <UserMinus aria-hidden /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      <Pager {...page} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name} from the event?`}
        description="Their access to the event ends straight away."
        confirmLabel="Remove"
        destructive
        onConfirm={() => removing && remove.mutate(removing.userId)}
      />
    </div>
  );
}

/** A co-admin takes themselves out of the event. The owner never can. */
function LeaveEvent() {
  const api = useApi();
  const { user } = useAuth();
  const { event } = useEventContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leave = useMutation({
    mutationFn: () =>
      unwrap(
        api.DELETE('/v1/events/{eventId}/members/{userId}', {
          params: { path: { eventId: event.id, userId: user!.id } },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      void navigate('/');
    },
  });
  return (
    <div className="grid gap-2">
      <ConfirmButton
        variant="ghost"
        className="text-destructive hover:text-destructive"
        title={`Leave ${event.name}?`}
        description="It disappears from your console. The owner can add you again."
        confirmLabel="Leave"
        destructive
        onConfirm={() => leave.mutate()}
      >
        <LogOut aria-hidden /> Leave
      </ConfirmButton>
      <ErrorAlert error={leave.error} />
    </div>
  );
}
