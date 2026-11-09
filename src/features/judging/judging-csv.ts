import type { Schemas } from '@/api/client';
import { cell } from '@/features/admin/teams-csv';
import { formatIST } from '@/lib/datetime';

type Criterion = Schemas['Criterion'];

const toCsv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((v) => cell(String(v))).join(',')).join('\r\n');

const num = (n: number | null) => (n === null ? '' : Number.isInteger(n) ? n : n.toFixed(2));

/** The ranking: a row per team, with the average of each criterion. */
export function leaderboardCsv(board: Schemas['Leaderboard'], criteria: Criterion[]): string {
  const header = [
    'Rank',
    'Team',
    'Total',
    'Normalised total',
    'Out of',
    'Judges',
    ...criteria.map((c) => `${c.name} (avg, of ${c.maxScore})`),
  ];
  const rows = board.entries.map((e) => [
    e.rank,
    e.team.name,
    num(e.total),
    num(e.normalisedTotal),
    e.maxTotal,
    e.judges,
    ...criteria.map((c) => num(e.criteria.find((x) => x.criterionId === c.id)?.average ?? null)),
  ]);
  return toCsv([header, ...rows]);
}

/** Every judge's scores: a row per team and judge, with their overall comment. */
export function judgesCsv(breakdowns: Schemas['ScoreBreakdown'][], criteria: Criterion[]): string {
  const header = [
    'Team',
    'Judge',
    ...criteria.map((c) => `${c.name} (of ${c.maxScore})`),
    'Judge total',
    'Comment',
    'Last saved (IST)',
  ];
  const rows = breakdowns.flatMap((b) =>
    b.judges.map((j) => [
      b.team.name,
      j.judge.name,
      ...criteria.map((c) => num(j.scores.find((s) => s.criterionId === c.id)?.value ?? null)),
      j.total,
      j.comment ?? '',
      formatIST(j.updatedAt),
    ]),
  );
  return toCsv([header, ...rows]);
}
