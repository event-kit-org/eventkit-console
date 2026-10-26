import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Draft, Field } from './fields';

/** Inputs for a list of organiser-defined fields. */
export function FieldInputs({
  fields,
  draft,
  onChange,
  errors = {},
  idPrefix,
}: {
  fields: Field[];
  draft: Draft;
  onChange: (next: Draft) => void;
  errors?: Record<string, string>;
  idPrefix?: string;
}) {
  const base = useId();
  if (fields.length === 0) return null;
  return (
    <div className="grid gap-3">
      {fields.map((f) => {
        const id = `${idPrefix ?? base}-${f.id}`;
        const value = draft[f.id] ?? '';
        const set = (v: string) => onChange({ ...draft, [f.id]: v });
        const error = errors[f.id];
        const describedBy = error ? `${id}-error` : f.help ? `${id}-help` : undefined;
        const common = {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
          'aria-required': f.required || undefined,
        } as const;
        return (
          <div key={f.id} className="grid gap-1.5">
            <Label htmlFor={id}>
              {f.label}
              {!f.required && (
                <span className="font-normal text-muted-foreground"> (optional)</span>
              )}
            </Label>
            {f.type === 'choice' ? (
              <Select {...common} value={value} onChange={(e) => set(e.target.value)}>
                <option value="">Choose…</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : f.type === 'long_text' ? (
              <Textarea {...common} value={value} onChange={(e) => set(e.target.value)} />
            ) : (
              <Input
                {...common}
                type={f.type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            )}
            {error ? (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {error}
              </p>
            ) : (
              f.help && (
                <p id={`${id}-help`} className="text-sm text-muted-foreground">
                  {f.help}
                </p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Read-only "Label: value" list of the answered fields. */
export function AnswerList({
  fields,
  answers,
}: {
  fields: Field[];
  answers: Record<string, string | number>;
}) {
  const shown = fields.filter((f) => answers[f.id] !== undefined);
  if (shown.length === 0) return null;
  return (
    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {shown.map((f) => (
        <div key={f.id} className="flex gap-1">
          <dt>{f.label}:</dt>
          <dd className="text-foreground">{answers[f.id]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "At least 2 members with Department: CSE — 1 of 2" checklist. */
export function RuleChecklist({
  checks,
}: {
  checks: {
    rule: { id: string; description: string; minCount: number };
    count: number;
    met: boolean;
  }[];
}) {
  if (checks.length === 0) return null;
  return (
    <ul className="grid gap-1 text-sm" aria-label="Team requirements">
      {checks.map(({ rule, count, met }) => (
        <li key={rule.id} className={met ? 'text-green-700' : 'text-destructive'}>
          {met ? '✓' : '✗'} {rule.description} ({Math.min(count, rule.minCount)} of {rule.minCount})
        </li>
      ))}
    </ul>
  );
}
