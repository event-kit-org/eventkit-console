import { useMutation } from '@tanstack/react-query';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { download, slug } from '@/features/admin/teams-csv';
import { useEventContext } from '@/features/events/event-context';
import { roundCsv } from './entries-csv';

/**
 * Downloads every form of a round as one CSV: a row per team in the round
 * (active teams, or the round's own list after an elimination), the ones that
 * submitted nothing too.
 */
export function useRoundExport() {
  const api = useApi();
  const { event, path } = useEventContext();
  return useMutation({
    mutationFn: async (round: { id: string; name: string }) => {
      const at = { params: { path: { eventId: event.id, roundId: round.id } } };
      const [submissions, teams, inRound] = await Promise.all([
        unwrap(api.GET('/v1/events/{eventId}/submissions', path)),
        unwrap(api.GET('/v1/events/{eventId}/teams', path)),
        unwrap(api.GET('/v1/events/{eventId}/rounds/{roundId}/teams', at)),
      ]);
      const forms = await Promise.all(
        submissions
          .filter((s) => s.round.id === round.id)
          .sort((a, b) => a.position - b.position)
          .map(async (submission) => ({
            submission: {
              ...submission,
              fields: [...submission.fields].sort((a, b) => a.position - b.position),
            },
            entries: await unwrap(
              api.GET('/v1/events/{eventId}/submissions/{submissionId}/entries', {
                params: { path: { eventId: event.id, submissionId: submission.id } },
              }),
            ),
          })),
      );
      const rows = teams.filter(
        (t) =>
          t.status !== 'cancelled' && (inRound.teamIds === null || inRound.teamIds.includes(t.id)),
      );
      download(`${slug(event.name)}-${slug(round.name)}.csv`, roundCsv(rows, forms));
      return { teams: rows.length, forms: forms.length };
    },
  });
}
