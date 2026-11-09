import { ArrowLeft, ListChecks, Lock, LockOpen, Plus, Settings2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { EntriesTable } from './EntriesTable';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, QuestionsSkeleton } from '@/components/PageState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatIST } from '@/lib/datetime';
import { QuestionPreview } from '@/features/admin/QuestionCard';
import { useDetailCrumb } from '@/components/detail-crumb';
import { useEventContext } from '@/features/events/event-context';
import { PHASE_TONE, PhaseBadge } from '@/features/judging/rounds';
import { useEventMutation } from '@/hooks/useEventMutation';
import { fromISTInput, toISTInput } from '@/lib/datetime';
import { useSubmissions, type Submission } from './queries';
import { DraftQuestion, SavedQuestion, useMoveField } from './SubmissionBuilder';
import { MarkdownTextarea } from '@/components/MarkdownTextarea';

type View = 'main' | 'questions' | 'details';

/**
 * Admin: one submission. Its main page is the responses, under a card with what
 * it is and its options; its questions and its details each have a page.
 */
export function SubmissionPage({ view = 'main' }: { view?: View }) {
  const { submissionId = '' } = useParams();
  const submissions = useSubmissions();
  const submission = submissions.data?.find((s) => s.id === submissionId);
  useDetailCrumb(submission?.title);
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <Link
        to=".."
        relative="path"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {view === 'main' ? 'All submissions' : `Back to ${submission?.title ?? 'the submission'}`}
      </Link>
      <ErrorAlert error={submissions.error} />
      {submissions.isPending && <QuestionsSkeleton />}
      {submissions.data && !submission && (
        <EmptyState icon={Plus} title="Submission not found">
          It may have been deleted.
        </EmptyState>
      )}
      {submission && view === 'main' && <Overview key={submission.id} submission={submission} />}
      {submission && view === 'questions' && (
        <Questions key={submission.id} submission={submission} />
      )}
      {submission && view === 'details' && <Details key={submission.id} submission={submission} />}
    </div>
  );
}

/** The routes' paths are relative to the submission, so ".." from a section is it. */
export const SubmissionQuestionsPage = () => <SubmissionPage view="questions" />;
export const SubmissionDetailsPage = () => <SubmissionPage view="details" />;

const closed = (s: Submission) => s.closesAt !== null && Date.parse(s.closesAt) <= Date.now();

function useSubmissionPatch(submission: Submission) {
  const api = useApi();
  const { event } = useEventContext();
  return useEventMutation(
    event.id,
    (body: {
      title?: string;
      description?: string;
      deadline?: string | null;
      closesAt?: string | null;
      allowMultiple?: boolean;
    }) =>
      unwrap(
        api.PATCH('/v1/events/{eventId}/submissions/{submissionId}', {
          params: { path: { eventId: event.id, submissionId: submission.id } },
          body,
        }),
      ),
  );
}

function Badges({ submission }: { submission: Submission }) {
  return (
    <>
      <PhaseBadge phase={submission.round.phase} />
      {closed(submission) && submission.round.phase !== 'closed' && (
        <Badge variant="secondary" className={PHASE_TONE.closed}>
          Submissions closed
        </Badge>
      )}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </div>
  );
}

/** The card with everything about the submission, then who submitted and the responses. */
function Overview({ submission }: { submission: Submission }) {
  const questions = submission.fields.length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <h2 className="wrap-anywhere">{submission.title}</h2>
            <Badges submission={submission} />
          </CardTitle>
          {submission.description && (
            <CardDescription className="line-clamp-2 whitespace-pre-line">
              {submission.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Fact label="Round">{submission.round.name}</Fact>
            <Fact label="Deadline">
              {submission.deadline ? formatIST(submission.deadline) : 'None'}
            </Fact>
            <Fact label="Closes">
              {submission.closesAt ? formatIST(submission.closesAt) : 'With the round'}
            </Fact>
            <Fact label="Responses">
              {submission.allowMultiple ? 'Several per team' : 'One per team'}
            </Fact>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="questions">
                <ListChecks aria-hidden /> Questions
                <Badge variant="secondary" className="tabular-nums">
                  {questions}
                </Badge>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="details">
                <Settings2 aria-hidden /> Details
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <WhoSubmitted submissionId={submission.id} />
      <EntriesTable submission={submission} />
    </>
  );
}

type Active = { id: string } | { draft: true } | null;

/** The submission's questions: built and edited one at a time. */
function Questions({ submission }: { submission: Submission }) {
  const [active, setActive] = useState<Active>(null);
  const fields = [...submission.fields].sort((a, b) => a.position - b.position);
  const move = useMoveField(submission.id, fields);
  return (
    <>
      <PageHeader
        title={`${submission.title}: questions`}
        description="What teams answer when they submit."
      />
      <section aria-label="Questions" className="grid gap-3">
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
              canDelete={fields.length > 1}
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
    </>
  );
}

/** Title, description, deadline, closing and whether teams submit more than once. */
function Details({ submission }: { submission: Submission }) {
  const [title, setTitle] = useState(submission.title);
  const [description, setDescription] = useState(submission.description);
  const savedDeadline = submission.deadline ? toISTInput(submission.deadline) : '';
  const [deadline, setDeadline] = useState(savedDeadline);
  const savedClose = submission.closesAt ? toISTInput(submission.closesAt) : '';
  const [closesAt, setClosesAt] = useState(savedClose);
  const [allowMultiple, setAllowMultiple] = useState(submission.allowMultiple);
  // Closed on its own once its close time has come (closing the round closes it too).
  const formClosed = closed(submission);
  const save = useSubmissionPatch(submission);
  const dirty =
    title.trim() !== submission.title ||
    description !== submission.description ||
    deadline !== savedDeadline ||
    closesAt !== savedClose ||
    allowMultiple !== submission.allowMultiple;
  // Close now, or reopen (clear the close time); the round's phase is set on Judging.
  const closeNow = () => {
    const now = new Date().toISOString();
    setClosesAt(toISTInput(now));
    save.mutate({ closesAt: now });
  };
  const reopen = () => {
    setClosesAt('');
    save.mutate({ closesAt: null });
  };

  return (
    <>
      <PageHeader title={`${submission.title}: details`}>
        <div className="flex flex-wrap gap-2">
          <Badges submission={submission} />
        </div>
      </PageHeader>
      <form
        className="grid gap-4 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            title: title.trim(),
            description,
            deadline: deadline ? fromISTInput(deadline) : null,
            closesAt: closesAt ? fromISTInput(closesAt) : null,
            allowMultiple,
          });
        }}
      >
        <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid gap-2">
          <Label htmlFor="submission-description">Description</Label>
          <MarkdownTextarea
            id="submission-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <FormField
          label="Deadline (optional, IST)"
          type="datetime-local"
          hint="Teams can still submit after it; their entries are marked late. Clear it for no deadline."
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <FormField
          label="Closes at (optional, IST)"
          type="datetime-local"
          hint="No more submissions after it, even while the round is released, so judges can carry on. Closing the round closes it too. Leave it empty to keep it open."
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
        />
        <div className="flex items-start gap-3">
          <Switch
            id="allow-multiple"
            checked={allowMultiple}
            onCheckedChange={setAllowMultiple}
            className="mt-0.5"
          />
          <div className="grid gap-1">
            <Label htmlFor="allow-multiple">Teams can submit more than once</Label>
            <p className="text-sm text-muted-foreground">
              Off: one response per team. Either way a response can't be edited; delete one below to
              let a team submit again.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Round: <span className="font-medium text-foreground">{submission.round.name}</span>. A
          submission stays in the round it was created in; duplicate it to use it elsewhere.
        </p>
        <ErrorAlert error={save.error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!dirty || !title.trim() || save.isPending}>
            Save details
          </Button>
          {submission.round.phase !== 'closed' &&
            (formClosed ? (
              <Button type="button" variant="outline" disabled={save.isPending} onClick={reopen}>
                <LockOpen aria-hidden /> Reopen
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled={save.isPending} onClick={closeNow}>
                <Lock aria-hidden /> Close now
              </Button>
            ))}
        </div>
      </form>
    </>
  );
}

/** Which teams expected in the round have submitted, and which haven't yet. */
function WhoSubmitted({ submissionId }: { submissionId: string }) {
  const api = useApi();
  const { event } = useEventContext();
  const status = useQuery({
    queryKey: ['event', event.id, 'submissions', submissionId, 'status'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/submissions/{submissionId}/status', {
          params: { path: { eventId: event.id, submissionId } },
        }),
      ),
  });
  return (
    <section aria-label="Who has submitted" className="grid gap-3">
      <h3 className="font-medium">Who has submitted</h3>
      <ErrorAlert error={status.error} />
      {status.data && (
        <Tabs defaultValue={status.data.pending.length ? 'pending' : 'submitted'}>
          <TabsList>
            <TabsTrigger value="pending">Yet to submit ({status.data.pending.length})</TabsTrigger>
            <TabsTrigger value="submitted">Submitted ({status.data.submitted.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            {status.data.pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every team has submitted.</p>
            ) : (
              <ul
                aria-label="Yet to submit"
                className="grid gap-x-4 gap-y-1 rounded-lg border p-3 text-sm sm:grid-cols-2"
              >
                {status.data.pending.map((t) => (
                  <li key={t.id} className="wrap-anywhere">
                    <TeamLink eventId={event.id} team={t} />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="submitted">
            {status.data.submitted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team has submitted yet.</p>
            ) : (
              <ul aria-label="Submitted" className="grid gap-1 rounded-lg border p-3 text-sm">
                {status.data.submitted.map((s) => (
                  <li key={s.team.id} className="flex flex-wrap justify-between gap-x-3">
                    <span className="min-w-0 wrap-anywhere">
                      <TeamLink eventId={event.id} team={s.team} />
                    </span>
                    <span className="text-muted-foreground">
                      {s.responses > 1 && `${s.responses} responses · `}
                      {formatIST(s.lastAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}

function TeamLink({ eventId, team }: { eventId: string; team: { id: string; name: string } }) {
  return (
    <Link to={`/events/${eventId}/teams/${team.id}`} className="underline-offset-4 hover:underline">
      {team.name}
    </Link>
  );
}
