import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import type { Schemas } from '@/api/client';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LiveStamp } from '@/components/LiveStamp';
import { cn } from '@/lib/utils';

type Bucket = Schemas['ChartBucket'];

/** Categorical hues in fixed order (see --viz-* in index.css). Never cycled. */
const SERIES = Array.from({ length: 8 }, (_, i) => `var(--viz-${i + 1})`);
/** Pies show at most this many slices; the rest fold into "Other". */
const MAX_SLICES = 7;

/** A chart card: title, what it shows, the chart, and the same numbers as a table. */
export function ChartCard({
  title,
  description,
  action,
  loading,
  empty,
  table,
  children,
  heading = 'h3',
  live,
}: {
  title: string;
  /** When the numbers last arrived, for charts that refresh on their own. */
  live?: number;
  /** h2 when the card sits straight under the page title, h3 inside a section. */
  heading?: 'h2' | 'h3';
  description?: ReactNode;
  action?: ReactNode;
  loading?: boolean;
  /** Shown instead of the chart when there is nothing to plot yet. */
  empty?: string | false;
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle as={heading}>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {live !== undefined && <LiveStamp updatedAt={live} />}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="grid gap-3">
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : empty ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyDescription>{empty}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {children}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="group text-muted-foreground">
                  <ChevronRight
                    className="transition-transform group-data-[state=open]:rotate-90"
                    aria-hidden
                  />
                  View as table
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {table.head.map((h, j) => (
                        <TableHead
                          key={h}
                          className={cn(typeof table.rows[0]?.[j] === 'number' && 'text-right')}
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.rows.map((r, i) => (
                      <TableRow key={i}>
                        {r.map((c, j) => (
                          <TableCell
                            key={j}
                            className={cn('tabular-nums', typeof c === 'number' && 'text-right')}
                          >
                            {c}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const axis = { tickLine: false, axisLine: false, tickMargin: 8 } as const;

/** One line over time (one series: the card title names it, no legend). */
export function TrendLine({
  data,
  x,
  lines,
  label,
}: {
  data: object[];
  x: string;
  lines: { key: string; label: string }[];
  label: (v: string) => string;
}) {
  const config = Object.fromEntries(
    lines.map((l, i) => [l.key, { label: l.label, color: SERIES[i] }]),
  ) satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey={x} {...axis} tickFormatter={label} minTickGap={24} />
        <YAxis {...axis} width={32} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => label(String(v))} />} />
        {lines.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {lines.map((l) => (
          <Line
            key={l.key}
            dataKey={l.key}
            type="monotone"
            stroke={`var(--color-${l.key})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/** Counts per answer: horizontal bars (one series), or a pie with a legend. */
export function CountsChart({ buckets, chart }: { buckets: Bucket[]; chart: 'bar' | 'pie' }) {
  if (chart === 'pie') {
    const shown = buckets.filter((b) => b.count > 0);
    const slices =
      shown.length > MAX_SLICES + 1
        ? [
            ...shown.slice(0, MAX_SLICES),
            { label: 'Other', count: shown.slice(MAX_SLICES).reduce((n, b) => n + b.count, 0) },
          ]
        : shown;
    const config = Object.fromEntries(
      slices.map((b, i) => [`s${i}`, { label: b.label, color: SERIES[i] }]),
    ) satisfies ChartConfig;
    const data = slices.map((b, i) => ({ ...b, key: `s${i}` }));
    return (
      <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-64">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
          <Pie data={data} dataKey="count" nameKey="key" stroke="var(--card)" strokeWidth={2}>
            {data.map((d) => (
              <Cell key={d.key} fill={`var(--color-${d.key})`} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap" />
        </PieChart>
      </ChartContainer>
    );
  }
  const config = { count: { label: 'Count', color: SERIES[0] } } satisfies ChartConfig;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: Math.max(120, buckets.length * 32 + 24) }}
    >
      <BarChart data={buckets} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} strokeOpacity={0.5} />
        <XAxis type="number" {...axis} allowDecimals={false} />
        <YAxis type="category" dataKey="label" {...axis} width={120} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.3 }}
          content={<ChartTooltipContent hideLabel={false} />}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={20} />
      </BarChart>
    </ChartContainer>
  );
}
