import { useMutation, useQuery } from '@tanstack/react-query';
import { BellOff, BellRing, Megaphone } from 'lucide-react';
import { useId, useState } from 'react';
import { type Schemas, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { RolePicker } from '@/components/RolePicker';
import { audienceText } from '@/lib/audience';
import { EmptyState } from '@/components/PageState';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
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
      <PageHeader
        title="Notifications"
        description="Announcements to participants and staff, by channel. Urgent ones also push to devices."
      />
      <PushCard />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="grid gap-3" aria-label="Notifications">
          {sendable.length > 0 && <SendForm channels={sendable} />}
          <ErrorAlert error={feed.error ?? channels.error} />
          {feed.data?.length === 0 && <EmptyState icon={BellOff} title="No notifications yet." />}
          {feed.data?.map((n) => (
            <Card key={n.id} size="sm">
              <CardHeader>
                <CardTitle as="h3">{n.title}</CardTitle>
                <CardDescription>
                  {n.channel.name} · {n.sender.name} · {formatIST(n.sentAt)}
                </CardDescription>
                {n.priority === 'urgent' && (
                  <CardAction>
                    <Badge variant="destructive">Urgent</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>
        <Channels channels={channels.data ?? []} />
      </div>
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

function SendForm({ channels }: { channels: Schemas['Channel'][] }) {
  const api = useApi();
  const { event } = useEventContext();
  const [channelId, setChannelId] = useState(channels[0]!.id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const urgentId = useId();
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
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4" aria-hidden /> Send a notification
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
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
          <Field>
            <FieldLabel htmlFor="send-channel">Channel</FieldLabel>
            <NativeSelect
              id="send-channel"
              className="w-full"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            >
              {channels.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name} ({audienceText(c.audience)})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Field>
            <FieldLabel htmlFor="send-body">Message</FieldLabel>
            <Textarea
              id="send-body"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id={urgentId}
              checked={urgent}
              onCheckedChange={(c) => setUrgent(c === true)}
            />
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
      <CardContent className="grid gap-4">
        <ul className="grid gap-2 text-sm">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{c.name}</span>
              <Badge variant="secondary">{audienceText(c.audience)}</Badge>
            </li>
          ))}
        </ul>
        <Separator />
        <form
          className="grid gap-4"
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
