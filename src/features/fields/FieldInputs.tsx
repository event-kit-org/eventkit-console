import { useId } from 'react';
import { Input } from '@/components/ui/input';
import {
  Field as FormFieldBox,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { type AnswerValue, answerText, type Draft, type Field, toggleOption } from './fields';

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
    <div className="grid gap-5">
      {fields.map((f) => {
        const id = `${idPrefix ?? base}-${f.id}`;
        const raw = draft[f.id];
        const value = typeof raw === 'string' ? raw : '';
        const set = (v: string | string[]) => onChange({ ...draft, [f.id]: v });
        const error = errors[f.id];
        const describedBy = error ? `${id}-error` : f.help ? `${id}-help` : undefined;
        const common = {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
          'aria-required': f.required || undefined,
        } as const;
        return (
          <FormFieldBox key={f.id} data-invalid={error ? true : undefined}>
            <FieldLabel id={`${id}-label`} htmlFor={id} className="block">
              {f.label}
              {!f.required && (
                <span className="font-normal text-muted-foreground"> (optional)</span>
              )}
            </FieldLabel>
            {f.type === 'multi_choice' ? (
              <div role="group" aria-labelledby={`${id}-label`} className="grid gap-2">
                {f.options.map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={Array.isArray(raw) && raw.includes(o)}
                      onChange={() => set(toggleOption(raw, o))}
                    />
                    {o}
                  </label>
                ))}
              </div>
            ) : f.type === 'choice' ? (
              <NativeSelect
                {...common}
                className="w-full"
                value={value}
                onChange={(e) => set(e.target.value)}
              >
                <NativeSelectOption value="">Choose…</NativeSelectOption>
                {f.options.map((o) => (
                  <NativeSelectOption key={o} value={o}>
                    {o}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : f.type === 'long_text' ? (
              <Textarea {...common} value={value} onChange={(e) => set(e.target.value)} />
            ) : (
              <Input
                {...common}
                type={
                  f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : 'text'
                }
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            )}
            {error ? (
              <FieldError id={`${id}-error`}>{error}</FieldError>
            ) : (
              f.help && <FieldDescription id={`${id}-help`}>{f.help}</FieldDescription>
            )}
          </FormFieldBox>
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
  answers: Record<string, AnswerValue>;
}) {
  const shown = fields.filter((f) => answers[f.id] !== undefined);
  if (shown.length === 0) return null;
  return (
    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {shown.map((f) => (
        <div key={f.id} className="flex gap-1">
          <dt>{f.label}:</dt>
          <dd className="text-foreground">{answerText(answers[f.id], f.type)}</dd>
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
        <li
          key={rule.id}
          className={met ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}
        >
          {met ? '✓' : '✗'} {rule.description} ({Math.min(count, rule.minCount)} of {rule.minCount})
        </li>
      ))}
    </ul>
  );
}
