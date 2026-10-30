import type { Schemas } from '@/api/client';
import { answerText, type Field, memberFields, teamFields } from '@/features/fields/fields';
import { formatIST } from '@/lib/datetime';

type Team = Schemas['Team'];

/** One row per member; team-level columns repeat on each row. */
export function teamsCsv(teams: Team[], fields: Field[]): string {
  const tf = teamFields(fields);
  const mf = memberFields(fields);
  const header = [
    'Team',
    'Participant ID',
    'Name',
    'Email',
    'Phone',
    'Leader',
    'Status',
    'Payment',
    'Registered (IST)',
    ...tf.map((f) => f.label),
    ...mf.map((f) => f.label),
  ];
  const rows = teams.flatMap((t) =>
    t.members.map((m) => [
      t.name,
      m.participantCode,
      m.name,
      m.email ?? '',
      m.phone ?? '',
      m.isLeader ? 'yes' : '',
      m.status,
      t.payment.proofs[0]?.status ?? (t.payment.mode === 'none' ? '' : 'not uploaded'),
      formatIST(t.createdAt),
      ...tf.map((f) => answerText(t.answers[f.id], f.type)),
      ...mf.map((f) => answerText(m.answers[f.id], f.type)),
    ]),
  );
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Quotes a CSV cell, and defuses spreadsheet formulas (=, +, -, @). */
function cell(value: string): string {
  // Phone numbers like +91 98450 12345 are left as they are.
  const formula = /^[=+\-@\t\r]/.test(value) && !/^\+?[\d\s()-]+$/.test(value);
  const safe = formula ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'event';

export function download(filename: string, csv: string) {
  // A byte-order mark so Excel reads it as UTF-8.
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
