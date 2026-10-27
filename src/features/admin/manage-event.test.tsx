import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asRole, capture, confirmDialog, E, member, proof, registeredTeam } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { event, server } from '@/test/server';
import { teamsCsv } from './teams-csv';

afterEach(() => vi.useRealTimers());

const go = (sub: string) => renderApp(`/events/${event.id}${sub}`, { token: 'good-token' });

describe('deleting a team', () => {
  it('asks, deletes, and goes back to the teams list', async () => {
    asRole('admin');
    const t = registeredTeam();
    server.use(
      http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)),
      http.get(`${E}/teams`, () => HttpResponse.json([])),
    );
    const removed = capture('delete', `${E}/teams/${t.id}`);
    const { router } = go(`/teams/${t.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete team' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'deletes the team and its 2 members for good',
    );
    await confirmDialog('Delete team');
    await waitFor(() => expect(removed).toHaveLength(1));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/events/${event.id}/teams`));
  });
});

describe('manage event', () => {
  it('closes registration now while it is open', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-20T06:00:00.000Z'));
    asRole('admin');
    const save = capture('patch', E, { event, role: 'admin' });
    go('/settings');
    const card = (await screen.findByText('Manage event')).closest(
      '[data-slot="card"]',
    ) as HTMLElement;
    expect(within(card).getByText('open')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: /Close registration now/ }));
    await confirmDialog('Close registration');
    await waitFor(() => expect(save).toHaveLength(1));
    // Now: the clock keeps running in the test, so only the minute is fixed.
    expect(save[0]?.body).toEqual({
      registrationDeadline: expect.stringMatching(/^2026-10-20T06:00:/),
    });
  });

  it('says how to reopen once registration has closed', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-05T06:00:00.000Z'));
    asRole('admin');
    go('/settings');
    expect(await screen.findByText('closed')).toBeInTheDocument();
    expect(screen.getByText(/edit the deadline in Event details/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Close registration now/ }),
    ).not.toBeInTheDocument();
  });

  it('deletes the event only after its name is typed, then leaves for the events list', async () => {
    asRole('admin');
    const removed = capture('delete', E);
    const { router } = go('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete event' }));
    const dialog = await screen.findByRole('alertdialog');
    const submit = within(dialog).getByRole('button', { name: 'Delete event' });
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/to confirm/), 'PESOS X');
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/to confirm/), ' Silicon');
    await userEvent.click(submit);
    await waitFor(() => expect(removed[0]?.body).toEqual({ confirmName: event.name }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('teams CSV', () => {
  it('has a row per member with answers, keeps phone numbers and defuses formulas', () => {
    const fields = [
      { id: 'f1', scope: 'member', label: 'Department' },
      { id: 'f2', scope: 'team', label: 'Idea' },
    ] as Parameters<typeof teamsCsv>[1];
    const t = registeredTeam('registered', {
      name: 'Byte, "Club"',
      answers: { f2: '=HYPERLINK("x")' },
      members: [
        { ...member('r1', 'Asha', 'registered', true), answers: { f1: 'CSE' } },
        member('r2', 'Ravi'),
      ],
      payment: { ...registeredTeam().payment, proofs: [proof('approved')] },
    });
    const [header, first, second] = teamsCsv([t], fields).split('\r\n');
    expect(header).toBe(
      'Team,Participant ID,Name,Email,Phone,Leader,Status,Payment,Registered (IST),Idea,Department',
    );
    expect(first).toContain('"Byte, ""Club""",PX-0001,Asha,asha@example.com,+91 98450 00000,yes');
    expect(first).toContain(`"'=HYPERLINK(""x"")",CSE`);
    expect(second).toContain('approved');
    expect(second?.endsWith(',')).toBe(true);
  });
});
