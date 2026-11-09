import { Link2, Mail, MoreHorizontal, Pencil, QrCode, UserPlus } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEventContext } from '@/features/events/event-context';
import { FieldInputs } from '@/features/fields/FieldInputs';
import {
  type Draft,
  fieldErrors,
  type Field as Question,
  missingRequired,
  toAnswers,
  toDraft,
} from '@/features/fields/fields';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatMoney } from '@/lib/money';

type Member = Schemas['Team']['members'][number];

/** Correct a member's name or email; optionally resend everyone's links to the leader. */
export function EditMemberDialog({
  member,
  open: openProp,
  onOpenChange,
}: {
  member: Member;
  /** Opened from elsewhere (the member menu): no button of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const api = useApi();
  const { event, features } = useEventContext();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (o: boolean) => (controlled ? onOpenChange?.(o) : setOpenState(o));
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? '');
  // The leader's own address was wrong: they never got the links.
  const [resend, setResend] = useState(member.isLeader);
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
      {!controlled && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Pencil aria-hidden /> Edit
          </Button>
        </DialogTrigger>
      )}
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
                    With everyone’s current link. Links too old to send again are replaced.
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

/**
 * Email a member's current link again, unchanged: to them, or to the leader to
 * pass on. Links made before links were kept need one new link first.
 */
/**
 * Admin: one member's actions behind a ⋯ button. Edit, a new link and a new QR
 * open their dialogs on the page (`onPick`); Resend link emails the current one.
 */
export function MemberMenu({
  member,
  active,
  onSent,
  onPick,
}: {
  member: Member;
  /** Not cancelled: can be edited and sent their link. */
  active: boolean;
  onSent: (message: string) => void;
  onPick: (action: 'edit' | 'link' | 'qr') => void;
}) {
  const api = useApi();
  const { event, features } = useEventContext();
  const send = useEventMutation(event.id, (to: 'member' | 'leader') =>
    unwrap(
      api.POST('/v1/events/{eventId}/registrations/{registrationId}/send-link', {
        params: { path: { eventId: event.id, registrationId: member.registrationId } },
        body: { to },
      }),
    ),
  );
  const go = (to: 'member' | 'leader') =>
    send.mutate(to, {
      onSuccess: ({ emailedTo }) => onSent(`${member.name}’s link was emailed to ${emailedTo}.`),
      onError: (err) => onSent(err instanceof Error ? err.message : 'The email could not be sent.'),
    });
  const ready = features.mailing && member.linkStored === true;
  return (
    // Not modal, so the dialog an item opens takes focus cleanly.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {/* Row action: a quiet icon, so a list of members doesn't repeat a label. */}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Options for ${member.name}`}
          title={`Options for ${member.name}`}
          className="text-muted-foreground hover:text-foreground data-[state=open]:bg-accent"
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {active && (
          <>
            <DropdownMenuItem onSelect={() => onPick('edit')}>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            {/* Mail is off for this event: greyed out, with the reason on hover. A disabled
                item ignores the pointer, so the tooltip hangs on a wrapper. */}
            {!features.mailing ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem disabled>
                      <Mail aria-hidden /> Resend link
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Turn on Mailing (Features) to send links.
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={send.isPending}>
                  <Mail aria-hidden /> Resend link
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-w-72">
                  {!ready ? (
                    <DropdownMenuLabel className="font-normal text-muted-foreground">
                      This link was made before links were kept, so it can’t be sent again. Give
                      them a new link once.
                    </DropdownMenuLabel>
                  ) : (
                    <>
                      <DropdownMenuLabel className="font-normal text-muted-foreground">
                        Their current link, unchanged
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => go('member')}>
                        Email to {member.isLeader ? 'them (leader)' : member.name}
                      </DropdownMenuItem>
                      {!member.isLeader && (
                        <DropdownMenuItem onSelect={() => go('leader')}>
                          Email to the team leader
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => onPick('link')}>
          <Link2 aria-hidden /> New link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick('qr')}>
          <QrCode aria-hidden /> New QR
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Admin: correct a team's name, its team answers, or who leads it. */
export function EditTeamDialog({
  team,
  questions,
  open: openProp,
  onOpenChange,
}: {
  team: Schemas['Team'];
  questions: Question[];
  /** Opened from elsewhere (the team menu): no button of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const api = useApi();
  const { event } = useEventContext();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (o: boolean) => (controlled ? onOpenChange?.(o) : setOpenState(o));
  const [name, setName] = useState(team.name);
  const [draft, setDraft] = useState<Draft>(() => toDraft(team.answers, questions));
  const leaderNow = team.members.find((m) => m.isLeader)?.registrationId ?? '';
  const [leader, setLeader] = useState(leaderNow);
  const active = team.members.filter((m) => m.status !== 'cancelled');
  const save = useEventMutation(event.id, () =>
    unwrap(
      api.PATCH('/v1/events/{eventId}/teams/{teamId}', {
        params: { path: { eventId: event.id, teamId: team.id } },
        body: {
          ...(name.trim() !== team.name ? { name } : {}),
          ...(questions.length > 0 ? { answers: toAnswers(questions, draft) } : {}),
          ...(leader !== leaderNow ? { leaderRegistrationId: leader } : {}),
        },
      }),
    ),
  );
  const missing = missingRequired(questions, draft);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(team.name);
          setDraft(toDraft(team.answers, questions));
          setLeader(leaderNow);
          save.reset();
        }
      }}
    >
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <Pencil aria-hidden /> Edit team
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {team.name}</DialogTitle>
            <DialogDescription>
              Change the team’s name, its answers or its leader. Members’ own details are edited on
              each member.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`team-${team.id}-name`}>Team name</FieldLabel>
              <Input
                id={`team-${team.id}-name`}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`team-${team.id}-leader`}>Leader</FieldLabel>
              <Select value={leader} onValueChange={setLeader}>
                <SelectTrigger id={`team-${team.id}-leader`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {active.map((m) => (
                    <SelectItem key={m.registrationId} value={m.registrationId}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <FieldInputs
            fields={questions}
            draft={draft}
            onChange={setDraft}
            errors={fieldErrors(save.error, '/answers')}
            idPrefix={`team-${team.id}`}
          />
          <ErrorAlert error={save.error} />
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || missing.length > 0 || save.isPending}>
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
  open: openProp,
  onOpenChange,
}: {
  team: Schemas['Team'];
  questions: Question[];
  /** Opened from elsewhere (the team menu): no button of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const api = useApi();
  const { event } = useEventContext();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (o: boolean) => (controlled ? onOpenChange?.(o) : setOpenState(o));
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
      {!controlled && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <UserPlus aria-hidden /> Add member
          </Button>
        </DialogTrigger>
      )}
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
