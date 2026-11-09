import type { Schemas } from '@/api/client';
import { cell } from '@/features/admin/teams-csv';
import { answerText } from '@/features/fields/fields';
import { formatIST } from '@/lib/datetime';

type Submission = Schemas['Submission'];
type Entry = Schemas['SubmissionEntry'];

const toCsv = (rows: string[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n');

const entryColumns = (s: Submission, e: Entry | undefined) => [
  e?.submittedBy?.name ?? '',
  e ? formatIST(e.createdAt) : '',
  e ? (e.late ? 'yes' : '') : '',
  ...s.fields.map((f) => answerText(e?.answers[f.id], f.type)),
];

/** One form's responses: a row per response (by team, oldest first), a column per question. */
export function entriesCsv(submission: Submission, entries: Entry[]): string {
  const header = [
    'Team',
    'Submitted by',
    'Sent (IST)',
    'Late',
    ...submission.fields.map((f) => f.label),
  ];
  const rows = [...entries]
    .sort(
      (a, b) => a.team.name.localeCompare(b.team.name) || a.createdAt.localeCompare(b.createdAt),
    )
    .map((e) => [e.team.name, ...entryColumns(submission, e)]);
  return toCsv([header, ...rows]);
}

/**
 * Every form of a round side by side: a row per team in the round (those
 * that submitted nothing too), and for each form its own columns, headed
 * "Form › Question". A team that sent several responses shows its latest.
 */
export function roundCsv(
  teams: { id: string; name: string }[],
  forms: { submission: Submission; entries: Entry[] }[],
): string {
  const header = [
    'Team',
    ...forms.flatMap(({ submission: s }) =>
      ['Submitted by', 'Sent (IST)', 'Late', ...s.fields.map((f) => f.label)].map(
        (label) => `${s.title} › ${label}`,
      ),
    ),
  ];
  const rows = [...teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => [
      t.name,
      ...forms.flatMap(({ submission, entries }) =>
        entryColumns(
          submission,
          entries
            .filter((e) => e.team.id === t.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
        ),
      ),
    ]);
  return toCsv([header, ...rows]);
}
