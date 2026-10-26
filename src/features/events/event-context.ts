import { useOutletContext } from 'react-router';
import type { Schemas } from '@/api/client';

export interface EventContextValue {
  event: Schemas['Event'];
  role: Schemas['Role'];
  features: Record<Schemas['Feature'], boolean>;
  /** Path params for the typed client. */
  path: { params: { path: { eventId: string } } };
}

export const useEventContext = () => useOutletContext<EventContextValue>();
