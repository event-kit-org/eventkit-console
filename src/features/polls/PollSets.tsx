import { ListChecks, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { RolePicker } from '@/components/RolePicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { audienceText } from '@/lib/audience';
import { formatIST, fromISTInput } from '@/lib/datetime';
import {
  hasOptions,
  isSingleChoice,
  type Poll,
  POLL_TYPES,
  type PollType,
  typeLabel,
} from './poll-kinds';
import { PollAnswerForm } from './PollAnswerForm';

/** One question being written: what the API takes for a question of a set. */
interface QuestionDraft {
  key: string;
  question: string;
  type: PollType;
  options: string;
  scaleMax: string;
  defaultIndex: string;
}

const newQuestion = (): QuestionDraft => ({
  key: crypto.randomUUID(),
  question: '',
  type: 'choice',
  options: '',
  scaleMax: '5',
  defaultIndex: '',
});

const labelsOf = (q: QuestionDraft) =>
  q.options
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const toQuestion = (q: QuestionDraft) => ({
  question: q.question.trim(),
  type: q.type,
  ...(hasOptions(q.type) ? { options: labelsOf(q) } : {}),
  ...(q.type === 'rating' ? { scaleMax: Number(q.scaleMax) } : {}),
  ...(isSingleChoice(q.type) && q.defaultIndex !== ''
    ? { defaultOptionIndex: Number(q.defaultIndex) }
    : {}),
});

const questionReady = (q: QuestionDraft) =>
  q.question.trim() !== '' && (!hasOptions(q.type) || labelsOf(q).length >= 2);

/** The fields of one question: its text, answer type, and options or scale. */
function QuestionEditor({
  draft,
  index,
  onChange,
  onRemove,
}: {
  draft: QuestionDraft;
  index: number;
  onChange: (q: QuestionDraft) => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const set = (patch: Partial<QuestionDraft>) => onChange({ ...draft, ...patch });
  const labels = labelsOf(draft);
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Question {index + 1}</span>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove question ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
      <FormField
        label={`Question ${index + 1} text`}
        value={draft.question}
        onChange={(e) => set({ question: e.target.value })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-type`}>Answer type</FieldLabel>
          <Select value={draft.type} onValueChange={(v) => set({ type: v as PollType })}>
            <SelectTrigger id={`${id}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {draft.type === 'rating' && (
          <Field>
            <FieldLabel htmlFor={`${id}-scale`}>Scale</FieldLabel>
            <Select value={draft.scaleMax} onValueChange={(v) => set({ scaleMax: v })}>
              <SelectTrigger id={`${id}-scale`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 9 }, (_, i) => String(i + 2)).map((n) => (
                  <SelectItem key={n} value={n}>
                    1 to {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {isSingleChoice(draft.type) && labels.length > 0 && (
          <Field>
            <FieldLabel htmlFor={`${id}-default`}>Default option</FieldLabel>
            <Select
              value={draft.defaultIndex === '' ? 'none' : draft.defaultIndex}
              onValueChange={(v) => set({ defaultIndex: v === 'none' ? '' : v })}
            >
              <SelectTrigger id={`${id}-default`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {labels.map((l, i) => (
                  <SelectItem key={`${l}-${i}`} value={String(i)}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      {hasOptions(draft.type) && (
        <Field>
          <FieldLabel htmlFor={`${id}-options`}>Options, one per line</FieldLabel>
          <Textarea
            id={`${id}-options`}
            rows={3}
            value={draft.options}
            onChange={(e) => set({ options: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
}

/** A set of questions answered together on one card, e.g. a feedback form. */
export function CreatePollSet() {
  const api = useApi();
  const { event, path } = useEventContext();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [audience, setAudience] = useState<Schemas['Role'][]>(['participant']);
  const [closesAt, setClosesAt] = useState('');
  const [resultsVisible, setResultsVisible] = useState(false);
  const visibleId = useId();
  const create = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/polls/groups', {
        ...path,
        body: {
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          audience,
          closesAt: closesAt ? fromISTInput(closesAt) : null,
          resultsVisible,
          questions: questions.map(toQuestion),
        },
      }),
    ),
  );
  const reset = () => {
    setTitle('');
    setDescription('');
    setQuestions([newQuestion()]);
    setClosesAt('');
    setResultsVisible(false);
    create.reset();
  };
  const ready =
    title.trim() !== '' &&
    audience.length > 0 &&
    questions.length > 0 &&
    questions.every(questionReady);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <ListChecks aria-hidden /> New question set
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <DialogHeader>
            <DialogTitle>New question set</DialogTitle>
            <DialogDescription>
              Several questions on one card, answered together, like a feedback form. They share who
              it is for, when it closes and whether results are shown.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Field>
            <FieldLabel htmlFor="set-description">Description (optional)</FieldLabel>
            <Textarea
              id="set-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid gap-3">
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.key}
                draft={q}
                index={i}
                onChange={(next) =>
                  setQuestions((qs) => qs.map((x) => (x.key === q.key ? next : x)))
                }
                onRemove={
                  questions.length > 1
                    ? () => setQuestions((qs) => qs.filter((x) => x.key !== q.key))
                    : undefined
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              disabled={questions.length >= 20}
              onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
            >
              <Plus aria-hidden /> Add question
            </Button>
          </div>
          <Separator />
          <RolePicker value={audience} onChange={setAudience} />
          <FormField
            label="Closes (IST, optional)"
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
          <Field orientation="horizontal">
            <Checkbox
              id={visibleId}
              checked={resultsVisible}
              onCheckedChange={(c) => setResultsVisible(c === true)}
            />
            <FieldLabel htmlFor={visibleId} className="font-normal">
              The audience can see the results
            </FieldLabel>
          </Field>
          <ErrorAlert error={create.error} />
          <DialogFooter>
            <Button type="submit" disabled={!ready || create.isPending}>
              Create set
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Adds one question at the end of a set. */
function AddQuestion({ groupId }: { groupId: string }) {
  const api = useApi();
  const { event } = useEventContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft>(newQuestion);
  const add = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/polls/groups/{groupId}/questions', {
        params: { path: { eventId: event.id, groupId } },
        body: toQuestion(draft),
      }),
    ),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDraft(newQuestion());
          add.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus aria-hidden /> Add question
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a question</DialogTitle>
            <DialogDescription>It goes at the end of the set.</DialogDescription>
          </DialogHeader>
          <QuestionEditor draft={draft} index={0} onChange={setDraft} />
          <ErrorAlert error={add.error} />
          <DialogFooter>
            <Button type="submit" disabled={!questionReady(draft) || add.isPending}>
              Add question
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A set as one card: its questions in order, and (for its managers) the set's settings. */
export function PollSetCard({ questions }: { questions: Poll[] }) {
  const api = useApi();
  const { event } = useEventContext();
  const first = questions[0]!;
  const group = first.group!;
  const p = { params: { path: { eventId: event.id, groupId: group.id } } };
  const patch = useEventMutation(
    event.id,
    (body: { closesAt?: string | null; resultsVisible?: boolean }) =>
      unwrap(api.PATCH('/v1/events/{eventId}/polls/groups/{groupId}', { ...p, body })),
  );
  const remove = useEventMutation(event.id, () =>
    unwrap(api.DELETE('/v1/events/{eventId}/polls/groups/{groupId}', p)),
  );
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="min-w-0 wrap-anywhere">{group.title}</CardTitle>
          <Badge variant="outline">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'}
          </Badge>
          {first.closed && <Badge variant="secondary">Closed</Badge>}
        </div>
        <CardDescription className="grid gap-1">
          {group.description && <span className="wrap-anywhere">{group.description}</span>}
          <span>
            {audienceText(first.audience)}
            {first.closesAt &&
              ` · ${first.closed ? 'closed' : 'closes'} ${formatIST(first.closesAt)}`}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {questions.map((q, i) => (
          <section key={q.id} aria-label={q.question} className="grid gap-2">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <span className="wrap-anywhere">
                {i + 1}. {q.question}
              </span>
              <Badge variant="outline">{typeLabel(q.type)}</Badge>
            </h3>
            <PollAnswerForm poll={q} />
          </section>
        ))}
        <ErrorAlert error={patch.error ?? remove.error} />
      </CardContent>
      {first.canManage && (
        <CardFooter className="flex-wrap gap-2 border-t">
          <Button
            size="sm"
            variant="outline"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ resultsVisible: !first.resultsVisible })}
          >
            {first.resultsVisible
              ? 'Hide results from the audience'
              : 'Show results to the audience'}
          </Button>
          {first.closed ? (
            <Button
              size="sm"
              variant="outline"
              disabled={patch.isPending}
              onClick={() => patch.mutate({ closesAt: null })}
            >
              <LockOpen aria-hidden /> Reopen set
            </Button>
          ) : (
            <ConfirmButton
              size="sm"
              variant="outline"
              title="Close this set now?"
              description="Nobody can answer or change their answers any more. You can reopen it."
              confirmLabel="Close set"
              disabled={patch.isPending}
              onConfirm={() => patch.mutate({ closesAt: new Date().toISOString() })}
            >
              <Lock aria-hidden /> Close set
            </ConfirmButton>
          )}
          <AddQuestion groupId={group.id} />
          <ConfirmButton
            size="sm"
            variant="ghost"
            title={`Delete "${group.title}"?`}
            description="Its questions and everyone’s answers go with it. This can’t be undone."
            confirmLabel="Delete set"
            destructive
            disabled={remove.isPending}
            onConfirm={() => remove.mutate(undefined)}
          >
            <Trash2 aria-hidden /> Delete set
          </ConfirmButton>
        </CardFooter>
      )}
    </Card>
  );
}
