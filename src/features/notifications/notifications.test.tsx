import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
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
    http.get(`${E}/notifications`, () => HttpResponse.json(feed)),
    http.get(`${API}/v1/push/config`, () =>
      HttpResponse.json({ enabled: push, publicKey: push ? 'AQAB' : null }),
    ),
  );
}
const go = () => renderApp(`/events/${event.id}/notifications`, { token: 'good-token' });
afterEach(() => vi.unstubAllGlobals());

describe('notifications', () => {
  it('reads the feed, with urgent ones marked', async () => {
    asRole('admin');
    use([channel({ canSend: false })], [note]);
    go();
    expect(await screen.findByText('Lunch is served')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(
      screen.getByText(/Announcements · Asha · 31 Oct 2026, 12:30 pm IST/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Send a notification' })).not.toBeInTheDocument();
  });

  it('staff send to a channel they can use, urgently if needed', async () => {
    asRole('admin');
    use(
      [channel(), channel({ id: 'ch2', name: 'Judges', audience: ['judge'], canSend: false })],
      [],
    );
    const sent = capture(
      'post',
      `${E}/channels/ch1/notifications`,
      { notification: note, pushed: 4 },
      201,
    );
    go();
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Announcements (Everyone)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Judges/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Title'), 'Lunch');
    await userEvent.type(screen.getByLabelText('Message'), 'Now');
    await userEvent.click(screen.getByLabelText('Urgent: also push to devices'));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(sent[0]?.body).toEqual({ title: 'Lunch', body: 'Now', priority: 'urgent' }),
    );
    expect(await screen.findByText('Sent, pushed to 4 devices.')).toBeInTheDocument();
  });

  it('admins add channels for any roles', async () => {
    asRole('admin');
    use([], []);
    const created = capture('post', `${E}/channels`, channel(), 201);
    go();
    await userEvent.type(await screen.findByLabelText('New channel name'), 'Volunteers');
    await userEvent.click(screen.getByLabelText('Participants'));
    await userEvent.click(screen.getByLabelText('Judges'));
    await userEvent.click(screen.getByLabelText('Admins'));
    await userEvent.click(screen.getByRole('button', { name: 'Add channel' }));
    await waitFor(() =>
      expect(created[0]?.body).toEqual({ name: 'Volunteers', audience: ['volunteer'] }),
    );
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
