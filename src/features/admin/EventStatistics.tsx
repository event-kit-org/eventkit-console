import { ArrowLeft, ChartLine } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventContext } from '@/features/events/event-context';
import { DashboardEditor, WidgetCard } from './insights/OverviewCharts';
import { useDashboard } from './insights/queries';

/**
 * The charts organisers add on top of the overview: registration answers, poll
 * votes and checkpoint scans. Every organiser sees the same set; admins edit it.
 */
export function EventStatistics() {
  const { role } = useEventContext();
  const dashboard = useDashboard();
  const widgets = dashboard.data ?? [];
  const admin = role === 'admin';
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Event statistics"
        description="Charts of registration answers, poll votes and checkpoint scans."
      >
        <Button variant="ghost" size="sm" asChild>
          <Link to=".." relative="path">
            <ArrowLeft aria-hidden /> Overview
          </Link>
        </Button>
        {admin && dashboard.data && widgets.length > 0 && <DashboardEditor saved={widgets} />}
      </PageHeader>
      <ErrorAlert error={dashboard.error} />
      {dashboard.isPending && (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          <span className="sr-only">Loading charts…</span>
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      )}
      {dashboard.data && widgets.length === 0 && (
        <EmptyState icon={ChartLine} title="No charts yet">
          {admin ? (
            <span className="grid justify-items-center gap-4">
              Chart a registration question, a poll or a checkpoint. Everyone who runs the event
              sees the same charts.
              <DashboardEditor saved={widgets} label="Add charts" primary />
            </span>
          ) : (
            'An admin can add charts of registration answers, polls and checkpoint scans.'
          )}
        </EmptyState>
      )}
      {widgets.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {widgets.map((w) => (
            <WidgetCard key={w.id} widget={w} />
          ))}
        </div>
      )}
    </div>
  );
}
