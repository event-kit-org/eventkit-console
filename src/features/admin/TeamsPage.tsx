import { ArrowRight, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { teamDisplayStatus } from '@/lib/status';
import { useTeams } from './queries';

const FILTERS = [
  ['all', 'All teams'],
  ['registered', 'Registered'],
  ['confirmation_pending', 'Confirmation pending'],
  ['shortlisted', 'Shortlisted'],
  ['confirmed', 'Confirmed'],
  ['cancelled', 'Cancelled'],
  ['flagged', 'Below minimum'],
] as const;

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
    <div className="grid gap-4">
      <PageHeader title="Teams" description="Every team that registered, newest first.">
        <Label htmlFor="team-filter" className="text-muted-foreground">
          Show
        </Label>
        <NativeSelect
          id="team-filter"
          className="w-52"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {FILTERS.map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </PageHeader>
      <ErrorAlert error={teams.error} />
      {teams.isPending && <TableSkeleton cols={6} />}
      {teams.data && list.length === 0 ? (
        <EmptyState icon={UsersRound} title="No teams here yet." />
      ) : (
        list.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Decided by</TableHead>
                  <TableHead>
                    <span className="sr-only">Review</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" to={t.id}>
                        {t.name}
                      </Link>
                      {t.belowMinimum && (
                        <Badge variant="destructive" className="ml-2">
                          below minimum
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.leader.name}
                      <div className="text-xs text-muted-foreground">{t.leader.email}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={teamDisplayStatus(t)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.memberCount}</TableCell>
                    <TableCell className="capitalize">{t.latestProofStatus ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.confirmedBy ?? t.shortlistedBy ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon-sm" variant="outline" asChild>
                        <Link to={t.id} aria-label={`Review ${t.name}`}>
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </div>
  );
}
