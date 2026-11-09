import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** How many rows a table shows at once. */
export const PAGE_SIZE = 20;

/**
 * One page of a list at a time. A list that shrinks (a search, a filter) moves
 * back to its last page rather than showing an empty one.
 */
export function usePage<T>(items: readonly T[], size = PAGE_SIZE) {
  const [wanted, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(wanted, pages - 1);
  return {
    page,
    pages,
    setPage,
    total: items.length,
    size,
    items: items.slice(page * size, page * size + size),
  };
}

/** "21–40 of 57", with previous and next. Nothing when the list fits on one page. */
export function Pager({
  page,
  pages,
  total,
  size,
  setPage,
}: Pick<ReturnType<typeof usePage>, 'page' | 'pages' | 'total' | 'size' | 'setPage'>) {
  if (pages <= 1) return null;
  const from = page * size + 1;
  const to = Math.min(total, from + size - 1);
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-sm">
      <span className="text-muted-foreground tabular-nums" aria-live="polite">
        {from}–{to} of {total}
      </span>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Next page"
        disabled={page >= pages - 1}
        onClick={() => setPage(page + 1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
