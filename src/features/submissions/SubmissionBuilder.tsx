import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { Button } from '@/components/ui/button';
import {
  type Question,
  type QuestionPatch,
  QuestionEditor,
  SavedActions,
} from '@/features/admin/QuestionCard';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';

type SubmissionField = Schemas['SubmissionField'];

/** The POST body for a new question with these settings. */
function createBody(q: Question) {
  const text = q.type === 'short_text' || q.type === 'long_text';
  return {
    label: q.label.trim(),
    type: q.type,
    required: q.required,
    unique: q.unique,
    ...(q.help ? { help: q.help } : {}),
    ...(q.type === 'choice' ? { options: q.options } : {}),
    ...(text && q.pattern ? { pattern: q.pattern } : {}),
  };
}

/** Swaps a question with its neighbour, renumbering every position so ties can't stick. */
export function useMoveField(submissionId: string, all: SubmissionField[]) {
  const api = useApi();
  const { event } = useEventContext();
  return useEventMutation(
    event.id,
    async ({ field, neighbour }: { field: SubmissionField; neighbour: SubmissionField }) => {
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
                  api.PATCH('/v1/events/{eventId}/submissions/{submissionId}/fields/{fieldId}', {
                    params: { path: { eventId: event.id, submissionId, fieldId: f.id } },
                    body: { position },
                  }),
                ),
              ],
        ),
      );
    },
  );
}

export function SavedQuestion({
  submissionId,
  field,
  canMoveUp,
  canMoveDown,
  onMove,
  onDuplicated,
  onDeleted,
}: {
  submissionId: string;
  field: SubmissionField;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (by: -1 | 1) => void;
  onDuplicated: (id: string) => void;
  onDeleted: () => void;
}) {
  const api = useApi();
  const { event } = useEventContext();
  const base = { eventId: event.id, submissionId };
  const params = { params: { path: { ...base, fieldId: field.id } } };
  const update = useEventMutation(event.id, (body: QuestionPatch) =>
    unwrap(
      api.PATCH('/v1/events/{eventId}/submissions/{submissionId}/fields/{fieldId}', {
        ...params,
        body,
      }),
    ),
  );
  const duplicate = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/submissions/{submissionId}/fields', {
        params: { path: base },
        body: { ...createBody(field), label: `${field.label} (copy)` },
      }),
    ),
  );
  const remove = useEventMutation(event.id, () =>
    unwrap(api.DELETE('/v1/events/{eventId}/submissions/{submissionId}/fields/{fieldId}', params)),
  );
  return (
    <QuestionEditor
      question={field}
      saved
      error={update.error ?? duplicate.error ?? remove.error}
      onChange={(patch) => update.mutate(patch)}
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

export function DraftQuestion({
  submissionId,
  onCancel,
  onCreated,
}: {
  submissionId: string;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const api = useApi();
  const { event } = useEventContext();
  const [q, setQ] = useState<Question>({
    label: '',
    help: null,
    type: 'short_text',
    options: [],
    required: true,
    unique: false,
    pattern: null,
  });
  const create = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/submissions/{submissionId}/fields', {
        params: { path: { eventId: event.id, submissionId } },
        body: createBody(q),
      }),
    ),
  );
  const missingOptions = q.type === 'choice' && q.options.length === 0;
  return (
    <QuestionEditor
      question={q}
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
