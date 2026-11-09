import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asRole, capture, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { event, server } from '@/test/server';

const go = (sub: string) => renderApp(`/events/${event.id}${sub}`, { token: 'good-token' });

const summary = (over: object = {}) => ({
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Byte Club',
  leader: { registrationId: 'r1', name: 'Asha', email: 'asha@example.com', phone: null },
  status: 'confirmed',
  memberCount: 3,
  attendingCount: 0,
  releasedStatus: 'confirmed',
  pendingRelease: false,
  belowMinimum: false,
  latestProofStatus: null,
  createdAt: event.createdAt,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('staged release', () => {
  it('confirms before turning it off, and turns it on without asking', async () => {
    asRole('admin', { stagedRelease: true });
    const save = capture('patch', E, { event, role: 'admin' });
    go('/settings');
    const toggle = await screen.findByRole('switch', {
      name: 'Hold decisions until I release them',
    });
    await userEvent.click(toggle);
    await userEvent.click(await screen.findByRole('button', { name: 'Release all and turn off' }));
    await waitFor(() => expect(save[0]?.body).toEqual({ stagedRelease: false }));
  });

  it('releases selected teams, or everything waiting for a stage', async () => {
    asRole('admin', { stagedRelease: true });
    server.use(
      http.get(`${E}/teams`, () =>
        HttpResponse.json([
          summary({
            id: 't1',
            name: 'Waiting',
            releasedStatus: 'registered',
            pendingRelease: true,
          }),
          summary({ id: 't2', name: 'Shown' }),
        ]),
      ),
    );
    const release = capture('post', `${E}/teams/release`, { released: 1 });
    go('/teams');
    expect(
      await screen.findByText('1 team hasn’t been shown their result yet.'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /Waiting/ })).getByText('not released'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Select Shown for release' })).toBeNull();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Waiting for release' }));
    await userEvent.click(screen.getByRole('button', { name: 'Release selected (1)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Release' }));
    await waitFor(() => expect(release[0]?.body).toEqual({ stage: 'all', teamIds: ['t1'] }));

    await userEvent.click(screen.getByRole('button', { name: /Release all waiting/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Confirmations only' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Release' }));
    await waitFor(() => expect(release[1]?.body).toEqual({ stage: 'confirmed' }));
  });

  it('hides the release controls when staged release was never used', async () => {
    asRole('admin');
    server.use(http.get(`${E}/teams`, () => HttpResponse.json([summary()])));
    go('/teams');
    await screen.findByText('Byte Club');
    expect(screen.queryByRole('button', { name: /Release selected/ })).toBeNull();
  });
});

describe('overview', () => {
  it("counts people who RSVP'd", async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/teams`, () =>
        HttpResponse.json([
          summary({ attendingCount: 2 }),
          summary({ id: 't2', attendingCount: 1 }),
        ]),
      ),
      http.get(`${E}/payment-proofs`, () => HttpResponse.json([])),
    );
    go('');
    const tile = (await screen.findByText("Attending (RSVP'd)")).closest('a')!;
    expect(tile).toHaveTextContent('3 / 6');
    expect(tile).toHaveTextContent("50% of confirmed people have RSVP'd");
  });
});

describe('exit reasons (on Checkpoints)', () => {
  it('edits the list and saves it', async () => {
    asRole('admin', { exitReasons: ['Bathroom', 'Emergency'] });
    server.use(http.get(`${E}/checkpoints`, () => HttpResponse.json([])));
    const save = capture('patch', E, { event, role: 'admin' });
    go('/checkpoints');
    const table = await screen.findByRole('table', { name: 'Exit reasons' });
    expect(within(table).getByText('Emergency')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.type(await screen.findByLabelText('New reason'), 'Phone call{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Emergency' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save reasons' }));
    await waitFor(() => expect(save[0]?.body).toEqual({ exitReasons: ['Bathroom', 'Phone call'] }));
  });

  it('refuses duplicates', async () => {
    asRole('admin', { exitReasons: ['Bathroom'] });
    server.use(http.get(`${E}/checkpoints`, () => HttpResponse.json([])));
    go('/checkpoints');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.type(await screen.findByLabelText('New reason'), 'bathroom{Enter}');
    expect(screen.getByText('Each reason must be different.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save reasons' })).toBeDisabled();
  });
});

describe('People: outside now', () => {
  it('lists who is out, with a phone when there is one and how long ago they left', async () => {
    asRole('admin');
    const ago = (min: number) => new Date(Date.now() - min * 60_000 - 5_000).toISOString();
    server.use(
      http.get(`${E}/scans/outside`, () =>
        HttpResponse.json([
          {
            registrationId: 'r1',
            participantCode: 'PX-a1',
            name: 'Asha',
            teamName: 'Byte Club',
            phone: '+91 98450 00000',
            outsideSince: ago(12),
            reason: 'Bathroom',
            checkpointName: 'Gate out',
          },
          {
            registrationId: 'r2',
            participantCode: 'PX-b2',
            name: 'Ravi',
            teamName: 'Byte Club',
            phone: null,
            outsideSince: ago(90),
            reason: 'Medical',
            checkpointName: null,
          },
        ]),
      ),
    );
    go('/attendees');
    const table = await screen.findByRole('table', { name: 'People outside' });
    const asha = within(table).getByRole('row', { name: /Asha/ });
    // Small screens fold the ID, team, phone and reason under the name; wide ones have columns.
    for (const text of ['PX-a1', 'Asha', 'Byte Club', '+91 98450 00000', 'Bathroom']) {
      expect(asha).toHaveTextContent(text);
    }
    expect(asha).toHaveTextContent('via Gate out');
    expect(asha).toHaveTextContent(/12 min ago$/);
    const ravi = within(table).getByRole('row', { name: /Ravi/ });
    expect(ravi).toHaveTextContent('—');
    expect(ravi).toHaveTextContent('1 h 30 min ago');
    expect(screen.getByText('2 outside')).toBeInTheDocument();
  });

  it('says when nobody is out', async () => {
    asRole('admin');
    server.use(http.get(`${E}/scans/outside`, () => HttpResponse.json([])));
    go('/attendees');
    expect(await screen.findByText('Everyone who left has come back.')).toBeInTheDocument();
  });
});

describe('editing a checkpoint', () => {
  it('changes its hours and repeat scans', async () => {
    asRole('admin');
    const cp = (over: object) => ({
      opensAt: null,
      closesAt: null,
      allowRepeat: false,
      poll: null,
      createdAt: event.createdAt,
      ...over,
    });
    server.use(
      http.get(`${E}/checkpoints`, () =>
        HttpResponse.json([
          cp({ id: 'c-gate', name: 'Entry', type: 'entry' }),
          cp({ id: 'c-out', name: 'Exit', type: 'gate' }),
        ]),
      ),
    );
    const save = capture(
      'patch',
      `${E}/checkpoints/c-out`,
      cp({ id: 'c-out', name: 'Exit', type: 'gate' }),
    );
    go('/checkpoints');
    await userEvent.click(await screen.findByRole('button', { name: 'More for Exit' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Exit' });
    await userEvent.type(
      within(dialog).getByLabelText('Opens (IST, optional)'),
      '2026-11-07T08:00',
    );
    await userEvent.type(
      within(dialog).getByLabelText('Closes (IST, optional)'),
      '2026-11-07T07:00',
    );
    expect(within(dialog).getByText('Must close after it opens.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText('Closes (IST, optional)'));
    await userEvent.type(
      within(dialog).getByLabelText('Closes (IST, optional)'),
      '2026-11-07T19:00',
    );
    await userEvent.click(within(dialog).getByLabelText('Allow repeat scans'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(save[0]?.body).toEqual({
        name: 'Exit',
        opensAt: '2026-11-07T02:30:00.000Z',
        closesAt: '2026-11-07T13:30:00.000Z',
        allowRepeat: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
