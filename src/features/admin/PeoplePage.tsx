import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { type Schemas, unwrap } from '@/api/client';
import { useApi, useAuth } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

type Member = Schemas['Member'];
type StaffRole = 'volunteer' | 'judge';
type OrganiserRole = 'admin' | 'reviewer';
const STAFF_ROLES: StaffRole[] = ['volunteer', 'judge'];
const ORGANISER_ROLES: OrganiserRole[] = ['admin', 'reviewer'];
const ORGANISER_LABEL: Record<OrganiserRole, string> = { admin: 'Co-admin', reviewer: 'Reviewer' };
const isOrganiser = (m: Member) => m.role === 'admin' || m.role === 'reviewer';

export function PeoplePage() {
  const api = useApi();
  const { event, path } = useEventContext();
  const members = useQuery({
    queryKey: ['event', event.id, 'members'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/members', path)),
  });
  const p = (userId: string) => ({ params: { path: { eventId: event.id, userId } } });
  const change = useEventMutation(
    event.id,
    ({ userId, role }: { userId: string; role: StaffRole | OrganiserRole }) =>
      unwrap(api.PATCH('/v1/events/{eventId}/members/{userId}', { ...p(userId), body: { role } })),
  );
  const remove = useEventMutation(event.id, (userId: string) =>
    unwrap(api.DELETE('/v1/events/{eventId}/members/{userId}', p(userId))),
  );
  const organisers = members.data?.filter(isOrganiser) ?? [];
  const staff = members.data?.filter((m) => !isOrganiser(m)) ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="People"
        description="Who runs this event with you, and its volunteers and judges."
      />
      <ErrorAlert error={members.error ?? change.error ?? remove.error} />
      {members.isPending && <TableSkeleton rows={4} cols={3} />}
      {members.data && (
        <>
          <Organisers
            organisers={organisers}
            onRole={(userId, role) => change.mutate({ userId, role })}
            onRemove={(userId) => remove.mutate(userId)}
          />
          <Staff
            staff={staff}
            onRole={(userId, role) => change.mutate({ userId, role })}
            onRemove={(userId) => remove.mutate(userId)}
          />
        </>
      )}
    </div>
  );
}

/** The owner, co-admins and reviewers. Only the owner adds, changes or removes them. */
function Organisers(props: {
  organisers: Member[];
  onRole: (userId: string, role: OrganiserRole) => void;
  onRemove: (userId: string) => void;
}) {
  const { isOwner } = useEventContext();
  const { user } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organisers</CardTitle>
        <CardDescription>
          Co-admins can do everything except delete the event, billing, API keys and organisers.
          Reviewers work through teams and payments: shortlisting, confirming and receipts. Both
          need an eventKit account and work in this console. Reviewers who want to leave ask the
          owner to remove them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-hidden rounded-lg border">
          <Table>
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
              {props.organisers.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </TableCell>
                  <TableCell>
                    {m.isOwner || !isOwner ? (
                      <Badge variant="secondary">
                        {m.isOwner ? 'Owner' : ORGANISER_LABEL[m.role as OrganiserRole]}
                      </Badge>
                    ) : (
                      <NativeSelect
                        size="sm"
                        aria-label={`Role of ${m.name}`}
                        className="w-36"
                        value={m.role}
                        onChange={(e) => props.onRole(m.userId, e.target.value as OrganiserRole)}
                      >
                        {ORGANISER_ROLES.map((r) => (
                          <NativeSelectOption key={r} value={r}>
                            {ORGANISER_LABEL[r]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!m.isOwner && isOwner && (
                      <ConfirmButton
                        size="sm"
                        variant="outline"
                        title={`Remove ${m.name} from the event?`}
                        description="They stop seeing the event in their console straight away. Their eventKit account stays."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => props.onRemove(m.userId)}
                      >
                        Remove
                      </ConfirmButton>
                    )}
                    {!m.isOwner && m.userId === user?.id && <LeaveEvent />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {isOwner && <AddOrganiser />}
      </CardContent>
    </Card>
  );
}

function AddOrganiser() {
  const api = useApi();
  const { event, path } = useEventContext();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganiserRole>('reviewer');
  const add = useEventMutation(event.id, () =>
    unwrap(api.POST('/v1/events/{eventId}/members', { ...path, body: { email, role } })),
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(undefined, { onSuccess: () => setEmail('') });
  };
  return (
    <form className="grid gap-2" onSubmit={submit} aria-label="Add an organiser">
      <div className="flex flex-wrap gap-2">
        <Input
          type="email"
          required
          aria-label="Their eventKit email"
          placeholder="Their eventKit email"
          className="min-w-56 flex-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <NativeSelect
          aria-label="Role"
          className="w-36"
          value={role}
          onChange={(e) => setRole(e.target.value as OrganiserRole)}
        >
          {ORGANISER_ROLES.map((r) => (
            <NativeSelectOption key={r} value={r}>
              {ORGANISER_LABEL[r]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" disabled={add.isPending || !email.trim()}>
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        They need an eventKit account first: send them this console's sign-up page.
      </p>
      <ErrorAlert error={add.error} />
    </form>
  );
}

/** Volunteers and judges: portal accounts made through staff links. */
function Staff(props: {
  staff: Member[];
  onRole: (userId: string, role: StaffRole) => void;
  onRemove: (userId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff</CardTitle>
        <CardDescription>
          Volunteers and judges join through a staff link (Links) and sign in on the event's portal.
          Removing someone ends their access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {props.staff.length === 0 ? (
          <EmptyState icon={UserCog} title="No staff yet." />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
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
                {props.staff.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.email}
                        {m.phone && ` · ${m.phone}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        size="sm"
                        aria-label={`Role of ${m.name}`}
                        className="w-36"
                        value={m.role}
                        onChange={(e) => props.onRole(m.userId, e.target.value as StaffRole)}
                      >
                        {STAFF_ROLES.map((r) => (
                          <NativeSelectOption key={r} value={r}>
                            {roleLabel[r]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfirmButton
                        size="sm"
                        variant="outline"
                        title={`Remove ${m.name} from the event?`}
                        description="Their access to the event ends straight away."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => props.onRemove(m.userId)}
                      >
                        Remove
                      </ConfirmButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
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
    <div className="flex items-center justify-end gap-2">
      <span className="text-xs text-muted-foreground">You</span>
      <ConfirmButton
        size="sm"
        variant="outline"
        title={`Leave ${event.name}?`}
        description="It disappears from your console. The owner can add you again."
        confirmLabel="Leave"
        destructive
        onConfirm={() => leave.mutate()}
      >
        Leave
      </ConfirmButton>
      <ErrorAlert error={leave.error} />
    </div>
  );
}
