import { useMemo } from 'react';
import { useSearchParam } from './useSearchParam';

export type SortValue = string | number | null | undefined;
export type SortDir = 'asc' | 'desc';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Sorts a list by one column, kept in the address as ?sort=name or ?sort=name:desc
 * so it survives going back and reloading. With no sort the list keeps the order
 * it came in. Empty values always go last.
 */
export function useSort<T, K extends string>(
  rows: readonly T[],
  columns: Record<K, (row: T) => SortValue>,
) {
  const [param, setParam] = useSearchParam('sort');
  const [rawKey, rawDir] = param.split(':');
  const key = rawKey && rawKey in columns ? (rawKey as K) : null;
  const dir: SortDir = rawDir === 'desc' ? 'desc' : 'asc';

  const sorted = useMemo(() => {
    if (!key) return rows;
    const value = columns[key];
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const xEmpty = x === null || x === undefined || x === '';
      const yEmpty = y === null || y === undefined || y === '';
      if (xEmpty || yEmpty) return xEmpty === yEmpty ? 0 : xEmpty ? 1 : -1;
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : collator.compare(String(x), String(y));
      return order * sign;
    });
  }, [rows, columns, key, dir]);

  /** First click sorts A–Z (or low to high), the next Z–A, the next clears it. */
  const toggle = (next: K) => {
    if (key !== next) setParam(next);
    else if (dir === 'asc') setParam(`${next}:desc`);
    else setParam('');
  };

  return { sorted, key, dir, toggle };
}
