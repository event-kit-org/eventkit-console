import { ArrowRight, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useEventContext } from '@/features/events/event-context';
import { describeBalance } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useTeams } from './queries';
import { PendingReleaseBadge, ReleaseControls } from './TeamRelease';

const FILTERS = [
  ['all', 'All teams'],
  ['registered', 'Registered'],
  ['confirmation_pending', 'Confirmation pending'],
  ['shortlisted', 'Shortlisted'],
  ['confirmed', 'Confirmed'],
  ['cancelled', 'Cancelled'],
  ['flagged', 'Below minimum'],
  ['pending_release', 'Not released yet'],
] as const;

export function TeamsPage() {
  const { event } = useEventContext();
  const teams = useTeams();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const list = (teams.data ?? []).filter(
    (t) =>
      filter === 'all' ||
      t.status === filter ||
      teamDisplayStatus(t) === filter ||
      (filter === 'flagged' && t.belowMinimum) ||
      (filter === 'pending_release' && t.pendingRelease),
  );
  const pending = (teams.data ?? []).filter((t) => t.pendingRelease);
  // Release controls show while staged release is on, or decisions still wait.
  const staged = event.stagedRelease || pending.length > 0;
  const selectable = list.filter((t) => t.pendingRelease);
  const allSelected = selectable.length > 0 && selectable.every((t) => selected.has(t.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

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
      {staged && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            {pending.length === 0
              ? 'Staged release is on: every decision so far has been released.'
              : `${pending.length} team${pending.length === 1 ? ' hasn’t' : 's haven’t'} been shown their result yet.`}
          </p>
          <ReleaseControls
            selected={[...selected].filter((id) => pending.some((t) => t.id === id))}
            pendingCount={pending.length}
            onReleased={() => setSelected(new Set())}
          />
        </div>
      )}
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
                  {staged && (
                    <TableHead className="w-8">
                      <Checkbox
                        aria-label="Select every team waiting for release"
                        checked={allSelected}
                        disabled={selectable.length === 0}
                        onCheckedChange={(c) =>
                          setSelected(c === true ? new Set(selectable.map((t) => t.id)) : new Set())
                        }
                      />
                    </TableHead>
                  )}
                  <TableHead>Team</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Decided by</TableHead>
                  <TableHead>
                    <span className="sr-only">Review</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((t) => (
                  <TableRow key={t.id}>
                    {staged && (
                      <TableCell>
                        {t.pendingRelease && (
                          <Checkbox
                            aria-label={`Select ${t.name} for release`}
                            checked={selected.has(t.id)}
                            onCheckedChange={(c) => toggle(t.id, c === true)}
                          />
                        )}
                      </TableCell>
                    )}
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
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={teamDisplayStatus(t)} />
                        {t.pendingRelease && <PendingReleaseBadge />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.memberCount}</TableCell>
                    <TableCell className="capitalize">{t.latestProofStatus ?? '—'}</TableCell>
                    <TableCell
                      className={cn(
                        'tabular-nums',
                        (t.balance ?? 0) > 0 && 'text-amber-700 dark:text-amber-400',
                        (t.balance ?? 0) < 0 && 'text-sky-700 dark:text-sky-400',
                      )}
                    >
                      {describeBalance(t.balance, event.currency)}
                    </TableCell>
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
