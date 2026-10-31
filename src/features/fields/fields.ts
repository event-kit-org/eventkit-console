import { ApiError, type Schemas } from '@/api/client';
import { formatIST, toISTInput } from '@/lib/datetime';

export type Field = Schemas['EventField'];
export type TeamRule = Schemas['TeamRule'];
/** A list for multi_choice fields. */
export type AnswerValue = string | number | string[];
export type Answers = Record<string, AnswerValue>;
/**
 * Form state: what the inputs hold. Numbers as typed, multi-selects as the
 * ticked options, date-times as <input type="datetime-local"> values in IST.
 */
export type Draft = Record<string, string | string[]>;
/** What a form's fields have in common: registration and submission fields both fit. */
type FieldLike = Pick<Field, 'id' | 'type' | 'required'>;

/** One option from a list: multiple choice (radio buttons) or a dropdown. */
export const isSingleChoice = (type: Field['type']) => type === 'choice' || type === 'dropdown';
/** Types answered by picking from the question's options. */
export const hasOptions = (type: Field['type']) => isSingleChoice(type) || type === 'multi_choice';

export const teamFields = (fields: Field[]) => fields.filter((f) => f.scope === 'team');
export const memberFields = (fields: Field[]) => fields.filter((f) => f.scope === 'member');

/** Saved answers → form state (date-times as IST input values). */
export function toDraft(answers: Answers | undefined, fields: FieldLike[] = []): Draft {
  const types = new Map(fields.map((f) => [f.id, f.type]));
  return Object.fromEntries(
    Object.entries(answers ?? {}).map(([k, v]) => {
      if (Array.isArray(v)) return [k, v];
      if (types.get(k) === 'datetime' && typeof v === 'string') return [k, toISTInput(v)];
      return [k, String(v)];
    }),
  );
}

/**
 * Turns form state into an API payload for the given fields: numbers as
 * numbers, multi-selects as lists, date-times as IST with their offset,
 * blanks and empty lists cleared.
 */
export function toAnswers(fields: FieldLike[], draft: Draft): Record<string, AnswerValue | null> {
  const out: Record<string, AnswerValue | null> = {};
  for (const f of fields) {
    const raw = draft[f.id];
    if (raw === undefined) continue;
    if (Array.isArray(raw)) {
      out[f.id] = raw.length === 0 ? null : raw;
      continue;
    }
    const value = raw.trim();
    if (value === '') out[f.id] = null;
    else if (f.type === 'number') out[f.id] = Number(value);
    else if (f.type === 'datetime' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
      out[f.id] = `${value}+05:30`;
    else out[f.id] = value;
  }
  return out;
}

const isEmpty = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v.length === 0 : !(v ?? '').trim();

/** The fields a draft leaves unanswered although they are required. */
export const missingRequired = <F extends FieldLike>(fields: F[], draft: Draft) =>
  fields.filter((f) => f.required && isEmpty(draft[f.id]));

/** One option ticked or unticked in a multi-select's draft value. */
export function toggleOption(current: string | string[] | undefined, option: string): string[] {
  const list = Array.isArray(current) ? current : [];
  return list.includes(option) ? list.filter((o) => o !== option) : [...list, option];
}

/** An answer as text, for tables and CSV: lists joined with ", ", date-times in IST. */
export function answerText(value: AnswerValue | undefined, type?: Field['type']): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (type === 'datetime' && typeof value === 'string' && !Number.isNaN(Date.parse(value)))
    return formatIST(value);
  return String(value);
}

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
