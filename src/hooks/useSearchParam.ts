import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * One value kept in the address's query string, so it survives going back,
 * reloading and sharing the link. Setting it to `fallback` removes it.
 */
export function useSearchParam(name: string, fallback = '') {
  const [params, setParams] = useSearchParams();
  const value = params.get(name) ?? fallback;
  const set = useCallback(
    (next: string) =>
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next === fallback) out.delete(name);
          else out.set(name, next);
          return out;
        },
        // Typing in a search box shouldn't add a history entry per key.
        { replace: true },
      ),
    [name, fallback, setParams],
  );
  return [value, set] as const;
}
