import { ApiError, type Schemas } from '@/api/client';

export type Field = Schemas['EventField'];
export type TeamRule = Schemas['TeamRule'];
export type Answers = Record<string, string | number>;
/** Form state: what the inputs hold (numbers too, as typed). */
export type Draft = Record<string, string>;

export const teamFields = (fields: Field[]) => fields.filter((f) => f.scope === 'team');
export const memberFields = (fields: Field[]) => fields.filter((f) => f.scope === 'member');

export const toDraft = (answers: Answers | undefined): Draft =>
  Object.fromEntries(Object.entries(answers ?? {}).map(([k, v]) => [k, String(v)]));

/** Turns form state into an API payload for the given fields (numbers as numbers, blanks cleared). */
export function toAnswers(fields: Field[], draft: Draft): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const f of fields) {
    const raw = draft[f.id];
    if (raw === undefined) continue;
    const value = raw.trim();
    if (value === '') out[f.id] = null;
    else out[f.id] = f.type === 'number' ? Number(value) : value;
  }
  return out;
}

/** The fields a draft leaves unanswered although they are required. */
export const missingRequired = (fields: Field[], draft: Draft) =>
  fields.filter((f) => f.required && !(draft[f.id] ?? '').trim());

/**
 * Per-field messages from an INVALID_ANSWERS error, keyed by field id. The API
 * reports paths like "/answers/<fieldId>" or "/memberAnswers/<fieldId>".
 */
export function fieldErrors(error: unknown, prefix: string): Record<string, string> {
  if (
    !(error instanceof ApiError) ||
    error.code !== 'INVALID_ANSWERS' ||
    !Array.isArray(error.details)
  )
    return {};
  const out: Record<string, string> = {};
  for (const d of error.details as { path: string; message: string }[]) {
    if (d.path.startsWith(`${prefix}/`)) out[d.path.slice(prefix.length + 1)] = d.message;
  }
  return out;
}

export interface RuleCheck {
  rule: TeamRule;
  count: number;
  met: boolean;
}

/** How a set of members (their answers) stands against each team rule. */
export function checkRules(rules: TeamRule[], members: Answers[]): RuleCheck[] {
  return rules.map((rule) => {
    const count = members.filter((a) => a[rule.fieldId] === rule.value).length;
    return { rule, count, met: count >= rule.minCount };
  });
}
