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
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <Heading className="text-lg font-semibold tracking-tight">{title}</Heading>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
