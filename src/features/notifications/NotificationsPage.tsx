import { useMutation, useQuery } from '@tanstack/react-query';
import { BellOff, BellRing, Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { EmptyState, RowsSkeleton } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { RolePicker } from '@/components/RolePicker';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { audienceText, ROLES } from '@/lib/audience';
import { formatIST } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { enablePush, pushSupported } from './push';

type Channel = Schemas['Channel'];
type LastSeen = Record<string, string>;

const seenKey = (eventId: string) => `console.notif.lastSeen.${eventId}`;

function readSeen(eventId: string): LastSeen {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(seenKey(eventId)) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as LastSeen) : {};
  } catch {
    return {};
  }
}

function writeSeen(eventId: string, seen: LastSeen) {
  try {
    window.localStorage.setItem(seenKey(eventId), JSON.stringify(seen));
  } catch {
    // not remembered
  }
}

/** Read state lives in this browser: a channel is unread when it has a message newer than when you last opened it. */
function useLastSeen(eventId: string) {
  const [seen, setSeen] = useState<LastSeen>(() => readSeen(eventId));
  const markSeen = (channelId: string, newest: string | undefined) => {
    const now = new Date().toISOString();
    // A message stamped ahead of this clock still counts as read.
    const at = newest && newest > now ? newest : now;
    setSeen((prev) => {
      const next = { ...prev, [channelId]: at };
      writeSeen(eventId, next);
      return next;
    });
  };
  return { seen, markSeen };
}

/** Channels on the left, the open channel's messages and composer on the right. */
export function NotificationsPage() {
  const api = useApi();
  const { event, path, role } = useEventContext();
  // The whole feed: it says which channels have something new.
  const feed = useQuery({
    queryKey: ['event', event.id, 'notifications'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/notifications', path)),
    refetchInterval: 30_000,
  });
  const channels = useQuery({
    queryKey: ['event', event.id, 'channels'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/channels', path)),
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const list = channels.data ?? [];
  const selected = list.find((c) => c.id === chosen) ?? list[0];
  const { seen, markSeen } = useLastSeen(event.id);

  const latest = useMemo(() => {
    const byChannel: Record<string, string> = {};
    for (const n of feed.data ?? []) {
      if (!byChannel[n.channel.id] || n.sentAt > byChannel[n.channel.id]!) {
        byChannel[n.channel.id] = n.sentAt;
      }
    }
    return byChannel;
  }, [feed.data]);
  const unread = (c: Channel) => {
    const newest = latest[c.id];
    return c.id !== selected?.id && !!newest && newest > (seen[c.id] ?? '');
  };

  const selectedId = selected?.id;
  const selectedLatest = selectedId ? latest[selectedId] : undefined;
  useEffect(() => {
    // Opening a channel, or a message arriving while it is open, marks it seen.
    if (selectedId) markSeen(selectedId, selectedLatest);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedLatest]);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Notifications"
        description="Announcements to participants and staff, by channel. Urgent ones also push to devices."
      />
      <PushCard />
      <ErrorAlert error={feed.error ?? channels.error} />
      <div className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside
          aria-label="Channels"
          className="flex min-w-0 flex-col gap-3 border-b p-3 md:border-r md:border-b-0"
        >
          <h2 className="px-1 text-sm font-semibold">Channels</h2>
          {channels.isPending ? (
            <div className="grid gap-2" aria-busy="true">
              <span className="sr-only">Loading…</span>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:flex-1 md:content-start md:overflow-visible md:px-0 md:pb-0">
              {list.map((c) => (
                <li key={c.id} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    aria-current={c.id === selected?.id ? 'true' : undefined}
                    onClick={() => setChosen(c.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                      c.id === selected?.id && 'bg-muted font-medium',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {unread(c) && (
                      <span className="size-2 shrink-0 rounded-full bg-blue-500">
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                    <Badge variant="secondary" className="shrink-0">
                      {audienceText(c.audience)}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {channels.data && list.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">No channels yet.</p>
          )}
          {(role === 'admin' || role === 'volunteer') && (
            <AddChannel onCreated={(id) => setChosen(id)} />
          )}
        </aside>
        <section aria-label="Messages" className="flex min-w-0 flex-col">
          {selected ? (
            <Messages key={selected.id} channel={selected} />
          ) : (
            <div className="p-4">
              {channels.isPending ? (
                <RowsSkeleton rows={3} />
              ) : (
                <EmptyState icon={BellOff} title="No notifications yet." />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** One channel: its messages, newest first, and (where you may send) the composer. */
function Messages({ channel }: { channel: Channel }) {
  const api = useApi();
  const { event } = useEventContext();
  const messages = useQuery({
    queryKey: ['event', event.id, 'notifications', channel.id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{eventId}/notifications', {
          params: { path: { eventId: event.id }, query: { channelId: channel.id } },
        }),
      ),
    refetchInterval: 30_000,
  });
  return (
    <>
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="min-w-0 truncate text-base font-semibold">{channel.name}</h2>
      </header>
      <div className="grid min-h-48 flex-1 content-start gap-3 p-4 md:max-h-[32rem] md:overflow-y-auto">
        <ErrorAlert error={messages.error} />
        {messages.isPending && <RowsSkeleton rows={3} />}
        {messages.data?.length === 0 && <EmptyState icon={BellOff} title="No notifications yet." />}
        {messages.data?.map((n) => (
          <article key={n.id} className="grid gap-1 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">{n.title}</h3>
                {n.priority === 'urgent' && <Badge variant="destructive">Urgent</Badge>}
              </div>
              <time dateTime={n.sentAt} className="shrink-0 text-xs text-muted-foreground">
                {formatIST(n.sentAt)}
              </time>
            </div>
            <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            <p className="text-xs text-muted-foreground">{n.sender.name}</p>
          </article>
        ))}
      </div>
      {channel.canSend && <Composer channel={channel} />}
    </>
  );
}

function PushCard() {
  const api = useApi();
  const config = useQuery({
    queryKey: ['push-config'],
    queryFn: () => unwrap(api.GET('/v1/push/config')),
  });
  const enable = useMutation({ mutationFn: (key: string) => enablePush(api, key) });
  if (!config.data?.enabled || !config.data.publicKey || !pushSupported()) return null;
  const key = config.data.publicKey;
  return (
    <div className="grid gap-2">
      <Alert>
        <BellRing aria-hidden />
        <AlertDescription className="text-foreground">
          {enable.isSuccess
            ? 'Urgent notifications will reach this device.'
            : 'Get urgent notifications on this device, even when the app is closed.'}
        </AlertDescription>
        {!enable.isSuccess && (
          <AlertAction>
            <Button size="xs" disabled={enable.isPending} onClick={() => enable.mutate(key)}>
              Turn on
            </Button>
          </AlertAction>
        )}
      </Alert>
      <ErrorAlert error={enable.error} />
    </div>
  );
}

function Composer({ channel }: { channel: Channel }) {
  const api = useApi();
  const { event } = useEventContext();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const urgentId = useId();
  const send = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/channels/{channelId}/notifications', {
        params: { path: { eventId: event.id, channelId: channel.id } },
        body: { title, body, priority: urgent ? 'urgent' : 'normal' },
      }),
    ),
  );
  return (
    <form
      className="grid gap-3 border-t p-4"
      aria-label="Send a notification"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate(undefined, {
          onSuccess: () => {
            setTitle('');
            setBody('');
            setUrgent(false);
          },
        });
      }}
    >
      <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Field>
        <FieldLabel htmlFor="send-body">Message</FieldLabel>
        <Textarea id="send-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Field orientation="horizontal">
        <Checkbox id={urgentId} checked={urgent} onCheckedChange={(c) => setUrgent(c === true)} />
        <FieldLabel htmlFor={urgentId} className="font-normal">
          Urgent: also push to devices
        </FieldLabel>
      </Field>
      <ErrorAlert error={send.error} />
      {send.isSuccess && (
        <p className="text-sm text-muted-foreground" role="status">
          Sent
          {send.data.notification.priority === 'urgent'
            ? `, pushed to ${send.data.pushed} devices`
            : ''}
          .
        </p>
      )}
      <div>
        <Button type="submit" disabled={!title.trim() || !body.trim() || send.isPending}>
          Send
        </Button>
      </div>
    </form>
  );
}

/** "+ Add channel": a dialog for the name and the roles it reaches. */
function AddChannel({ onCreated }: { onCreated: (channelId: string) => void }) {
  const api = useApi();
  const { event, path } = useEventContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [audience, setAudience] = useState<Schemas['Role'][]>(ROLES);
  const create = useEventMutation(event.id, () =>
    unwrap(api.POST('/v1/events/{eventId}/channels', { ...path, body: { name, audience } })),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus aria-hidden /> Add channel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
          <DialogDescription>
            Each channel reaches a set of roles. Volunteers can send only where volunteers are in
            the audience.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(undefined, {
              onSuccess: (channel) => {
                setName('');
                setAudience(ROLES);
                setOpen(false);
                onCreated(channel.id);
              },
            });
          }}
        >
          <FormField
            label="New channel name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <RolePicker value={audience} onChange={setAudience} />
          <ErrorAlert error={create.error} />
          <div>
            <Button
              type="submit"
              disabled={!name.trim() || audience.length === 0 || create.isPending}
            >
              Add channel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
