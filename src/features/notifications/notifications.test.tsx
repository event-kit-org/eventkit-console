import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '@/api/client';
import { asRole, capture, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { API, event, server } from '@/test/server';
import { enablePush, pushSupported } from './push';

const channel = (over: Partial<Schemas['Channel']> = {}): Schemas['Channel'] => ({
  id: 'ch1',
  name: 'Announcements',
  audience: ['participant', 'volunteer', 'judge', 'admin'],
  canSend: true,
  createdAt: event.createdAt,
  ...over,
});
const note: Schemas['Notification'] = {
  id: 'n1',
  channel: { id: 'ch1', name: 'Announcements' },
  sender: { id: 'u', name: 'Asha' },
  title: 'Lunch is served',
  body: 'Hall B',
  priority: 'urgent',
  sentAt: '2026-10-31T07:00:00.000Z',
};
function use(channels: Schemas['Channel'][], feed: Schemas['Notification'][], push = false) {
  server.use(
    http.get(`${E}/channels`, () => HttpResponse.json(channels)),
    http.get(`${E}/notifications`, ({ request }) => {
      const id = new URL(request.url).searchParams.get('channelId');
      return HttpResponse.json(id ? feed.filter((n) => n.channel.id === id) : feed);
    }),
    http.get(`${API}/v1/push/config`, () =>
      HttpResponse.json({ enabled: push, publicKey: push ? 'AQAB' : null }),
    ),
  );
}
const go = () => renderApp(`/events/${event.id}/notifications`, { token: 'good-token' });
const seenKey = `console.notif.lastSeen.${event.id}`;
const judges = channel({ id: 'ch2', name: 'Judges', audience: ['judge'], canSend: false });
const judgeNote: Schemas['Notification'] = {
  ...note,
  id: 'n2',
  channel: { id: 'ch2', name: 'Judges' },
  title: 'Scoring opens',
  priority: 'normal',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('notifications', () => {
  it('reads the open channel, with urgent ones marked', async () => {
    asRole('admin');
    use([channel({ canSend: false })], [note]);
    go();
    expect(await screen.findByText('Lunch is served')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Announcements', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('31 Oct 2026, 12:30 pm IST')).toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText('Asha')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Send a notification' })).not.toBeInTheDocument();
  });

  it('lists channels with their audience and switches between them', async () => {
    asRole('admin');
    use([channel({ canSend: false }), judges], [note, judgeNote]);
    go();
    expect(await screen.findByText('Lunch is served')).toBeInTheDocument();
    const list = screen.getByRole('complementary', { name: 'Channels' });
    expect(within(list).getByText('Everyone')).toBeInTheDocument();
    expect(within(list).getByText('Judges', { selector: 'span.truncate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Announcements/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: /Judges/ }));
    expect(await screen.findByText('Scoring opens')).toBeInTheDocument();
    expect(screen.queryByText('Lunch is served')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Judges/ })).toHaveAttribute('aria-current', 'true');
  });

  it('says so when a channel is empty and when there are no channels', async () => {
    asRole('admin');
    use([channel({ canSend: false })], []);
    const first = go();
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
    first.unmount();
    use([], []);
    go();
    expect(await screen.findByText('No channels yet.')).toBeInTheDocument();
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
  });

  it('shows placeholders while channels and messages load', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/channels`, async () => {
        await delay(50);
        return HttpResponse.json([channel({ canSend: false })]);
      }),
      http.get(`${E}/notifications`, async () => {
        await delay(100);
        return HttpResponse.json([note]);
      }),
      http.get(`${API}/v1/push/config`, () => HttpResponse.json({ enabled: false })),
    );
    go();
    expect((await screen.findAllByText('Loading…')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Lunch is served')).toBeInTheDocument();
  });

  it('marks a channel unread until it is opened, and remembers that', async () => {
    asRole('admin');
    localStorage.setItem(seenKey, JSON.stringify({ ch2: '2026-10-31T06:00:00.000Z' }));
    use([channel({ canSend: false }), judges], [note, judgeNote]);
    go();
    const judgesButton = await screen.findByRole('button', { name: /Judges/ });
    expect(within(judgesButton).getByText('Unread')).toBeInTheDocument();
    // The channel on screen is already read.
    expect(
      within(screen.getByRole('button', { name: /Announcements/ })).queryByText('Unread'),
    ).not.toBeInTheDocument();
    await userEvent.click(judgesButton);
    expect(await screen.findByText('Scoring opens')).toBeInTheDocument();
    expect(within(judgesButton).queryByText('Unread')).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(seenKey)!) as Record<string, string>;
    expect(Object.keys(stored).sort()).toEqual(['ch1', 'ch2']);
    expect(stored.ch2! >= '2026-10-31T07:00:00.000Z').toBe(true);
    // Back on the first channel, the second stays read.
    await userEvent.click(screen.getByRole('button', { name: /Announcements/ }));
    expect(within(judgesButton).queryByText('Unread')).not.toBeInTheDocument();
  });

  it('counts a channel with no record yet as unread, and one with only old messages as read', async () => {
    asRole('admin');
    localStorage.setItem(seenKey, JSON.stringify({ ch2: '2099-01-01T00:00:00.000Z' }));
    use(
      [channel({ canSend: false }), judges, channel({ id: 'ch3', name: 'Food', canSend: false })],
      [note, judgeNote, { ...note, id: 'n3', channel: { id: 'ch3', name: 'Food' } }],
    );
    go();
    expect(
      within(await screen.findByRole('button', { name: /Food/ })).getByText('Unread'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('button', { name: /Judges/ })).queryByText('Unread'),
    ).not.toBeInTheDocument();
  });

  it('works when the browser will not store anything', async () => {
    asRole('admin');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    use([channel({ canSend: false })], [note]);
    go();
    expect(await screen.findByText('Lunch is served')).toBeInTheDocument();
  });

  it('ignores a stored record it cannot read', async () => {
    asRole('admin');
    localStorage.setItem(seenKey, 'null');
    use([channel({ canSend: false }), judges], [note, judgeNote]);
    const first = go();
    expect(
      within(await screen.findByRole('button', { name: /Judges/ })).getByText('Unread'),
    ).toBeInTheDocument();
    first.unmount();
    localStorage.setItem(seenKey, '{oops');
    go();
    expect(
      within(await screen.findByRole('button', { name: /Judges/ })).getByText('Unread'),
    ).toBeInTheDocument();
  });

  it('staff send to a channel they can use, urgently if needed', async () => {
    asRole('admin');
    use([channel(), judges], []);
    const sent = capture(
      'post',
      `${E}/channels/ch1/notifications`,
      { notification: note, pushed: 4 },
      201,
    );
    go();
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Title'), 'Lunch');
    await userEvent.type(screen.getByLabelText('Message'), 'Now');
    await userEvent.click(screen.getByLabelText('Urgent: also push to devices'));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(sent[0]?.body).toEqual({ title: 'Lunch', body: 'Now', priority: 'urgent' }),
    );
    expect(await screen.findByText('Sent, pushed to 4 devices.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    // Channels they cannot send to have no composer.
    await userEvent.click(screen.getByRole('button', { name: /Judges/ }));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('sends a normal notification without the push count', async () => {
    asRole('admin');
    use([channel()], []);
    capture(
      'post',
      `${E}/channels/ch1/notifications`,
      { notification: { ...note, priority: 'normal' }, pushed: 0 },
      201,
    );
    go();
    await userEvent.type(await screen.findByLabelText('Title'), 'Hi');
    await userEvent.type(screen.getByLabelText('Message'), 'There');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Sent.')).toBeInTheDocument();
  });

  it('shows why a send failed', async () => {
    asRole('admin');
    use([channel()], []);
    server.use(
      http.post(`${E}/channels/ch1/notifications`, () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Not allowed.' } },
          { status: 403 },
        ),
      ),
    );
    go();
    await userEvent.type(await screen.findByLabelText('Title'), 'Hi');
    await userEvent.type(screen.getByLabelText('Message'), 'There');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Not allowed.')).toBeInTheDocument();
  });

  it('admins add channels for any roles from a dialog, and land on the new one', async () => {
    asRole('admin');
    use([], []);
    const created = capture(
      'post',
      `${E}/channels`,
      channel({ id: 'ch9', name: 'Volunteers', audience: ['volunteer'], canSend: false }),
      201,
    );
    go();
    await userEvent.click(await screen.findByRole('button', { name: 'Add channel' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Who it is for')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('New channel name'), 'Volunteers');
    await userEvent.click(within(dialog).getByLabelText('Participants'));
    await userEvent.click(within(dialog).getByLabelText('Judges'));
    await userEvent.click(within(dialog).getByLabelText('Admins'));
    use([channel({ id: 'ch9', name: 'Volunteers', audience: ['volunteer'], canSend: false })], []);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add channel' }));
    await waitFor(() =>
      expect(created[0]?.body).toEqual({ name: 'Volunteers', audience: ['volunteer'] }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      await screen.findByRole('heading', { name: 'Volunteers', level: 2 }),
    ).toBeInTheDocument();
  });

  it('keeps Add channel disabled until there is a name and a role, and shows errors', async () => {
    asRole('admin');
    use([], []);
    server.use(
      http.post(`${E}/channels`, () =>
        HttpResponse.json({ error: { code: 'CONFLICT', message: 'Name taken.' } }, { status: 409 }),
      ),
    );
    go();
    await userEvent.click(await screen.findByRole('button', { name: 'Add channel' }));
    const dialog = await screen.findByRole('dialog');
    const add = within(dialog).getByRole('button', { name: 'Add channel' });
    expect(add).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('New channel name'), 'Dup');
    expect(add).toBeEnabled();
    for (const r of ['Participants', 'Volunteers', 'Judges', 'Admins']) {
      await userEvent.click(within(dialog).getByLabelText(r));
    }
    expect(add).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText('Judges'));
    await userEvent.click(add);
    expect(await within(dialog).findByText('Name taken.')).toBeInTheDocument();
  });

  it('does not offer new channels to reviewers', async () => {
    asRole('reviewer');
    use([channel({ canSend: false })], [note]);
    go();
    expect(await screen.findByText('Lunch is served')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add channel' })).not.toBeInTheDocument();
  });

  it('offers urgent push on this device when it is configured', async () => {
    asRole('admin');
    use([], [], true);
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push.test/1', keys: { p256dh: 'p', auth: 'a' } }),
    });
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
    vi.stubGlobal('PushManager', function PushManager() {});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe } }),
      },
    });
    const saved = capture('put', `${API}/v1/push/subscriptions`);
    go();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on' }));
    await waitFor(() =>
      expect(saved[0]?.body).toEqual({
        endpoint: 'https://push.test/1',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    );
    expect(
      await screen.findByText('Urgent notifications will reach this device.'),
    ).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 0, 1]),
    });
  });
});

describe('enablePush', () => {
  it('refuses when notifications are blocked', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') });
    await expect(enablePush({} as never, 'AQAB')).rejects.toThrow('blocked');
  });

  it('knows when the browser cannot do push', () => {
    vi.stubGlobal('PushManager', undefined);
    expect(pushSupported()).toBe(false);
  });
});
