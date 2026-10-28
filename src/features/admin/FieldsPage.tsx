import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useEventContext } from '@/features/events/event-context';
import type { Field, TeamRule } from '@/features/fields/fields';
import { useFields, useTeamRules } from '@/features/fields/queries';
import { useEventMutation } from '@/hooks/useEventMutation';
import {
  type MinCounts,
  type Question,
  type QuestionPatch,
  BuiltInQuestion,
  QuestionEditor,
  QuestionPreview,
  SavedActions,
} from './QuestionCard';

const SECTIONS = {
  team: {
    scope: 'team',
    title: 'Team details',
    hint: 'Answered once per team.',
    builtIn: [{ label: 'Team name', hint: 'Short answer text' }],
  },
  member: {
    scope: 'member',
    title: 'Member details',
    hint: 'e.g. department, student ID, phone. Asked for each member; the leader fills them in when registering the team.',
    builtIn: [
      { label: 'Name', hint: 'Short answer text' },
      { label: 'Email', hint: 'Email address: their personal link is sent here' },
    ],
  },
} as const;
type Section = keyof typeof SECTIONS;

const sectionOf = (f: Field): Section => f.scope;
const minCountsOf = (rules: TeamRule[]): MinCounts =>
  Object.fromEntries(rules.map((r) => [r.value, r.minCount]));

/** The open card: a saved field's id, or a draft in a section. */
type Active = { id: string } | { draft: Section } | null;

/**
 * Admin: the registration form, built like a Google Form. Questions sit in
 * two sections by who answers them, after the ones every form has (team name,
 * member name and email); click one to edit it in place. Team
 * rules ("at least 2 members from CSE") are set next to a dropdown's options.
 */
export function FieldsPage() {
  const fields = useFields();
  const rules = useTeamRules();
  const [active, setActive] = useState<Active>(null);
  const all = fields.data ?? [];
  const move = useMoveField(all);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <PageHeader
        title="Registration form"
        description="What the team leader fills in when registering. Team name, and each member's name and email, are always asked; add everything else. Click a question to edit it."
      />
      <ErrorAlert error={fields.error ?? rules.error ?? move.error} />
      {(Object.keys(SECTIONS) as Section[]).map((section) => {
        const inSection = all.filter((f) => sectionOf(f) === section);
        return (
          <section key={section} aria-labelledby={`section-${section}`} className="grid gap-3">
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <h2 id={`section-${section}`} className="text-lg font-semibold">
                {SECTIONS[section].title}
              </h2>
              <p className="text-sm text-muted-foreground">{SECTIONS[section].hint}</p>
            </div>
            {SECTIONS[section].builtIn.map((q) => (
              <BuiltInQuestion key={q.label} label={q.label} hint={q.hint} />
            ))}
            {inSection.map((f, i) =>
              active && 'id' in active && active.id === f.id ? (
                <SavedQuestion
                  key={f.id}
                  field={f}
                  rules={(rules.data ?? []).filter((r) => r.fieldId === f.id)}
                  canMoveUp={i > 0}
                  canMoveDown={i < inSection.length - 1}
                  onMove={(by) => move.mutate({ field: f, neighbour: inSection[i + by]! })}
                  onDuplicated={(id) => setActive({ id })}
                  onDeleted={() => setActive(null)}
                />
              ) : (
                <QuestionPreview
                  key={f.id}
                  question={f}
                  rules={(rules.data ?? []).filter((r) => r.fieldId === f.id)}
                  onEdit={() => setActive({ id: f.id })}
                />
              ),
            )}
            {active && 'draft' in active && active.draft === section ? (
              <DraftQuestion
                section={section}
                onCancel={() => setActive(null)}
                onCreated={(id) => setActive({ id })}
              />
            ) : (
              <Button
                variant="outline"
                className="justify-self-start"
                onClick={() => setActive({ draft: section })}
              >
                <Plus aria-hidden /> Add question
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Swaps a field with its neighbour, renumbering every position so ties can't stick. */
function useMoveField(all: Field[]) {
  const api = useApi();
  const { event } = useEventContext();
  return useEventMutation(
    event.id,
    async ({ field, neighbour }: { field: Field; neighbour: Field }) => {
      const order = [...all];
      const a = order.indexOf(field);
      const b = order.indexOf(neighbour);
      [order[a], order[b]] = [order[b]!, order[a]!];
      await Promise.all(
        order.flatMap((f, position) =>
          f.position === position
            ? []
            : [
                unwrap(
                  api.PATCH('/v1/events/{eventId}/fields/{fieldId}', {
                    params: { path: { eventId: event.id, fieldId: f.id } },
                    body: { position },
                  }),
                ),
              ],
        ),
      );
    },
  );
}

function SavedQuestion({
  field,
  rules,
  canMoveUp,
  canMoveDown,
  onMove,
  onDuplicated,
  onDeleted,
}: {
  field: Field;
  rules: TeamRule[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (by: -1 | 1) => void;
  onDuplicated: (id: string) => void;
  onDeleted: () => void;
}) {
  const api = useApi();
  const { event, path } = useEventContext();
  const queryClient = useQueryClient();
  const params = { params: { path: { eventId: event.id, fieldId: field.id } } };
  const update = useEventMutation(event.id, (body: QuestionPatch) =>
    unwrap(api.PATCH('/v1/events/{eventId}/fields/{fieldId}', { ...params, body })),
  );
  // A changed minimum replaces the option's rule. Refresh even if only half of
  // that went through, so the card shows what is really saved.
  const minCount = useEventMutation(
    event.id,
    async ({ value, min }: { value: string; min: number | null }) => {
      const existing = rules.find((r) => r.value === value);
      try {
        if (existing) {
          await unwrap(
            api.DELETE('/v1/events/{eventId}/team-rules/{ruleId}', {
              params: { path: { eventId: event.id, ruleId: existing.id } },
            }),
          );
        }
        if (min) {
          await unwrap(
            api.POST('/v1/events/{eventId}/team-rules', {
              ...path,
              body: { fieldId: field.id, value, minCount: min },
            }),
          );
        }
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['event', event.id] });
      }
    },
  );
  const duplicate = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/fields', {
        ...path,
        body: { ...createBody(field), label: `${field.label} (copy)` },
      }),
    ),
  );
  const remove = useEventMutation(event.id, () =>
    unwrap(api.DELETE('/v1/events/{eventId}/fields/{fieldId}', params)),
  );

  return (
    <QuestionEditor
      question={field}
      minCounts={minCountsOf(rules)}
      saved
      error={update.error ?? minCount.error ?? duplicate.error ?? remove.error}
      onChange={(patch) => update.mutate(patch)}
      onMinCount={(value, min) => minCount.mutate({ value, min })}
      footer={
        <SavedActions
          label={field.label}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMove={onMove}
          onDuplicate={() => duplicate.mutate(undefined, { onSuccess: (f) => onDuplicated(f.id) })}
          onDelete={() => remove.mutate(undefined, { onSuccess: onDeleted })}
        />
      }
    />
  );
}

function DraftQuestion({
  section,
  onCancel,
  onCreated,
}: {
  section: Section;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const api = useApi();
  const { event, path } = useEventContext();
  const queryClient = useQueryClient();
  const [q, setQ] = useState<Question>({
    scope: SECTIONS[section].scope,
    label: '',
    help: null,
    type: 'short_text',
    options: [],
    required: true,
    unique: false,
    pattern: null,
  });
  const [minCounts, setMinCounts] = useState<MinCounts>({});
  const create = useEventMutation(event.id, async () => {
    const field = await unwrap(
      api.POST('/v1/events/{eventId}/fields', {
        ...path,
        body: createBody(q),
      }),
    );
    // Rules need the field's id, so they follow its creation.
    try {
      for (const [value, minCount] of Object.entries(minCounts)) {
        if (!q.options.includes(value)) continue;
        await unwrap(
          api.POST('/v1/events/{eventId}/team-rules', {
            ...path,
            body: { fieldId: field.id, value, minCount },
          }),
        );
      }
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['event', event.id] });
    }
    return field;
  });
  const missingOptions = q.type === 'choice' && q.options.length === 0;

  return (
    <QuestionEditor
      question={q}
      minCounts={minCounts}
      saved={false}
      error={create.error}
      onChange={(patch) => setQ({ ...q, ...patch })}
      onTypeChange={(type) =>
        setQ({
          ...q,
          type,
          options: type === 'choice' && q.options.length === 0 ? ['Option 1'] : q.options,
          pattern: type === 'short_text' || type === 'long_text' ? q.pattern : null,
        })
      }
      onMinCount={(value, min) => {
        const { [value]: _, ...rest } = minCounts;
        setMinCounts(min ? { ...rest, [value]: min } : rest);
      }}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!q.label.trim() || missingOptions || create.isPending}
            onClick={() => create.mutate(undefined, { onSuccess: (f) => onCreated(f.id) })}
          >
            Add question
          </Button>
        </>
      }
    />
  );
}

/** The POST body for a new field with these settings. */
function createBody(q: Question) {
  const text = q.type === 'short_text' || q.type === 'long_text';
  return {
    scope: q.scope,
    label: q.label.trim(),
    type: q.type,
    required: q.required,
    unique: q.unique,
    ...(q.help ? { help: q.help } : {}),
    ...(q.type === 'choice' ? { options: q.options } : {}),
    ...(text && q.pattern ? { pattern: q.pattern } : {}),
  };
}
