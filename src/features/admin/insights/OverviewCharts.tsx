import { ArrowDown, ArrowUp, ChartPie, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useEventContext } from '@/features/events/event-context';
import { useFields } from '@/features/fields/queries';
import { useEventMutation } from '@/hooks/useEventMutation';
import { ChartCard, CountsChart, TrendLine } from './Charts';
import {
  useAttendance,
  useDashboard,
  useFieldCounts,
  usePollCounts,
  usePollList,
  useRegistrationsByDay,
} from './queries';

type Widget = Schemas['DashboardWidget'];

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});
const dayLabel = (date: string) => day.format(new Date(`${date}T00:00:00Z`));
const timeLabel = (iso: string) => time.format(new Date(iso));

export function RegistrationsCard() {
  const series = useRegistrationsByDay();
  const days = series.data ?? [];
  const last = days.at(-1);
  return (
    <ChartCard
      title="Registrations over time"
      description={
        last
          ? `${last.totalPeople} people in ${last.totalTeams} teams so far (cancellations left out)`
          : undefined
      }
      loading={series.isPending}
      empty={days.length === 0 && 'Nobody has registered yet.'}
      table={{
        head: ['Day', 'Teams', 'People', 'People so far'],
        rows: days.map((d) => [dayLabel(d.date), d.teams, d.people, d.totalPeople]),
      }}
    >
      <TrendLine
        data={days}
        x="date"
        label={dayLabel}
        lines={[{ key: 'totalPeople', label: 'People registered' }]}
      />
    </ChartCard>
  );
}

export function AttendanceCard() {
  const series = useAttendance(true);
  const points = series.data ?? [];
  const now = points.at(-1);
  return (
    <ChartCard
      title="Attendance"
      description={
        now
          ? `${now.inside} inside now, ${now.outside} out through a gate, ${now.checkedIn} checked in`
          : 'Every 30 minutes, from check-in and gate scans'
      }
      loading={series.isPending}
      empty={points.length === 0 && 'No check-ins yet.'}
      table={{
        head: ['Time', 'Checked in', 'Inside', 'Out'],
        rows: points.map((p) => [timeLabel(p.at), p.checkedIn, p.inside, p.outside]),
      }}
    >
      <TrendLine
        data={points}
        x="at"
        label={timeLabel}
        lines={[
          { key: 'inside', label: 'Inside' },
          { key: 'checkedIn', label: 'Checked in' },
        ]}
      />
    </ChartCard>
  );
}

function FieldWidget({
  widget,
  action,
}: {
  widget: Widget & { kind: 'field' };
  action?: React.ReactNode;
}) {
  const counts = useFieldCounts(widget.fieldId);
  const d = counts.data;
  return (
    <ChartCard
      title={widget.title || d?.label || 'Question'}
      description={
        d && `${d.answered} of ${d.respondents} ${d.scope === 'team' ? 'teams' : 'people'} answered`
      }
      action={action}
      loading={counts.isPending}
      empty={d?.answered === 0 && 'No answers yet.'}
      table={{ head: ['Answer', 'Count'], rows: (d?.buckets ?? []).map((b) => [b.label, b.count]) }}
    >
      <CountsChart buckets={d?.buckets ?? []} chart={widget.chart} />
    </ChartCard>
  );
}

function PollWidget({
  widget,
  action,
}: {
  widget: Widget & { kind: 'poll' };
  action?: React.ReactNode;
}) {
  const counts = usePollCounts(widget.pollId);
  const d = counts.data;
  return (
    <ChartCard
      title={widget.title || d?.question || 'Poll'}
      description={d && `${d.votes} vote${d.votes === 1 ? '' : 's'}`}
      action={action}
      loading={counts.isPending}
      empty={d?.votes === 0 && 'No votes yet.'}
      table={{ head: ['Option', 'Votes'], rows: (d?.buckets ?? []).map((b) => [b.label, b.count]) }}
    >
      <CountsChart buckets={d?.buckets ?? []} chart={widget.chart} />
    </ChartCard>
  );
}

export function WidgetCard({ widget }: { widget: Widget }) {
  return widget.kind === 'field' ? <FieldWidget widget={widget} /> : <PollWidget widget={widget} />;
}

/** The shared charts every organiser sees; admins edit them. */
export function Dashboard() {
  const { role } = useEventContext();
  const dashboard = useDashboard();
  const widgets = dashboard.data ?? [];
  return (
    <section className="grid gap-4" aria-labelledby="dashboard-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dashboard-title" className="text-base font-semibold">
          Answers and polls
        </h2>
        {role === 'admin' && dashboard.data && <DashboardEditor saved={widgets} />}
      </div>
      <ErrorAlert error={dashboard.error} />
      {dashboard.data && widgets.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {role === 'admin'
            ? 'Add charts of registration answers or poll votes with Edit charts.'
            : 'No charts yet. An admin can add some.'}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {widgets.map((w) => (
          <WidgetCard key={w.id} widget={w} />
        ))}
      </div>
    </section>
  );
}

const CHARTABLE: Schemas['EventField']['type'][] = [
  'choice',
  'dropdown',
  'multi_choice',
  'number',
  'short_text',
];

function DashboardEditor({ saved }: { saved: Widget[] }) {
  const api = useApi();
  const { event, path } = useEventContext();
  const fields = useFields();
  const polls = usePollList();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Widget[]>(saved);
  const [source, setSource] = useState('');
  const save = useEventMutation(event.id, (widgets: Widget[]) =>
    unwrap(api.PUT('/v1/events/{eventId}/insights/dashboard', { ...path, body: widgets })),
  );

  const fieldName = new Map((fields.data ?? []).map((f) => [f.id, f.label]));
  const pollName = new Map((polls.data ?? []).map((p) => [p.id, p.question]));
  const nameOf = (w: Widget) =>
    w.kind === 'field' ? fieldName.get(w.fieldId) : pollName.get(w.pollId);
  const update = (i: number, patch: Partial<Widget>) =>
    setDraft((d) => d.map((w, j) => (j === i ? ({ ...w, ...patch } as Widget) : w)));
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      const next = [...d];
      [next[i], next[i + by]] = [next[i + by]!, next[i]!];
      return next;
    });
  const add = () => {
    const [kind, id] = source.split(':') as ['field' | 'poll', string];
    const widget: Widget =
      kind === 'field'
        ? { id: crypto.randomUUID(), kind, fieldId: id, chart: 'bar' }
        : { id: crypto.randomUUID(), kind, pollId: id, chart: 'pie' };
    setDraft((d) => [...d, widget]);
    setSource('');
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(saved);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <ChartPie aria-hidden /> Edit charts
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Charts on the overview</SheetTitle>
          <SheetDescription>Every organiser of this event sees the same charts.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <Field>
            <FieldLabel htmlFor="chart-source">Add a chart of</FieldLabel>
            <div className="flex gap-2">
              <NativeSelect
                id="chart-source"
                className="w-full"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <NativeSelectOption value="">Choose a question or poll…</NativeSelectOption>
                <NativeSelectOptGroup label="Registration questions">
                  {(fields.data ?? [])
                    .filter((f) => CHARTABLE.includes(f.type))
                    .map((f) => (
                      <NativeSelectOption key={f.id} value={`field:${f.id}`}>
                        {f.label}
                      </NativeSelectOption>
                    ))}
                </NativeSelectOptGroup>
                <NativeSelectOptGroup label="Polls">
                  {(polls.data ?? []).map((p) => (
                    <NativeSelectOption key={p.id} value={`poll:${p.id}`}>
                      {p.question}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              </NativeSelect>
              <Button type="button" onClick={add} disabled={!source || draft.length >= 24}>
                <Plus aria-hidden /> Add
              </Button>
            </div>
          </Field>
          <ol className="grid gap-3" aria-label="Charts">
            {draft.map((w, i) => (
              <li key={w.id} className="grid gap-2 rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {nameOf(w) ?? 'Unknown'}{' '}
                  <span className="font-normal text-muted-foreground">
                    ({w.kind === 'field' ? 'question' : 'poll'})
                  </span>
                </p>
                <Input
                  aria-label={`Title for ${nameOf(w) ?? 'chart'}`}
                  placeholder="Title (optional)"
                  value={w.title ?? ''}
                  onChange={(e) => update(i, { title: e.target.value || null })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    aria-label={`Chart type for ${nameOf(w) ?? 'chart'}`}
                    size="sm"
                    value={w.chart}
                    onChange={(e) => update(i, { chart: e.target.value as Widget['chart'] })}
                  >
                    <NativeSelectOption value="bar">Bars</NativeSelectOption>
                    <NativeSelectOption value="pie">Pie</NativeSelectOption>
                  </NativeSelect>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move down"
                    disabled={i === draft.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove"
                    onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <ErrorAlert error={save.error} />
        </div>
        <SheetFooter>
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate(draft, { onSuccess: () => setOpen(false) })}
          >
            Save charts
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
