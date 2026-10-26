import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useApi, useAuth } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
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
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Volunteers and judges of this event. They join through a staff link (Links) and sign in on
        the event's portal. Removing someone ends their access.
      </p>
      <ErrorAlert error={members.error ?? change.error ?? remove.error} />
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.data?.map((m) => (
              <tr key={m.userId} className="border-b last:border-0">
                <td className="p-3">
                  {m.name}
                  <div className="text-xs text-muted-foreground">
                    {m.email}
                    {m.phone && ` · ${m.phone}`}
                  </div>
                </td>
                <td className="p-3">
                  {m.role === 'admin' ? (
                    roleLabel[m.role]
                  ) : (
                    <Select
                      aria-label={`Role of ${m.name}`}
                      className="w-40"
                      value={m.role}
                      onChange={(e) =>
                        change.mutate({ userId: m.userId, role: e.target.value as StaffRole })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel[r]}
                        </option>
                      ))}
                    </Select>
                  )}
                </td>
                <td className="p-3 text-right">
                  {m.userId !== user?.id && m.role !== 'admin' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(`Remove ${m.name} from the event?`))
                          remove.mutate(m.userId);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
