import { useEffect } from 'react';

/** Sets the browser tab title, most specific part first: "Teams · MachZero · eventKit". */
export function usePageTitle(...parts: string[]) {
  const title = [...parts, 'eventKit'].join(' · ');
  useEffect(() => {
    document.title = title;
  }, [title]);
}
