import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { RolePicker } from '@/components/RolePicker';
import { audienceText } from '@/lib/audience';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { formatIST } from '@/lib/datetime';
import { enablePush, pushSupported } from './push';

/** The event's notification feed, sending (staff) and urgent push on this device. */
export function NotificationsPage() {
  const api = useApi();
  const { event, path } = useEventContext();
  const feed = useQuery({
    queryKey: ['event', event.id, 'notifications'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/notifications', path)),
    refetchInterval: 30_000,
  });
  const channels = useQuery({
    queryKey: ['event', event.id, 'channels'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/channels', path)),
  });
  const sendable = (channels.data ?? []).filter((c) => c.canSend);

  return (
    <div className="grid gap-4">
      <PushCard />
      {sendable.length > 0 && <SendForm channels={sendable} />}
      <Channels channels={channels.data ?? []} />
      <section className="grid gap-2" aria-label="Notifications">
        <ErrorAlert error={feed.error ?? channels.error} />
        {feed.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        )}
        {feed.data?.map((n) => (
          <Card key={n.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{n.title}</CardTitle>
                {n.priority === 'urgent' && <Badge className="bg-red-600 text-white">Urgent</Badge>}
              </div>
              <CardDescription>
                {n.channel.name} · {n.sender.name} · {formatIST(n.sentAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
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
    <Alert>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          {enable.isSuccess
            ? 'Urgent notifications will reach this device.'
            : 'Get urgent notifications on this device, even when the app is closed.'}
        </span>
        {!enable.isSuccess && (
          <Button size="sm" disabled={enable.isPending} onClick={() => enable.mutate(key)}>
            Turn on
          </Button>
        )}
      </div>
      <ErrorAlert error={enable.error} />
    </Alert>
  );
}

function SendForm({ channels }: { channels: Schemas['Channel'][] }) {
  const api = useApi();
  const { event } = useEventContext();
  const [channelId, setChannelId] = useState(channels[0]!.id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const send = useEventMutation(event.id, () =>
    unwrap(
      api.POST('/v1/events/{eventId}/channels/{channelId}/notifications', {
        params: { path: { eventId: event.id, channelId } },
        body: { title, body, priority: urgent ? 'urgent' : 'normal' },
      }),
    ),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a notification</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
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
          <div className="grid gap-2">
            <Label htmlFor="send-channel">Channel</Label>
            <Select
              id="send-channel"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({audienceText(c.audience)})
                </option>
              ))}
            </Select>
          </div>
          <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid gap-2">
            <Label htmlFor="send-body">Message</Label>
            <Textarea
              id="send-body"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            Urgent: also push to devices
          </label>
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
      </CardContent>
    </Card>
  );
}

function Channels({ channels }: { channels: Schemas['Channel'][] }) {
  const api = useApi();
  const { event, path } = useEventContext();
  const [name, setName] = useState('');
  const [audience, setAudience] = useState<Schemas['Role'][]>([
    'participant',
    'volunteer',
    'judge',
    'admin',
  ]);
  const create = useEventMutation(event.id, () =>
    unwrap(api.POST('/v1/events/{eventId}/channels', { ...path, body: { name, audience } })),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Channels</CardTitle>
        <CardDescription>
          Each channel reaches a set of roles. Volunteers can send only where volunteers are in the
          audience.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="grid gap-1 text-sm">
          {channels.map((c) => (
            <li key={c.id}>
              {c.name} <span className="text-muted-foreground">· {audienceText(c.audience)}</span>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-3 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(undefined, { onSuccess: () => setName('') });
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
              variant="outline"
              disabled={!name.trim() || audience.length === 0 || create.isPending}
            >
              Add channel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
