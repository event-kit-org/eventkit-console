import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorAlert } from '@/components/ErrorAlert';
import { StatusBadge } from '@/components/StatusBadge';
import { teamDisplayStatus } from '@/lib/status';
import { Select } from '@/components/ui/select';
import { useTeams } from './queries';

export function TeamsPage() {
  const teams = useTeams();
  const [filter, setFilter] = useState('all');
  const list = (teams.data ?? []).filter(
    (t) =>
      filter === 'all' ||
      t.status === filter ||
      teamDisplayStatus(t) === filter ||
      (filter === 'flagged' && t.belowMinimum),
  );

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="team-filter" className="text-sm">
          Show
        </label>
        <Select
          id="team-filter"
          className="w-48"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All teams</option>
          <option value="registered">Registered</option>
          <option value="confirmation_pending">Confirmation pending</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="flagged">Below minimum</option>
        </Select>
      </div>
      <ErrorAlert error={teams.error} />
      {teams.isPending && <p className="text-muted-foreground">Loading…</p>}
      {teams.data && list.length === 0 && (
        <p className="text-muted-foreground">No teams here yet.</p>
      )}
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Team</th>
              <th className="p-3 font-medium">Leader</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Members</th>
              <th className="p-3 font-medium">Payment</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="p-3">
                  <Link className="font-medium underline" to={t.id}>
                    {t.name}
                  </Link>
                  {t.belowMinimum && (
                    <span className="ml-2 text-xs text-destructive">below minimum</span>
                  )}
                </td>
                <td className="p-3">
                  {t.leader.name}
                  <div className="text-xs text-muted-foreground">{t.leader.email}</div>
                </td>
                <td className="p-3">
                  <StatusBadge status={teamDisplayStatus(t)} />
                </td>
                <td className="p-3">{t.memberCount}</td>
                <td className="p-3 capitalize">{t.latestProofStatus ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
