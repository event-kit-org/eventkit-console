import { Pencil, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { CopyButton } from '@/components/CopyButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useEventContext } from '@/features/events/event-context';
import { FieldInputs } from '@/features/fields/FieldInputs';
import {
  type Draft,
  type Field as Question,
  missingRequired,
  toAnswers,
} from '@/features/fields/fields';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatMoney } from '@/lib/money';

type Member = Schemas['Team']['members'][number];

/** Correct a member's name or email; optionally resend everyone's links to the leader. */
export function EditMemberDialog({ member }: { member: Member }) {
  const api = useApi();
  const { event, features } = useEventContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? '');
  const [resend, setResend] = useState(false);
  const save = useEventMutation(event.id, () =>
    unwrap(
      api.PATCH('/v1/events/{eventId}/registrations/{registrationId}', {
        params: { path: { eventId: event.id, registrationId: member.registrationId } },
        body: {
          ...(name.trim() !== member.name ? { name } : {}),
          ...(email.trim().toLowerCase() !== member.email ? { email } : {}),
          resendToLeader: features.mailing && resend,
        },
      }),
    ),
  );
  const id = `edit-${member.registrationId}`;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(member.name);
          setEmail(member.email ?? '');
          // The leader's own address was wrong: they never got the links.
          setResend(member.isLeader);
          save.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil aria-hidden /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {member.name}</DialogTitle>
            <DialogDescription>Fix a typo in their name or email.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
              <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
              <Input
                id={`${id}-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {features.mailing && (
              <Field orientation="horizontal">
                <Checkbox
                  id={`${id}-resend`}
                  checked={resend}
                  onCheckedChange={(c) => setResend(c === true)}
                />
                <div className="grid gap-1">
                  <FieldLabel htmlFor={`${id}-resend`} className="font-normal">
                    Send the registration email to the leader again
                  </FieldLabel>
                  <FieldDescription>
                    Everyone in the team gets a new link; their old links stop working.
                  </FieldDescription>
                </div>
              </Field>
            )}
          </FieldGroup>
          <ErrorAlert error={save.error} />
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || !email.trim() || save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Add a member to a registered team: their link is shown here and emailed to the leader. */
export function AddMemberDialog({
  team,
  questions,
}: {
  team: Schemas['Team'];
  questions: Question[];
}) {
  const api = useApi();
  const { event } = useEventContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [draft, setDraft] = useState<Draft>({});
  const add = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/teams/{teamId}/members', {
        params: { path: { eventId: event.id, teamId: team.id } },
        body: { name, email, answers: toAnswers(questions, draft) },
      }),
    ),
  );
  const paid = team.payment.proofs.some((p) => p.status === 'approved');
  const extra =
    event.paymentMode !== 'none' && event.feeBasis === 'per_person' && paid && event.registrationFee
      ? formatMoney(event.registrationFee, event.currency)
      : null;
  const missing = missingRequired(questions, draft);
  const result = add.data;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setName('');
          setEmail('');
          setDraft({});
          add.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus aria-hidden /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        {result ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {result.name} joined {team.name}
              </DialogTitle>
              <DialogDescription>
                {result.emailedTo
                  ? `Their link was emailed to the leader (${result.emailedTo}) to pass on.`
                  : 'Send them their link: it is shown only here.'}
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <AlertTitle>Personal link</AlertTitle>
              <AlertDescription className="grid gap-2">
                <code className="font-mono text-xs break-all text-foreground">
                  {result.link.url ?? result.link.token}
                </code>
                <CopyButton value={result.link.url ?? result.link.token} label="Copy link" />
              </AlertDescription>
            </Alert>
            {extra && (
              <p className="text-sm text-muted-foreground">
                {extra} more is due for them: the leader uploads another receipt, and approving it
                confirms them.
              </p>
            )}
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate(undefined);
            }}
          >
            <DialogHeader>
              <DialogTitle>Add a member to {team.name}</DialogTitle>
              <DialogDescription>
                {extra
                  ? `The team has paid, so ${extra} more is due for them: the leader uploads another receipt.`
                  : 'They join at the team’s step.'}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="add-member-name">Name</FieldLabel>
                <Input
                  id="add-member-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="add-member-email">Email</FieldLabel>
                <Input
                  id="add-member-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </FieldGroup>
            <FieldInputs
              fields={questions}
              draft={draft}
              onChange={setDraft}
              idPrefix="add-member"
            />
            <ErrorAlert error={add.error} />
            <DialogFooter>
              <Button
                type="submit"
                disabled={!name.trim() || !email.trim() || missing.length > 0 || add.isPending}
              >
                Add member
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
