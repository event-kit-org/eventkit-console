import { createContext, useContext, useEffect } from 'react';

/** Lets a detail page (one team, one submission) name itself in the breadcrumb. */
export const DetailCrumbContext = createContext<(label: string | null) => void>(() => {});

/** Shows `label` after the section crumb while the page is open. */
export function useDetailCrumb(label: string | undefined) {
  const set = useContext(DetailCrumbContext);
  useEffect(() => {
    set(label ?? null);
    return () => set(null);
  }, [label, set]);
}
