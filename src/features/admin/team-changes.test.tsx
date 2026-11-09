import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  asRole,
  capture,
  E,
  memberOption,
  proof,
  registeredTeam,
  teamOption,
} from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { event, server } from '@/test/server';

const go = (sub: string) => renderApp(`/events/${event.id}${sub}`, { token: 'good-token' });

describe("a member's details", () => {
  it('fixes an email and resends to the leader (on by default for the leader)', async () => {
    asRole('admin', {}, { registration: true, mailing: true });
    const t = registeredTeam('confirmed');
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    const save = capture('patch', `${E}/registrations/r1`, {
      registrationId: 'r1',
      name: 'Asha',
      email: 'asha.r@example.com',
      emailedTo: 'asha.r@example.com',
    });
    go(`/teams/${t.id}`);
    await memberOption('Asha', 'Edit');
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Send the registration email to the leader again')).toBeChecked();
    const email = dialog.getByLabelText('Email');
    await userEvent.clear(email);
    await userEvent.type(email, 'asha.r@example.com');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(save[0]?.body).toEqual({ email: 'asha.r@example.com', resendToLeader: true }),
    );
  });

  it("doesn't resend for a teammate unless asked", async () => {
    asRole('admin', {}, { registration: true, mailing: true });
    const t = registeredTeam('confirmed');
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    const save = capture('patch', `${E}/registrations/r2`, {
      registrationId: 'r2',
      name: 'Ravi K',
      email: 'ravi@example.com',
      emailedTo: null,
    });
    go(`/teams/${t.id}`);
    await memberOption('Ravi', 'Edit');
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), ' K');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(save[0]?.body).toEqual({ name: 'Ravi K', resendToLeader: false }));
  });
});

describe('adding a member', () => {
  it('adds one, says more is due after paying, and shows their link', async () => {
    asRole('admin', {}, { registration: true, mailing: true });
    const t = registeredTeam('confirmed', {
      payment: { ...registeredTeam().payment, proofs: [proof('approved')] },
    });
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    const add = capture(
      'post',
      `${E}/teams/${t.id}/members`,
      {
        registrationId: 'r3',
        name: 'Dev',
        participantCode: 'PX-0003',
        status: 'registered',
        emailedTo: 'asha@example.com',
        link: { registrationId: 'r3', token: 'ek_dev', url: 'https://portal.test/me/ek_dev' },
      },
      201,
    );
    go(`/teams/${t.id}`);
    await teamOption('Add member');
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/more is due for them/)).toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText('Name'), 'Dev');
    await userEvent.type(dialog.getByLabelText('Email'), 'dev@example.com');
    await userEvent.click(dialog.getByRole('button', { name: 'Add member' }));
    await waitFor(() =>
      expect(add[0]?.body).toEqual({ name: 'Dev', email: 'dev@example.com', answers: {} }),
    );
    expect(await screen.findByText('https://portal.test/me/ek_dev')).toBeInTheDocument();
    expect(screen.getByText(/emailed to the leader \(asha@example.com\)/)).toBeInTheDocument();
  });

  it('hides Add member when the team is full', async () => {
    asRole('admin', { maxTeamSize: 2 });
    const t = registeredTeam('confirmed');
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    go(`/teams/${t.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Team options' }));
    expect(await screen.findByRole('menuitem', { name: /Edit team/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Add member/ })).not.toBeInTheDocument();
  });

  it('lists who is still to be paid for', async () => {
    asRole('admin');
    const t = registeredTeam('confirmed', {
      payment: {
        ...registeredTeam().payment,
        paidAmount: 100000,
        amountDue: 50000,
        proofs: [proof('approved')],
        unpaid: [{ registrationId: 'r3', name: 'Dev' }],
      },
    });
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    go(`/teams/${t.id}`);
    expect(await screen.findByText(/Still to pay for Dev: ₹500/)).toBeInTheDocument();
  });
});

describe('payments', () => {
  it('names who a receipt pays for', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/payment-proofs`, () =>
        HttpResponse.json([
          {
            ...proof('pending'),
            amount: 50000,
            memberCount: 1,
            team: { id: 't', name: 'Byte Club' },
            members: [{ registrationId: 'r3', name: 'Dev' }],
            uploadedBy: { name: 'Asha', by: 'leader' },
            receiptUrl: 'https://storage.test/r.png?signed=1',
          },
        ]),
      ),
    );
    go('/payments');
    expect(await screen.findByRole('row', { name: /Byte Club/ })).toHaveTextContent('Dev');
    await userEvent.click(screen.getByRole('button', { name: 'View receipt from Byte Club' }));
    expect(await screen.findByText(/₹500 for Dev/)).toBeInTheDocument();
  });
});
