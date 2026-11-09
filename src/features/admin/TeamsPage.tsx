import { ArrowRight, Download, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FilterMenu } from '@/components/FilterMenu';
import { EmptyState, TableSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { SortableHead } from '@/components/SortableHead';
import { ProofStatusBadge, StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type DisplayStatus, teamDisplayStatus } from '@/lib/status';
import { useEventContext } from '@/features/events/event-context';
import { useListFilter } from '@/hooks/useListFilter';
import { useSearchParam } from '@/hooks/useSearchParam';
import { useSort } from '@/hooks/useSort';
import { formatMoney } from '@/lib/money';
import { useExportTeams } from './export-teams';
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

type TeamRow = NonNullable<ReturnType<typeof useTeams>['data']>[number];

/** A team is found by its name, or any member's name, email or participant ID. */
const teamText = (t: TeamRow) => [
  t.name,
  ...t.members.flatMap((m) => [m.name, m.email, m.participantCode]),
];

/** Status sorts along the way a team moves, not alphabetically. */
const STATUS_ORDER: DisplayStatus[] = [
  'registered',
  'shortlisted',
  'confirmation_pending',
  'confirmed',
  'attending',
  'checked_in',
  'cancelled',
];

const SORTS = {
  name: (t: TeamRow) => t.name,
  status: (t: TeamRow) => STATUS_ORDER.indexOf(teamDisplayStatus(t)),
  members: (t: TeamRow) => t.memberCount,
  paid: (t: TeamRow) => t.paidAmount,
};

export function TeamsPage() {
  const { event, role } = useEventContext();
  const { search: listQuery } = useLocation();
  const exportTeams = useExportTeams();
  const teams = useTeams();
  // In the address, so they survive opening a team and coming back.
  const [filter, setFilter] = useSearchParam('status', 'all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const search = useListFilter(teams.data ?? [], teamText, useSearchParam('q'));
  const filtered = search.filtered.filter(
    (t) =>
      filter === 'all' ||
      t.status === filter ||
      teamDisplayStatus(t) === filter ||
      (filter === 'flagged' && t.belowMinimum) ||
      (filter === 'pending_release' && t.pendingRelease),
  );
  const sort = useSort(filtered, SORTS);
  const list = sort.sorted;
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
      <PageHeader
        title="Teams"
        description="Every team that registered, newest first. Click a column to sort."
      >
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <SearchInput
            label="Search teams and members"
            placeholder="Team, member, email or ID"
            className="min-w-0 flex-1 sm:w-72 sm:flex-none"
            value={search.query}
            onChange={search.setQuery}
          />
          <FilterMenu
            label="Show"
            value={filter}
            onChange={setFilter}
            options={FILTERS}
            fallback="all"
          />
          {/* Everyone's contact details: admins only, like the rest of the event's data. */}
          {role === 'admin' && (
            <Button
              variant="outline"
              className="shrink-0"
              aria-label="Export teams as CSV"
              disabled={exportTeams.isPending}
              onClick={() => exportTeams.mutate()}
            >
              <Download aria-hidden />
              <span className="hidden md:inline">
                {exportTeams.isPending ? 'Preparing…' : 'Export CSV'}
              </span>
            </Button>
          )}
        </div>
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
      <ErrorAlert error={teams.error ?? exportTeams.error} />
      {teams.data && teams.data.length > 0 && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {list.length === teams.data.length
            ? `${list.length} ${list.length === 1 ? 'team' : 'teams'}`
            : `${list.length} of ${teams.data.length} teams`}
        </p>
      )}
      {teams.isPending && <TableSkeleton cols={6} />}
      {teams.data && list.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={search.active ? 'No team or member matches.' : 'No teams here yet.'}
        />
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
                  <SortableHead
                    label="Team"
                    active={sort.key === 'name'}
                    dir={sort.dir}
                    onSort={() => sort.toggle('name')}
                  />
                  <TableHead className="hidden lg:table-cell">Leader</TableHead>
                  <SortableHead
                    label="Status"
                    active={sort.key === 'status'}
                    dir={sort.dir}
                    onSort={() => sort.toggle('status')}
                  />
                  <SortableHead
                    label="Members"
                    align="right"
                    className="hidden md:table-cell"
                    active={sort.key === 'members'}
                    dir={sort.dir}
                    onSort={() => sort.toggle('members')}
                  />
                  <TableHead className="hidden lg:table-cell">Payment</TableHead>
                  <SortableHead
                    label="Paid"
                    align="right"
                    className="hidden lg:table-cell"
                    active={sort.key === 'paid'}
                    dir={sort.dir}
                    onSort={() => sort.toggle('paid')}
                  />
                  <TableHead className="hidden xl:table-cell">Decided by</TableHead>
                  <TableHead className="hidden sm:table-cell">
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
                    <TableCell className="whitespace-normal">
                      <Link
                        className="font-medium wrap-anywhere hover:underline"
                        to={t.id}
                        state={{ list: listQuery }}
                      >
                        {t.name}
                      </Link>
                      {t.belowMinimum && (
                        <Badge variant="destructive" className="ml-2">
                          below minimum
                        </Badge>
                      )}
                      {/* The leader column is hidden on phones; show who leads here. */}
                      <div className="text-xs text-muted-foreground lg:hidden">{t.leader.name}</div>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal lg:table-cell">
                      {t.leader.name}
                      <div className="text-xs break-all text-muted-foreground">
                        {t.leader.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={teamDisplayStatus(t)} />
                        {t.pendingRelease && <PendingReleaseBadge />}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {t.memberCount}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {t.latestProofStatus ? (
                        <ProofStatusBadge status={t.latestProofStatus} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">
                      {t.paidAmount === null ? '—' : formatMoney(t.paidAmount, event.currency)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                      {t.confirmedBy ?? t.shortlistedBy ?? '—'}
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Button size="icon-sm" variant="outline" asChild>
                        <Link to={t.id} state={{ list: listQuery }} aria-label={`Review ${t.name}`}>
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
