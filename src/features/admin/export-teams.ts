import { useMutation } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { useEventContext } from '@/features/events/event-context';
import { useFields } from '@/features/fields/queries';
import { download, slug, teamsCsv } from './teams-csv';

/**
 * Downloads every team as a CSV, one row per member: team, participant ID,
 * contact details, status, payment and form answers. Resolves to the team count.
 */
export function useExportTeams() {
  const api = useApi();
  const { event, path } = useEventContext();
  const fields = useFields().data ?? [];
  return useMutation({
    mutationFn: async () => {
      const list = await unwrap(api.GET('/v1/events/{eventId}/teams', path));
      const teams = await Promise.all(
        list.map((t) =>
          unwrap(
            api.GET('/v1/events/{eventId}/teams/{teamId}', {
              params: { path: { eventId: event.id, teamId: t.id } },
            }),
          ),
        ),
      );
      download(`${slug(event.name)}-teams.csv`, teamsCsv(teams, fields));
      return teams.length;
    },
  });
}
