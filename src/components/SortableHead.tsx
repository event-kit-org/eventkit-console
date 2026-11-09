import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableHead } from '@/components/ui/table';
import type { SortDir } from '@/hooks/useSort';
import { cn } from '@/lib/utils';

/** A column heading that sorts the table by that column (see useSort). */
export function SortableHead({
  label,
  active,
  dir,
  onSort,
  align = 'left',
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  /** Number columns line up on the right. */
  align?: 'left' | 'right';
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(align === 'right' && 'text-right', className)}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-8 gap-1 px-2 font-medium', align === 'right' ? '-mr-2' : '-ml-2')}
        onClick={onSort}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'text-muted-foreground')} aria-hidden />
      </Button>
    </TableHead>
  );
}
