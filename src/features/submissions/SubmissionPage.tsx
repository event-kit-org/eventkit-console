import { ArrowLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { EntriesTable } from './EntriesTable';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, QuestionsSkeleton } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuestionPreview } from '@/features/admin/QuestionCard';
import { useEventContext } from '@/features/events/event-context';
import { PhaseBadge } from '@/features/judging/rounds';
import { useEventMutation } from '@/hooks/useEventMutation';
import { useSubmissions, type Submission } from './queries';
import { DraftQuestion, SavedQuestion, useMoveField } from './SubmissionBuilder';

/** Admin: one submission's title, description, questions and the entries teams made. */
export function SubmissionPage() {
  const { submissionId = '' } = useParams();
  const submissions = useSubmissions();
  const submission = submissions.data?.find((s) => s.id === submissionId);
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <Link
        to=".."
        relative="path"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> All submissions
      </Link>
      <ErrorAlert error={submissions.error} />
      {submissions.isPending && <QuestionsSkeleton />}
      {submissions.data && !submission && (
        <EmptyState icon={Plus} title="Submission not found">
          It may have been deleted.
        </EmptyState>
      )}
      {submission && <Editor key={submission.id} submission={submission} />}
    </div>
  );
}

type Active = { id: string } | { draft: true } | null;

function Editor({ submission }: { submission: Submission }) {
  const api = useApi();
  const { event } = useEventContext();
  const [title, setTitle] = useState(submission.title);
  const [description, setDescription] = useState(submission.description);
  const [active, setActive] = useState<Active>(null);
  const fields = [...submission.fields].sort((a, b) => a.position - b.position);
  const move = useMoveField(submission.id, fields);
  const save = useEventMutation(event.id, (body: { title: string; description: string }) =>
    unwrap(
      api.PATCH('/v1/events/{eventId}/submissions/{submissionId}', {
        params: { path: { eventId: event.id, submissionId: submission.id } },
        body,
      }),
    ),
  );
  const dirty = title.trim() !== submission.title || description !== submission.description;

  return (
    <>
      <PageHeader title={submission.title}>
        <PhaseBadge phase={submission.round.phase} />
      </PageHeader>
      <form
        className="grid gap-4 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ title: title.trim(), description });
        }}
      >
        <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid gap-2">
          <Label htmlFor="submission-description">Description</Label>
          <Textarea
            id="submission-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Round: <span className="font-medium text-foreground">{submission.round.name}</span>. A
          submission stays in the round it was created in; duplicate it to use it elsewhere.
        </p>
        <ErrorAlert error={save.error} />
        <div>
          <Button type="submit" disabled={!dirty || !title.trim() || save.isPending}>
            Save details
          </Button>
        </div>
      </form>

      <section aria-label="Questions" className="grid gap-3">
        <h3 className="font-medium">Questions</h3>
        <ErrorAlert error={move.error} />
        {fields.map((f, i) =>
          active && 'id' in active && active.id === f.id ? (
            <SavedQuestion
              key={f.id}
              submissionId={submission.id}
              field={f}
              canMoveUp={i > 0}
              canMoveDown={i < fields.length - 1}
              onMove={(by) => move.mutate({ field: f, neighbour: fields[i + by]! })}
              onDuplicated={(id) => setActive({ id })}
              onDeleted={() => setActive(null)}
            />
          ) : (
            <QuestionPreview key={f.id} question={f} onEdit={() => setActive({ id: f.id })} />
          ),
        )}
        {active && 'draft' in active ? (
          <DraftQuestion
            submissionId={submission.id}
            onCancel={() => setActive(null)}
            onCreated={(id) => setActive({ id })}
          />
        ) : (
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={() => setActive({ draft: true })}
          >
            <Plus aria-hidden /> Add question
          </Button>
        )}
      </section>

      <EntriesTable submission={submission} />
    </>
  );
}
