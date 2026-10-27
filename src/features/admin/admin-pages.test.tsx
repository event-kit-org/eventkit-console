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
  belowMinimum: false,
  latestProofStatus: 'approved',
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

  it('staff are sent to the portal', async () => {
    asRole('volunteer');
    go('/teams');
    expect(await screen.findByText(/sign in on the event's own portal/)).toBeInTheDocument();
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
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'registered');
    expect(screen.queryByRole('link', { name: 'Byte Club' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Waiting One' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'flagged');
    expect(screen.getByText('No teams here yet.')).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'the whole team will be cancelled',
    );
    await confirmDialog('Cancel registration');
    await waitFor(() => expect(cancel).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(restore).toHaveLength(1));
  });

  it('shortlists in pay-after-shortlist events and shows payments and errors', async () => {
    asRole('admin', { paymentMode: 'after_shortlist' });
    const t = registeredTeam('registered', {
      payment: {
        mode: 'after_shortlist',
        amountDue: 100000,
        currency: 'INR',
        deadline: null,
        proofs: [proof('rejected', 'Blurry')],
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

describe('payments', () => {
  const item = (status: 'pending' | 'approved' | 'rejected', ext = 'png') => ({
    ...proof(status, status === 'rejected' ? 'Wrong amount' : null),
    team: { id: 't', name: 'Byte Club' },
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
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(approve).toHaveLength(1));
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
      respondedAt: event.createdAt,
    },
    {
      userId: 'v1',
      name: 'Vik',
      email: 'vik@example.com',
      phone: '+91 90000',
      role: 'volunteer',
      respondedAt: event.createdAt,
    },
  ];

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
