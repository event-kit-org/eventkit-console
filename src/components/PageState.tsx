import type { ReactNode } from 'react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

/** Placeholder rows while a list loads. The text is for screen readers. */
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** A list with nothing in it yet. */
export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}

function Busy({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={className} aria-busy="true">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** Bordered rows: a title line, a muted line and an action, like the link and checkpoint lists. */
export function RowsSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <Busy className={cn('grid gap-2', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
        >
          <div className="grid gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </Busy>
  );
}

/** A grid of cards with a heading, a few lines and a footer. */
export function CardsSkeleton({
  count = 2,
  className = 'lg:grid-cols-2',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <Busy className={cn('grid gap-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-4 rounded-xl border bg-card p-4">
          <div className="grid gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </Busy>
  );
}

/** A bordered table: a header strip and rows of cells. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Busy className="overflow-hidden rounded-lg border">
      <Skeleton className="h-10 rounded-none" />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-t p-3">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-40')} />
          ))}
        </div>
      ))}
    </Busy>
  );
}

/** The overview's three tiles. */
export function TilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Busy className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ))}
    </Busy>
  );
}

/** A question card of the registration form: a label line and an answer box. */
export function QuestionsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <Busy className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </Busy>
  );
}
