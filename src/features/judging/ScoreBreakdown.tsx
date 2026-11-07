import { useQuery } from '@tanstack/react-query';
import { MessageSquareText } from 'lucide-react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { RowsSkeleton } from '@/components/PageState';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useEventContext } from '@/features/events/event-context';

const score = (n: number | null) => (n === null ? '—' : Number.isInteger(n) ? n : n.toFixed(2));

/**
 * Who scored a team in a round, criterion by criterion, with comments. Admins
 * open it from the leaderboard. One card per judge, so it reads on a phone.
 */
export function ScoreBreakdownSheet({
  team,
  roundId,
  onClose,
}: {
  team: { id: string; name: string } | null;
  roundId?: string;
  onClose: () => void;
}) {
  const api = useApi();
  const { event } = useEventContext();
  const breakdown = useQuery({
    queryKey: ['event', event.id, 'breakdown', team?.id, roundId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/judging/teams/{teamId}/breakdown', {
          params: { path: { eventId: event.id, teamId: team!.id }, query: { roundId } },
        }),
      ),
    enabled: team !== null,
  });
  const b = breakdown.data;
  return (
    <Sheet open={team !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="pr-8 wrap-anywhere">{team?.name}</SheetTitle>
          <SheetDescription>
            {b ? `${b.round.name}: who gave what, criterion by criterion.` : 'Judging breakdown'}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          <ErrorAlert error={breakdown.error} />
          {breakdown.isPending && <RowsSkeleton rows={3} />}
          {b && (
            <>
              {!b.inRound && (
                <p className="rounded-lg border border-dashed p-3 text-muted-foreground">
                  This team didn’t go on to this round.
                </p>
              )}
              <section aria-labelledby="breakdown-average" className="grid gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 id="breakdown-average" className="font-medium">
                    Average
                  </h3>
                  <span className="font-semibold tabular-nums">
                    {score(b.total)} / {b.maxTotal}
                  </span>
                </div>
                <ul className="grid gap-1">
                  {b.criteria.map((c) => (
                    <li key={c.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 wrap-anywhere text-muted-foreground">{c.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {score(c.average)} / {c.maxScore}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <Separator />
              {b.judges.length === 0 ? (
                <p className="text-muted-foreground">No judge has scored this team yet.</p>
              ) : (
                <ul className="grid gap-3" aria-label="Judges">
                  {b.judges.map((j) => (
                    <li key={j.judge.id} className="grid gap-2 rounded-lg border p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="min-w-0 font-medium wrap-anywhere">{j.judge.name}</span>
                        <Badge variant="secondary" className="tabular-nums">
                          {j.total} / {b.maxTotal}
                        </Badge>
                      </div>
                      <ul className="grid gap-1.5">
                        {j.scores.map((s) => {
                          const c = b.criteria.find((x) => x.id === s.criterionId)!;
                          return (
                            <li key={s.criterionId} className="grid gap-0.5">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="min-w-0 wrap-anywhere text-muted-foreground">
                                  {c.name}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {score(s.value)} / {c.maxScore}
                                </span>
                              </div>
                              {s.comment && (
                                <p className="flex gap-1.5 text-xs wrap-anywhere text-muted-foreground">
                                  <MessageSquareText
                                    aria-hidden
                                    className="mt-0.5 size-3 shrink-0"
                                  />
                                  <span className="min-w-0">{s.comment}</span>
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
