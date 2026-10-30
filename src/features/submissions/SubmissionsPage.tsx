import { Copy, FileUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { CardsSkeleton, EmptyState } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { PhaseBadge, useRounds } from '@/features/judging/rounds';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST, fromISTInput } from '@/lib/datetime';
import { useSubmissions } from './queries';

/** Admin: what teams submit in each round (a project link, a deck...), grouped by round. */
export function SubmissionsPage() {
  const api = useApi();
  const { event } = useEventContext();
  const rounds = useRounds();
  const submissions = useSubmissions();
  const params = (submissionId: string) => ({
    params: { path: { eventId: event.id, submissionId } },
  });
  const duplicate = useEventMutation(event.id, (id: string) =>
    unwrap(api.POST('/v1/events/{eventId}/submissions/{submissionId}/duplicate', params(id))),
  );
  const remove = useEventMutation(event.id, (id: string) =>
    unwrap(api.DELETE('/v1/events/{eventId}/submissions/{submissionId}', params(id))),
  );
  const loading = rounds.isPending || submissions.isPending;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <PageHeader
        title="Submissions"
        description="What teams hand in during each round. Participants see a round's submissions once the round is released."
      >
        {rounds.data && rounds.data.length > 0 && <CreateDialog />}
      </PageHeader>
      <ErrorAlert error={rounds.error ?? submissions.error ?? duplicate.error ?? remove.error} />
      {loading && <CardsSkeleton />}
      {rounds.data?.length === 0 && (
        <EmptyState icon={FileUp} title="No rounds yet">
          Add a round on the Judging page first; every submission belongs to a round.
        </EmptyState>
      )}
      {rounds.data?.map((round) => {
        const items = (submissions.data ?? []).filter((s) => s.round.id === round.id);
        return (
          <section key={round.id} aria-label={round.name} className="grid gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{round.name}</h3>
              <PhaseBadge phase={round.phase} />
            </div>
            {items.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No submissions in this round yet.</p>
            )}
            <ul className="grid divide-y rounded-lg border text-sm empty:hidden">
              {items.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 p-3">
                  <Link to={s.id} className="grid gap-0.5 hover:underline">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted-foreground">
                      {s.fields.length} {s.fields.length === 1 ? 'question' : 'questions'} ·{' '}
                      {s.entryCount} submitted
                      {s.deadline && <> · due {formatIST(s.deadline)}</>}
                    </span>
                  </Link>
                  <span className="flex shrink-0">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Duplicate ${s.title}`}
                      disabled={duplicate.isPending}
                      onClick={() => duplicate.mutate(s.id)}
                    >
                      <Copy />
                    </Button>
                    <ConfirmButton
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${s.title}`}
                      title={`Delete "${s.title}"?`}
                      description="A submission teams have already answered can't be deleted."
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => remove.mutate(s.id)}
                    >
                      <Trash2 />
                    </ConfirmButton>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CreateDialog() {
  const api = useApi();
  const { event, path } = useEventContext();
  const rounds = useRounds();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roundId, setRoundId] = useState('');
  const [question, setQuestion] = useState('');
  const [deadline, setDeadline] = useState('');
  const navigate = useNavigate();
  const chosen = roundId || rounds.data?.[0]?.id || '';
  const create = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/submissions', {
        ...path,
        body: {
          title: title.trim(),
          roundId: chosen,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(deadline ? { deadline: fromISTInput(deadline) } : {}),
          // Every submission has at least one question; more are added on its page.
          fields: [{ label: question.trim(), type: 'long_text', required: true }],
        },
      }),
    ),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> New submission
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(undefined, {
              onSuccess: (created) => {
                setOpen(false);
                setTitle('');
                setDescription('');
                setQuestion('');
                setDeadline('');
                void navigate(created.id);
              },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New submission</DialogTitle>
            <DialogDescription>
              Start with its first question; add more questions and change their types on the next
              page.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid gap-2">
            <Label htmlFor="new-submission-description">Description</Label>
            <Textarea
              id="new-submission-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <FormField
            label="First question"
            placeholder="e.g. Link to your project repository"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <FormField
            label="Deadline (optional, IST)"
            type="datetime-local"
            hint="Teams can still submit after it; late entries are marked."
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <div className="grid gap-2">
            <Label htmlFor="new-submission-round">Round</Label>
            <NativeSelect
              id="new-submission-round"
              value={chosen}
              onChange={(e) => setRoundId(e.target.value)}
            >
              {rounds.data?.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>
                  {r.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <ErrorAlert error={create.error} />
          <DialogFooter>
            <Button
              type="submit"
              disabled={!title.trim() || !question.trim() || !chosen || create.isPending}
            >
              Create submission
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
