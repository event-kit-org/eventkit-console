import { useMatch } from 'react-router';

/** The event open in the console, if any (not the "new event" page). */
export function useOpenEventId(): string | null {
  const match = useMatch('/events/:eventId/*');
  const id = match?.params.eventId;
  return id && id !== 'new' ? id : null;
}
