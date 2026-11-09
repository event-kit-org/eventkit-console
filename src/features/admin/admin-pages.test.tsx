import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  asRole,
  capture,
  confirmDialog,
  E,
  member,
  proof,
  registeredTeam,
  team,
} from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { apiError, BUCKET, event, server } from '@/test/server';

const go = (sub: string) => renderApp(`/events/${event.id}${sub}`, { token: 'good-token' });

const summary = (over: object = {}) => ({
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Byte Club',
  leader: { registrationId: 'r1', name: 'Asha', email: 'asha@example.com', phone: '+91 1' },
  status: 'confirmed',
  memberCount: 2,
  members: [
    { registrationId: 'r1', name: 'Asha', email: 'asha@example.com', participantCode: 'PX-0001' },
    { registrationId: 'r2', name: 'Ravi', email: 'ravi@example.com', participantCode: 'PX-0002' },
  ],
  attendingCount: 0,
  releasedStatus: 'confirmed',
  pendingRelease: false,
  belowMinimum: false,
  latestProofStatus: 'approved',
  paidAmount: null,
  paidMembers: null,
  createdAt: event.createdAt,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('admin overview', () => {
  it('counts teams and places, and flags problems', async () => {
    asRole('admin', {}, { scanning: true });
    server.use(
      http.get(`${E}/teams`, () =>
        HttpResponse.json([
          summary(),
          summary({ id: 't2', name: 'Gone', status: 'cancelled', memberCount: 1 }),
          summary({ id: 't3', name: 'Small Fry', status: 'registered', belowMinimum: true }),
        ]),
      ),
      http.get(`${E}/payment-proofs`, () => HttpResponse.json([{}, {}])),
    );
    go('');
    expect(await screen.findByText('2 / 150')).toBeInTheDocument();
    expect(screen.getByText('Registration is switched off', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/1 registered team is below the minimum size/)).toHaveTextContent(
      'Small Fry',
    );
    const tiles = screen.getAllByText(/^[0-9]+$/).map((n) => n.textContent);
    expect(tiles).toEqual(['2', '2']);
  });

  it('shows how many teams registered today, by the IST date', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    // 20 Oct, 23:00 UTC is already 21 Oct in IST.
    vi.setSystemTime(new Date('2026-10-20T23:00:00.000Z'));
    asRole('admin');
    const day = (date: string, teams: number) => ({
      date,
      teams,
      people: teams * 2,
      totalTeams: teams,
      totalPeople: teams * 2,
    });
    server.use(
      http.get(`${E}/teams`, () => HttpResponse.json([summary()])),
      http.get(`${E}/insights/registrations`, () =>
        HttpResponse.json([day('2026-10-20', 5), day('2026-10-21', 3)]),
      ),
    );
    go('');
    const tile = (await screen.findByText('Teams registered')).closest('a')!;
    expect(await within(tile).findByText('+3 today')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('staff are sent to the portal', async () => {
    asRole('volunteer');
    go('/teams');
    expect(await screen.findByText(/sign in on the event's own portal/)).toBeInTheDocument();
  });
});

describe('paid amounts', () => {
  const teams = () =>
    HttpResponse.json([
      summary({ paidAmount: 60000, paidMembers: 2 }),
      summary({ id: 't2', name: 'Small Fry', paidAmount: 60000, paidMembers: 1 }),
      summary({ id: 't3', name: 'Not Yet', latestProofStatus: 'pending' }),
    ]);

  it('totals what approved teams paid on the overview', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/teams`, teams),
      http.get(`${E}/payment-proofs`, () => HttpResponse.json([])),
    );
    go('');
    const collected = (await screen.findByText('Collected')).closest('a')!;
    expect(collected).toHaveTextContent('₹1,200');
    expect(collected).toHaveTextContent('from 2 approved teams');
    expect(screen.queryByText(/refund/i)).not.toBeInTheDocument();
  });

  it('adds a paid column to the teams list', async () => {
    asRole('admin');
    server.use(http.get(`${E}/teams`, teams));
    go('/teams');
    const rows = await screen.findAllByRole('row');
    expect(rows[0]).toHaveTextContent('Paid');
    expect(rows[1]).toHaveTextContent('₹600');
    expect(rows[3]).toHaveTextContent('—');
  });

  it('shows no collected tile before anyone has paid', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/teams`, () => HttpResponse.json([summary()])),
      http.get(`${E}/payment-proofs`, () => HttpResponse.json([])),
    );
    go('');
    await screen.findByText('Receipts to review');
    expect(screen.queryByText('Collected')).not.toBeInTheDocument();
  });

  it('shows what the team paid on the team page', async () => {
    asRole('admin');
    const t = registeredTeam('confirmed');
    t.payment = { ...t.payment, paidAmount: 60000 };
    t.payment.proofs = [
      {
        id: 'p1',
        teamId: t.id,
        status: 'approved',
        amount: 25000,
        currency: 'INR',
        memberCount: 2,
        registrationIds: ['r1', 'r2'],
        paidAmount: 60000,
        uploadedAt: event.createdAt,
        verifiedAt: event.createdAt,
        rejectionNote: null,
      },
    ];
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    go(`/teams/${t.id}`);
    expect(await screen.findByText('Paid ₹600')).toBeInTheDocument();
    expect(screen.getByText('(received ₹600)')).toBeInTheDocument();
  });
});

describe('teams', () => {
  it('lists and filters teams, linking to each', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/teams`, () =>
        HttpResponse.json([
          summary(),
          summary({ id: 't2', name: 'Waiting One', status: 'registered', latestProofStatus: null }),
        ]),
      ),
    );
    go('/teams');
    expect(await screen.findByRole('link', { name: 'Byte Club' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review Byte Club' })).toHaveAttribute(
      'href',
      `/events/${event.id}/teams/44444444-4444-4444-8444-444444444444`,
    );
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'registered');
    expect(screen.queryByRole('link', { name: 'Byte Club' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Waiting One' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'flagged');
    expect(screen.getByText('No teams here yet.')).toBeInTheDocument();
  });

  it('sorts by a column, counts what the filter leaves, and shows receipt states as badges', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/teams`, () =>
        HttpResponse.json([
          summary({ id: 't1', name: 'Alpha', memberCount: 2, latestProofStatus: 'approved' }),
          summary({ id: 't2', name: 'Charlie', memberCount: 4, latestProofStatus: 'pending' }),
          summary({ id: 't3', name: 'Bravo', memberCount: 3, status: 'registered' }),
        ]),
      ),
    );
    const { router } = go('/teams');
    expect(await screen.findByText('3 teams')).toBeInTheDocument();
    const names = () =>
      screen.getAllByRole('link', { name: /^(Alpha|Bravo|Charlie)$/ }).map((a) => a.textContent);
    await userEvent.click(screen.getByRole('button', { name: 'Members' }));
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(router.state.location.search).toBe('?sort=members');
    await userEvent.click(screen.getByRole('button', { name: 'Members' }));
    expect(names()).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(screen.getByRole('columnheader', { name: /Members/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    // Receipt states read as badges, the same as on the team page.
    const charlie = screen.getByRole('link', { name: 'Charlie' }).closest('tr')!;
    expect(within(charlie).getByText('pending')).toHaveAttribute('data-slot', 'badge');
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'registered');
    expect(screen.getByText('1 of 3 teams')).toBeInTheDocument();
  });

  it('keeps the search and filter in the address, and names the team in the breadcrumb', async () => {
    asRole('admin');
    const t = registeredTeam('registered');
    server.use(
      http.get(`${E}/teams`, () =>
        HttpResponse.json([
          summary(),
          summary({ id: t.id, name: 'Waiting One', status: 'registered', latestProofStatus: null }),
        ]),
      ),
      http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)),
    );
    const { router } = go('/teams?status=registered');
    expect(await screen.findByRole('link', { name: 'Waiting One' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Byte Club' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox'), 'x');
    await waitFor(() => expect(router.state.location.search).toBe('?status=registered&q=x'));
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.click(screen.getByRole('link', { name: 'Review Waiting One' }));
    const crumbs = await screen.findByRole('navigation', { name: 'breadcrumb' });
    await waitFor(() => expect(within(crumbs).getByText(t.name)).toBeInTheDocument());
    expect(within(crumbs).getByRole('link', { name: 'Teams' })).toBeInTheDocument();
    expect(document.title).toBe(`${t.name} · Teams · ${event.name} · eventKit`);
    await userEvent.click(screen.getByRole('link', { name: 'All teams' }));
    await waitFor(() => expect(router.state.location.search).toBe('?status=registered'));
    expect(screen.getByLabelText('Show')).toHaveValue('registered');
  });

  it('confirms a team (no payment) and cancels or restores registrations', async () => {
    asRole('admin', { paymentMode: 'none' });
    const t = registeredTeam('registered', {
      members: [member('r1', 'Asha', 'registered', true), member('r2', 'Ravi', 'cancelled')],
      belowMinimum: true,
    });
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    const confirm = capture('post', `${E}/teams/${t.id}/confirm`, t);
    const cancel = capture('post', `${E}/registrations/r1/cancel`);
    const restore = capture('post', `${E}/registrations/r2/restore`);
    go(`/teams/${t.id}`);
    expect(await screen.findByText(/below the minimum of 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm team' }));
    await waitFor(() => expect(confirm).toHaveLength(1));
    // Cancelling is for the whole team, next to Delete team; members have no Cancel.
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel registration' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('The whole team is cancelled');
    await confirmDialog('Cancel registration');
    await waitFor(() => expect(cancel).toHaveLength(1));
    // Ravi was cancelled on his own, so he comes back on his own.
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(restore).toHaveLength(1));
  });

  it('restores a cancelled team from the top, not member by member', async () => {
    asRole('admin');
    const t = registeredTeam('cancelled');
    server.use(
      http.get(`${E}/teams/${t.id}`, () => HttpResponse.json({ ...t, status: 'cancelled' })),
    );
    const restore = capture('post', `${E}/registrations/r1/restore`);
    go(`/teams/${t.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Restore registration' }));
    await waitFor(() => expect(restore).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel registration' })).not.toBeInTheDocument();
  });

  it('shortlists in pay-after-shortlist events and shows payments and errors', async () => {
    asRole('admin', { paymentMode: 'after_shortlist' });
    const t = registeredTeam('registered', {
      payment: {
        mode: 'after_shortlist',
        amountDue: 100000,
        paidAmount: null,
        currency: 'INR',
        deadline: null,
        proofs: [proof('rejected', 'Blurry')],
        unpaid: [],
      },
    });
    server.use(
      http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)),
      http.post(`${E}/teams/${t.id}/shortlist`, () => apiError(409, 'INVALID_TRANSITION', 'Nope.')),
    );
    go(`/teams/${t.id}`);
    expect(await screen.findByText(/Blurry/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Shortlist team' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });

  it('shows members with their codes, reissues links and QR codes, attaches receipts', async () => {
    asRole('admin');
    const t = team({
      members: [
        { ...member('r1', 'Asha', 'registered', true), linkLastUsedAt: event.createdAt },
        member('r2', 'Ravi'),
      ],
    });
    server.use(
      http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)),
      http.post(`${E}/uploads`, () =>
        HttpResponse.json({
          key: 'events/e/receipts/t/k.png',
          url: `${BUCKET}/put`,
          method: 'PUT',
          headers: { 'content-type': 'image/png' },
          expiresAt: event.createdAt,
        }),
      ),
      http.put(`${BUCKET}/put`, () => new HttpResponse(null)),
    );
    const reissue = capture('post', `${E}/registrations/r2/reissue-link`, {
      token: 'ek_new',
      url: 'https://portal.test/me/ek_new',
    });
    const rotate = capture('post', `${E}/registrations/r1/rotate-qr`, { qrToken: 'q' });
    const attach = capture('post', `${E}/teams/${t.id}/payment-proofs`, proof('pending'), 201);
    const { unmount } = go(`/teams/${t.id}`);
    expect(await screen.findByText('PX-0001')).toBeInTheDocument();
    expect(screen.getByText(/link last opened/)).toBeInTheDocument();
    expect(screen.getByText(/link never opened/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'New link' })[1]!);
    await confirmDialog('New link');
    expect(await screen.findByText('https://portal.test/me/ek_new')).toBeInTheDocument();
    expect(reissue).toHaveLength(1);
    // Without mailing, nothing can be emailed.
    expect(reissue[0]!.body).toEqual({ emailLeader: false });
    await userEvent.click(screen.getAllByRole('button', { name: 'New QR' })[0]!);
    await confirmDialog('New QR');
    await waitFor(() => expect(rotate).toHaveLength(1));
    await userEvent.upload(
      screen.getByLabelText('Receipt file'),
      new File(['x'], 'r.png', { type: 'image/png' }),
    );
    await waitFor(() =>
      expect(attach[0]?.body).toEqual({ receiptKey: 'events/e/receipts/t/k.png' }),
    );
    unmount();
    server.use(
      http.get(`${E}/teams/${t.id}`, () => apiError(404, 'TEAM_NOT_FOUND', 'Team not found.')),
    );
    go(`/teams/${t.id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Team not found.');
  });
});

describe('searching teams', () => {
  it('finds a team by its name or any member’s name, email or ID', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/teams`, () =>
        HttpResponse.json([
          summary(),
          summary({
            id: 't2',
            name: 'Quantum Quokkas',
            members: [
              {
                registrationId: 'r9',
                name: 'Zoë',
                email: 'zoe@x.test',
                participantCode: 'PX-0099',
              },
            ],
          }),
        ]),
      ),
    );
    go('/teams');
    const box = await screen.findByRole('searchbox', { name: 'Search teams and members' });
    await userEvent.type(box, 'zoe');
    expect(screen.getByRole('link', { name: 'Quantum Quokkas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Byte Club' })).not.toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, 'px-0002');
    expect(screen.getByRole('link', { name: 'Byte Club' })).toBeInTheDocument();
    await userEvent.type(box, 'nobody');
    expect(screen.getByText('No team or member matches.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getAllByRole('link', { name: /^(Byte Club|Quantum Quokkas)$/ })).toHaveLength(2);
  });
});

describe('editing a team', () => {
  it('changes the name and the leader', async () => {
    asRole('admin');
    const t = registeredTeam('confirmed');
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    const saved = capture('patch', `${E}/teams/${t.id}`, t);
    go(`/teams/${t.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit team' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.clear(dialog.getByLabelText('Team name'));
    await userEvent.type(dialog.getByLabelText('Team name'), 'Byte Club 2');
    await userEvent.click(dialog.getByRole('combobox', { name: 'Leader' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Ravi' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(saved[0]?.body).toEqual({ name: 'Byte Club 2', leaderRegistrationId: 'r2' }),
    );
  });

  it('shows a name another team uses', async () => {
    asRole('admin');
    const t = registeredTeam('confirmed');
    server.use(
      http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)),
      http.patch(`${E}/teams/${t.id}`, () =>
        apiError(409, 'TEAM_NAME_TAKEN', 'Another team already uses that name.'),
      ),
    );
    go(`/teams/${t.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit team' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Team name'), 'x');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Another team already uses that name.')).toBeInTheDocument();
  });
});

describe('sending a link again', () => {
  it('emails a member their current link, or the leader, and says where it went', async () => {
    asRole('admin', {}, { registration: true, mailing: true });
    const t = registeredTeam('confirmed');
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    const sent = capture('post', `${E}/registrations/r2/send-link`, {
      emailedTo: 'ravi@example.com',
    });
    go(`/teams/${t.id}`);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Send link' }))[1]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Email to Ravi' }));
    await waitFor(() => expect(sent[0]?.body).toEqual({ to: 'member' }));
    expect(
      await screen.findByText('Ravi’s link was emailed to ravi@example.com.'),
    ).toBeInTheDocument();
  });

  it('explains when a link is too old to send, or mail is off', async () => {
    asRole('admin', {}, { registration: true, mailing: true });
    const old = registeredTeam('confirmed');
    old.members[1] = { ...old.members[1]!, linkStored: false };
    server.use(http.get(`${E}/teams/${old.id}`, () => HttpResponse.json(old)));
    go(`/teams/${old.id}`);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Send link' }))[1]!);
    expect(await screen.findByText(/made before links were kept/)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});

describe('new personal links', () => {
  it('can email the new link to the team leader, and says so', async () => {
    asRole('admin', {}, { registration: true, mailing: true });
    const t = registeredTeam('confirmed');
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    const reissue = capture('post', `${E}/registrations/r2/reissue-link`, {
      registrationId: 'r2',
      token: 'ek_new',
      url: 'https://portal.test/me/ek_new',
      emailedTo: 'asha@example.com',
    });
    go(`/teams/${t.id}`);
    await userEvent.click((await screen.findAllByRole('button', { name: 'New link' }))[1]!);
    const dialog = within(await screen.findByRole('alertdialog'));
    expect(dialog.getByLabelText('Email it to the team leader to pass on')).toBeChecked();
    await userEvent.click(dialog.getByRole('button', { name: 'New link' }));
    await waitFor(() => expect(reissue[0]?.body).toEqual({ emailLeader: true }));
    expect(
      await screen.findByText(/Emailed to the team leader \(asha@example.com\) to pass on/),
    ).toBeInTheDocument();
  });
});

describe('payments', () => {
  const item = (status: 'pending' | 'approved' | 'rejected', ext = 'png') => ({
    ...proof(status, status === 'rejected' ? 'Wrong amount' : null),
    team: { id: 't', name: 'Byte Club' },
    members: [],
    uploadedBy: { id: 'u', name: 'Asha' },
    receiptUrl: `https://storage.test/events/e/receipts/t/r.${ext}?signed=1`,
  });

  it('approves a receipt', async () => {
    asRole('admin');
    server.use(http.get(`${E}/payment-proofs`, () => HttpResponse.json([item('pending')])));
    const approve = capture(
      'post',
      `${E}/payment-proofs/${proof('pending').id}/approve`,
      proof('approved'),
    );
    go('/payments');
    expect(await screen.findByRole('img', { name: 'Receipt from Byte Club' })).toHaveAttribute(
      'src',
      expect.stringContaining('signed=1'),
    );
    expect(screen.getByText(/₹1,000 for 2 people/)).toBeInTheDocument();
    // The receipt's team name opens the team.
    expect(screen.getByRole('link', { name: 'Byte Club' })).toHaveAttribute(
      'href',
      `/events/${event.id}/teams/t`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(approve).toHaveLength(0);
    const dialog = within(await screen.findByRole('alertdialog'));
    const received = dialog.getByLabelText('Amount received (₹)');
    expect(received).toHaveValue(null);
    expect(dialog.getByRole('button', { name: 'Approve' })).toBeDisabled();
    await userEvent.type(received, '800');
    await userEvent.click(dialog.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(approve).toHaveLength(1));
    expect(approve[0]!.body).toEqual({ paidAmount: 80000 });
  });

  it('rejects with a note', async () => {
    asRole('admin');
    server.use(http.get(`${E}/payment-proofs`, () => HttpResponse.json([item('pending', 'pdf')])));
    const reject = capture(
      'post',
      `${E}/payment-proofs/${proof('pending').id}/reject`,
      proof('rejected'),
    );
    go('/payments');
    expect(await screen.findByRole('link', { name: 'Open receipt (PDF)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const send = screen.getByRole('button', { name: 'Reject with note' });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason for rejecting'), 'Amount is wrong');
    await userEvent.click(send);
    await waitFor(() => expect(reject[0]?.body).toEqual({ note: 'Amount is wrong' }));
  });

  it('filters by status', async () => {
    asRole('admin');
    const seen: string[] = [];
    server.use(
      http.get(`${E}/payment-proofs`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status')!;
        seen.push(status);
        return HttpResponse.json(status === 'rejected' ? [item('rejected')] : []);
      }),
    );
    go('/payments');
    expect(await screen.findByText('Nothing here.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Rejected' }));
    expect(await screen.findByText('Rejected: Wrong amount')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(seen).toEqual(['pending', 'rejected']);
  });
});

describe('people', () => {
  const members = [
    {
      userId: '11111111-1111-4111-8111-111111111111',
      name: 'Asha',
      email: 'asha@example.com',
      phone: null,
      role: 'admin',
      isOwner: true,
      respondedAt: event.createdAt,
    },
    {
      userId: 'v1',
      name: 'Vik',
      email: 'vik@example.com',
      phone: '+91 90000',
      role: 'volunteer',
      isOwner: false,
      respondedAt: event.createdAt,
    },
  ];
  const reviewer = {
    userId: 'u3',
    name: 'Rhea',
    email: 'rhea@example.com',
    phone: null,
    role: 'reviewer',
    isOwner: false,
    respondedAt: event.createdAt,
  };

  it('changes roles and removes people, but not yourself', async () => {
    asRole('admin');
    server.use(http.get(`${E}/members`, () => HttpResponse.json(members)));
    const change = capture('patch', `${E}/members/v1`, { userId: 'v1', role: 'judge' });
    const remove = capture('delete', `${E}/members/v1`);
    go('/people');
    expect(await screen.findByText(/vik@example.com · \+91 90000/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Role of Vik'), 'judge');
    await waitFor(() => expect(change[0]?.body).toEqual({ role: 'judge' }));
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await confirmDialog('Remove');
    await waitFor(() => expect(remove).toHaveLength(1));
  });

  it('turns judging on for an admin', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/members`, () => HttpResponse.json([{ ...members[0], canJudge: false }])),
    );
    const judging = capture('put', `${E}/members/${members[0]!.userId}/judging`, {
      userId: members[0]!.userId,
      canJudge: true,
    });
    go('/people');
    await userEvent.click(await screen.findByRole('switch', { name: 'Judges' }));
    await waitFor(() => expect(judging[0]?.body).toEqual({ canJudge: true }));
  });

  it('shows the owner without controls, and refusals', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/members`, () => HttpResponse.json(members)),
      http.patch(`${E}/members/v1`, () =>
        apiError(404, 'MEMBER_NOT_FOUND', 'Not a member of this event.'),
      ),
    );
    go('/people');
    await userEvent.selectOptions(await screen.findByLabelText('Role of Vik'), 'judge');
    expect(await screen.findByRole('alert')).toHaveTextContent('Not a member');
    expect(screen.queryByLabelText('Role of Asha')).not.toBeInTheDocument();
  });

  it('lets the owner add organisers by email, change their role and remove them', async () => {
    asRole('admin');
    server.use(http.get(`${E}/members`, () => HttpResponse.json([...members, reviewer])));
    const add = capture('post', `${E}/members`, { ...reviewer, userId: 'u4' }, 201);
    const change = capture('patch', `${E}/members/u3`, { userId: 'u3', role: 'admin' });
    const remove = capture('delete', `${E}/members/u3`);
    go('/people');
    const organisers = within(
      (await screen.findByText('Organisers')).closest('[data-slot="card"]') as HTMLElement,
    );
    expect(organisers.getByText('Owner')).toBeInTheDocument();
    await userEvent.selectOptions(organisers.getByLabelText('Role of Rhea'), 'admin');
    await waitFor(() => expect(change[0]?.body).toEqual({ role: 'admin' }));
    await userEvent.type(organisers.getByLabelText('Their eventKit email'), 'new@example.com');
    await userEvent.selectOptions(organisers.getByLabelText('Role'), 'admin');
    await userEvent.click(organisers.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(add[0]?.body).toEqual({ email: 'new@example.com', role: 'admin' }));
    await userEvent.click(organisers.getByRole('button', { name: 'Remove' }));
    await confirmDialog('Remove');
    await waitFor(() => expect(remove).toHaveLength(1));
  });

  it("shows a co-admin the organisers without the owner's controls", async () => {
    asRole('admin', {}, undefined, false);
    server.use(http.get(`${E}/members`, () => HttpResponse.json([...members, reviewer])));
    go('/people');
    const organisers = within(
      (await screen.findByText('Organisers')).closest('[data-slot="card"]') as HTMLElement,
    );
    expect(organisers.getByText('Reviewer')).toBeInTheDocument();
    expect(organisers.queryByLabelText('Role of Rhea')).not.toBeInTheDocument();
    expect(organisers.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(organisers.queryByRole('form', { name: 'Add an organiser' })).not.toBeInTheDocument();
  });

  it('lets a co-admin leave from their own row, and never offers it to the owner', async () => {
    asRole('admin', {}, undefined, false);
    const me = { ...members[0]!, isOwner: false };
    const owner = { ...members[0]!, userId: 'owner-1', name: 'Olu', email: 'olu@example.com' };
    server.use(http.get(`${E}/members`, () => HttpResponse.json([owner, me])));
    const leave = capture('delete', `${E}/members/${me.userId}`, null, 204);
    const { router } = go('/people');
    const organisers = within(
      (await screen.findByText('Organisers')).closest('[data-slot="card"]') as HTMLElement,
    );
    expect(organisers.getAllByRole('button', { name: 'Leave' })).toHaveLength(1);
    await userEvent.click(organisers.getByRole('button', { name: 'Leave' }));
    await confirmDialog('Leave');
    await waitFor(() => expect(leave).toHaveLength(1));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it("doesn't offer the owner a way to leave", async () => {
    asRole('admin');
    server.use(http.get(`${E}/members`, () => HttpResponse.json(members)));
    go('/people');
    await screen.findByText('Organisers');
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Leave this event/ })).not.toBeInTheDocument();
  });
});

describe('reviewers', () => {
  it('see teams and payments only, and can shortlist but not delete or reissue', async () => {
    asRole('reviewer', { paymentMode: 'after_shortlist' });
    const t = registeredTeam('registered', {
      shortlistedBy: { userId: 'u3', name: 'Rhea', at: event.createdAt },
    });
    server.use(
      http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)),
      http.get(`${E}/fields`, () => HttpResponse.json([])),
    );
    const shortlist = capture('post', `${E}/teams/${t.id}/shortlist`, {
      ...t,
      status: 'shortlisted',
      shortlistedBy: { userId: 'u3', name: 'Rhea', at: event.createdAt },
    });
    go(`/teams/${t.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Shortlist team' }));
    await waitFor(() => expect(shortlist).toHaveLength(1));
    expect(await screen.findByText(/Shortlisted by Rhea/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete team/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New link/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Attach a receipt')).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Event sections' });
    await waitFor(() => expect(nav).toHaveTextContent('OverviewRegistrationTeamsPayments'));
    expect(nav).not.toHaveTextContent('Scanner');
    expect(nav).not.toHaveTextContent('Portal & settings');
  });

  it("can't open admin pages directly", async () => {
    asRole('reviewer');
    go('/settings');
    expect(
      await screen.findByText('This page is not available for your role.'),
    ).toBeInTheDocument();
  });
});

describe('invite links', () => {
  const link = (over: object = {}) => ({
    id: 'l1',
    kind: 'registration',
    role: 'participant',
    label: 'Instagram',
    token: 'tok123',
    url: 'https://portal.test/register/tok123',
    requiresPassword: false,
    createdAt: event.createdAt,
    expiresAt: null,
    revokedAt: null,
    ...over,
  });

  it('creates participant and staff links, copies and revokes them', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/invite-links`, () =>
        HttpResponse.json([
          link(),
          link({
            id: 'l2',
            kind: 'staff',
            role: 'judge',
            label: null,
            token: 't2',
            requiresPassword: true,
            expiresAt: '2026-10-31T03:30:00.000Z',
          }),
          link({ id: 'l3', revokedAt: event.createdAt }),
        ]),
      ),
    );
    const create = capture('post', `${E}/invite-links`, link(), 201);
    const revoke = capture('delete', `${E}/invite-links/l1`, link({ revokedAt: event.createdAt }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    go('/links');

    expect(await screen.findByText(/Expires 31 Oct 2026, 9:00 am IST/)).toBeInTheDocument();
    expect(screen.getByText(/^Revoked/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Label (optional)'), 'WhatsApp');
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() =>
      expect(create[0]?.body).toEqual({ role: 'participant', label: 'WhatsApp' }),
    );

    await userEvent.selectOptions(screen.getByLabelText('Role'), 'volunteer');
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(
      await screen.findByText('Staff links need a password of 8+ characters.'),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Link password'), 'volunteer1');
    fireEvent.change(screen.getByLabelText('Expires (IST, optional)'), {
      target: { value: '2026-10-31T09:00' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() =>
      expect(create[1]?.body).toEqual({
        role: 'volunteer',
        password: 'volunteer1',
        expiresAt: '2026-10-31T03:30:00.000Z',
      }),
    );

    const items = () =>
      within(screen.getByRole('list', { name: 'Your links' })).getAllByRole('listitem');
    const first = items()[0]!;
    await userEvent.click(within(first).getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith('https://portal.test/register/tok123');
    expect(within(items()[1]!).getByText('Staff: Judge')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    await userEvent.click(within(first).getByRole('button', { name: 'Revoke' }));
    await confirmDialog('Revoke');
    await waitFor(() => expect(revoke).toHaveLength(1));
  });

  it('warns that registration links need registration, and links need a portal', async () => {
    asRole('admin', { portalUrl: null }, { scanning: true });
    server.use(http.get(`${E}/invite-links`, () => HttpResponse.json([link({ url: null })])));
    go('/links');
    expect(
      await screen.findByText('Registration links need the registration feature.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Set its URL in/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
  });
});

describe('checkpoints', () => {
  const cp = {
    id: 'c1',
    name: 'Lunch',
    type: 'meal',
    opensAt: '2026-10-31T07:00:00.000Z',
    closesAt: '2026-10-31T09:00:00.000Z',
    allowRepeat: true,
    createdAt: event.createdAt,
  };

  it('creates and deletes checkpoints', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/checkpoints`, () =>
        HttpResponse.json([
          cp,
          {
            ...cp,
            id: 'c2',
            name: 'Gate',
            type: 'entry',
            opensAt: null,
            closesAt: null,
            allowRepeat: false,
          },
        ]),
      ),
    );
    const create = capture('post', `${E}/checkpoints`, cp, 201);
    const remove = capture('delete', `${E}/checkpoints/c1`, null, 204);
    server.use(
      http.get(`${E}/polls`, () =>
        HttpResponse.json([
          { id: 'p-food', question: 'Dinner choice', defaultOptionId: 'o1' },
          { id: 'p-other', question: 'T-shirt size', defaultOptionId: null },
        ]),
      ),
    );
    go('/checkpoints');
    expect(
      await screen.findByText(/From 31 Oct 2026, 12:30 pm IST until 31 Oct 2026, 2:30 pm IST/),
    ).toBeInTheDocument();
    expect(screen.getByText('Always open')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add checkpoint' }));
    expect(await screen.findByText('Name the checkpoint.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name'), 'Dinner');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'meal');
    // Only polls with a default can feed a meal checkpoint.
    await screen.findByRole('option', { name: 'Dinner choice' });
    expect(screen.queryByRole('option', { name: 'T-shirt size' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Food poll (optional)'), 'p-food');
    fireEvent.change(screen.getByLabelText('Opens (IST, optional)'), {
      target: { value: '2026-10-31T19:00' },
    });
    await userEvent.click(screen.getByLabelText(/Allow repeat scans/));
    await userEvent.click(screen.getByRole('button', { name: 'Add checkpoint' }));
    await waitFor(() =>
      expect(create[0]?.body).toEqual({
        name: 'Dinner',
        type: 'meal',
        opensAt: '2026-10-31T13:30:00.000Z',
        closesAt: null,
        allowRepeat: true,
        pollId: 'p-food',
      }),
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);
    await confirmDialog('Delete');
    await waitFor(() => expect(remove).toHaveLength(1));
  });

  it('explains when scanning is off', async () => {
    asRole('admin', {}, { registration: true });
    go('/checkpoints');
    expect(await screen.findByText(/part of the scanning feature/)).toBeInTheDocument();
  });
});
