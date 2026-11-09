import type { ReactNode } from 'react';

/** A section's title, what it is for, and its main actions. */
export function PageHeader({
  title,
  description,
  children,
  as: Heading = 'h2',
}: {
  title: string;
  /** h1 on pages outside an event, where the page title is the top heading. */
  as?: 'h1' | 'h2';
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-1">
      {/* The title with its actions top right; the description under both. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Heading className="min-w-0 text-lg font-semibold tracking-tight wrap-anywhere">
          {title}
        </Heading>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
