import { useQuery } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { unwrap } from '@/api/client';
import { useApi, useAuth } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EmptyState, Loading } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
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

type StaffRole = 'volunteer' | 'judge';
const ROLES: StaffRole[] = ['volunteer', 'judge'];

export function PeoplePage() {
  const api = useApi();
  const { user } = useAuth();
  const { event, path } = useEventContext();
  const members = useQuery({
    queryKey: ['event', event.id, 'members'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/members', path)),
  });
  const p = (userId: string) => ({ params: { path: { eventId: event.id, userId } } });
  const change = useEventMutation(
    event.id,
    ({ userId, role }: { userId: string; role: StaffRole }) =>
      unwrap(api.PATCH('/v1/events/{eventId}/members/{userId}', { ...p(userId), body: { role } })),
  );
  const remove = useEventMutation(event.id, (userId: string) =>
    unwrap(api.DELETE('/v1/events/{eventId}/members/{userId}', p(userId))),
  );

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Staff"
        description="Volunteers and judges of this event. They join through a staff link (Links) and sign in on the event's portal. Removing someone ends their access."
      />
      <ErrorAlert error={members.error ?? change.error ?? remove.error} />
      {members.isPending && <Loading rows={2} />}
      {members.data?.length === 0 && <EmptyState icon={UserCog} title="No staff yet." />}
      {members.data && members.data.length > 0 && (
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
              {members.data.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.email}
                      {m.phone && ` · ${m.phone}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.role === 'admin' ? (
                      <Badge variant="secondary">{roleLabel[m.role]}</Badge>
                    ) : (
                      <NativeSelect
                        size="sm"
                        aria-label={`Role of ${m.name}`}
                        className="w-36"
                        value={m.role}
                        onChange={(e) =>
                          change.mutate({ userId: m.userId, role: e.target.value as StaffRole })
                        }
                      >
                        {ROLES.map((r) => (
                          <NativeSelectOption key={r} value={r}>
                            {roleLabel[r]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.userId !== user?.id && m.role !== 'admin' && (
                      <ConfirmButton
                        size="sm"
                        variant="outline"
                        title={`Remove ${m.name} from the event?`}
                        description="Their access to the event ends straight away."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => remove.mutate(m.userId)}
                      >
                        Remove
                      </ConfirmButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
