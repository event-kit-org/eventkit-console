import { useDeferredValue, useMemo, useState } from 'react';

/** Lower case, without accents, so "Jose" finds "José". */
export const normalise = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Filters a list on the client by a search query. `text` gives the words an
 * item is found by (name, email, participant ID…); every word of the query
 * must appear in one of them. Pass a function defined outside the component, so
 * the list is only filtered again when the items or the query change.
 */
export function useListFilter<T>(
  items: readonly T[],
  text: (item: T) => (string | null | undefined)[],
) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const filtered = useMemo(() => {
    const words = normalise(deferred).split(/\s+/).filter(Boolean);
    if (words.length === 0) return items;
    return items.filter((item) => {
      const haystack = normalise(text(item).filter(Boolean).join(' '));
      return words.every((w) => haystack.includes(w));
    });
  }, [items, deferred, text]);
  return { query, setQuery, filtered, active: deferred.trim() !== '' };
}
