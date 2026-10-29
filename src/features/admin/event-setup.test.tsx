import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());
import { asRole, capture, confirmDialog, E, features } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { API, apiError, event, server } from '@/test/server';

/** jsdom cannot type into datetime-local (or empty number) inputs, so set them directly. */
const setDate = async (label: string, value: string) =>
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });

describe('create event wizard', () => {
  async function fillAll() {
    await userEvent.type(await screen.findByLabelText('Event name'), 'Pilot Hack');
    await userEvent.type(screen.getByLabelText('Hosted by'), 'PESOS');
    await userEvent.type(screen.getByLabelText('Venue'), 'Main Hall');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await setDate('Starts (IST)', '2026-10-31T09:00');
    await setDate('Ends (IST)', '2026-11-01T17:00');
    await setDate('Registration opens (IST)', '2026-10-20T09:00');
    await setDate('Registration deadline (IST)', '2026-10-30T23:59');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await setDate('Capacity (people)', '150');
    await setDate('Smallest team', '2');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  }

  it('walks the steps, validates each, reviews in IST and creates the event', async () => {
    const created = capture('post', `${API}/v1/events`, { event, role: 'admin' }, 201);
    asRole('admin');
    const { router } = renderApp('/events/new', { token: 'good-token' });

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Enter the event name.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    await fillAll();
    await userEvent.selectOptions(screen.getByLabelText('Participant payment'), 'at_registration');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Enter the fee.')).toBeInTheDocument();
    await setDate('Fee', '1200');
    await userEvent.selectOptions(screen.getByLabelText('Charged'), 'per_team');
    await userEvent.type(screen.getByLabelText('How to pay'), '  UPI: club@upi  ');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText('31 Oct 2026, 9:00 am IST – 1 Nov 2026, 5:00 pm IST'),
    ).toBeInTheDocument();
    expect(screen.getByText('₹1,200 per team, at registration')).toBeInTheDocument();
    expect(screen.getByText('150 people, teams of 2–4')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/events/${event.id}/settings`),
    );
    expect(created[0]?.body).toEqual({
      name: 'Pilot Hack',
      hostedBy: 'PESOS',
      venue: 'Main Hall',
      startAt: '2026-10-31T03:30:00.000Z',
      endAt: '2026-11-01T11:30:00.000Z',
      registrationStart: '2026-10-20T03:30:00.000Z',
      registrationDeadline: '2026-10-30T18:29:00.000Z',
      maxParticipants: 150,
      minTeamSize: 2,
      maxTeamSize: 4,
      paymentMode: 'at_registration',
      registrationFee: 120000,
      feeBasis: 'per_team',
      currency: 'INR',
      paymentInstructions: 'UPI: club@upi',
      paymentDeadline: null,
    });
    expect(await screen.findByText(/Event created. Next/)).toBeInTheDocument();
  });

  it('checks cross-field rules and shows API errors; Back keeps values', async () => {
    server.use(
      http.post(`${API}/v1/events`, () =>
        apiError(400, 'VALIDATION_ERROR', 'Invalid request body.'),
      ),
    );
    renderApp('/events/new', { token: 'good-token' });
    await userEvent.type(await screen.findByLabelText('Event name'), 'X');
    await userEvent.type(screen.getByLabelText('Hosted by'), 'Y');
    await userEvent.type(screen.getByLabelText('Venue'), 'Z');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await setDate('Starts (IST)', '2026-10-31T09:00');
    await setDate('Ends (IST)', '2026-10-31T08:00');
    await setDate('Registration opens (IST)', '2026-10-20T09:00');
    await setDate('Registration deadline (IST)', '2026-10-19T09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Must be after the start.')).toBeInTheDocument();
    expect(screen.getByText('Must be after registration opens.')).toBeInTheDocument();
    await setDate('Ends (IST)', '2026-11-01T08:00');
    await setDate('Registration deadline (IST)', '2026-10-30T09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await setDate('Capacity (people)', '50');
    await setDate('Largest team', '0');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findAllByText('At least 1.')).not.toHaveLength(0);
    await setDate('Largest team', '3');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Largest team')).toHaveValue(3);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('None')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid request body.');
  });
});

describe('settings', () => {
  it("sets the portal's URL and path overrides, and creates an API key", async () => {
    asRole('admin', { portalUrl: null });
    server.use(
      http.get(`${E}/api-keys`, () =>
        HttpResponse.json([
          {
            id: 'k1',
            name: 'Old',
            keyPrefix: 'ek_ab',
            createdAt: event.createdAt,
            revokedAt: null,
          },
          {
            id: 'k2',
            name: 'Gone',
            keyPrefix: 'ek_cd',
            createdAt: event.createdAt,
            revokedAt: event.createdAt,
          },
        ]),
      ),
    );
    const save = capture('patch', E, { event, role: 'admin' });
    const key = capture(
      'post',
      `${E}/api-keys`,
      { id: 'k3', name: 'Portal', key: 'ek_secret' },
      201,
    );
    renderApp(`/events/${event.id}/settings`, { token: 'good-token' });
    expect(await screen.findByText(/ek_ab…/)).toBeInTheDocument();
    expect(screen.queryByText(/ek_cd…/)).not.toBeInTheDocument();
    const del = capture('delete', `${E}/api-keys/k1`, { id: 'k1' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await confirmDialog('Delete key');
    await waitFor(() => expect(del).toHaveLength(1));
    await userEvent.type(screen.getByLabelText('Portal URL'), 'https://machzero.vercel.app');
    await userEvent.click(screen.getByText(/^Paths/));
    await userEvent.clear(screen.getByLabelText('Personal link'));
    await userEvent.type(screen.getByLabelText('Personal link'), '/p/{{token}');
    await userEvent.click(screen.getByRole('button', { name: 'Save portal' }));
    await waitFor(() =>
      expect(save[0]?.body).toEqual({
        portalUrl: 'https://machzero.vercel.app',
        portalPaths: { ...event.portalPaths, me: '/p/{token}' },
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create API key' }));
    expect(await screen.findByText('ek_secret')).toBeInTheDocument();
    expect(key[0]?.body).toEqual({ name: 'Portal' });
    // Everything the portal needs, ready to paste.
    expect(screen.getByLabelText('Portal settings')).toHaveTextContent(
      `VITE_EVENTKIT_API_URL=${API} VITE_EVENTKIT_EVENT_ID=${event.id} VITE_EVENTKIT_API_KEY=ek_secret`,
    );
  });

  it('shows the event ID and API URL, and copies them', async () => {
    const user = userEvent.setup();
    asRole('admin');
    renderApp(`/events/${event.id}/settings`, { token: 'good-token' });
    expect(await screen.findByText(event.id)).toBeInTheDocument();
    expect(screen.getByText(API)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy Event ID' }));
    expect(await navigator.clipboard.readText()).toBe(event.id);
    expect(await screen.findByRole('button', { name: 'Event ID copied' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy API URL' }));
    expect(await navigator.clipboard.readText()).toBe(API);
  });

  it('activates and switches features', async () => {
    asRole('admin', { paymentMode: 'none' }, { registration: true });
    const buy = capture('post', `${E}/billing/purchases`, {
      status: 'approved',
      provider: 'free',
      providerRef: 'x',
      amount: 0,
      currency: 'INR',
    });
    const toggle = capture('patch', `${E}/features/registration`, features()[1]);
    renderApp(`/events/${event.id}/settings`, { token: 'good-token' });
    expect(await screen.findByRole('switch', { name: 'registration' })).toBeChecked();
    const activate = screen.getAllByRole('button', { name: 'Activate' });
    await userEvent.click(activate[0]!);
    await waitFor(() => expect(buy[0]?.body).toEqual({ features: ['mailing'] }));
    await userEvent.click(activate[1]!);
    await waitFor(() => expect(buy[1]?.body).toEqual({ features: ['scanning'] }));
    await userEvent.click(screen.getByRole('switch', { name: 'registration' }));
    await waitFor(() => expect(toggle[0]?.body).toEqual({ enabled: false }));
    expect(screen.queryByText('UPI QR code')).not.toBeInTheDocument();
  });

  it('shows the QR and uploads a new one', async () => {
    asRole('admin', { hasPaymentQr: true });
    server.use(
      http.get(`${E}/payment-qr`, () =>
        HttpResponse.json({ url: 'https://storage.test/qr.png?signed=1', expiresIn: 300 }),
      ),
    );
    const set = capture('put', `${E}/payment-qr`, { event, role: 'admin' });
    renderApp(`/events/${event.id}/settings`, { token: 'good-token' });
    expect(await screen.findByRole('img', { name: 'UPI QR code' })).toBeInTheDocument();
    await userEvent.upload(
      screen.getByLabelText('UPI QR image'),
      new File(['png'], 'qr.png', { type: 'image/png' }),
    );
    // Uploaded straight to the bucket, then the key handed to the API.
    await waitFor(() =>
      expect(set[0]?.body).toEqual({ key: `events/${event.id}/payment_qr/k.png` }),
    );
  });

  it('warns when a paid event has no way to pay, but not once instructions exist', async () => {
    asRole('admin');
    const { unmount } = renderApp(`/events/${event.id}/settings`, { token: 'good-token' });
    expect(await screen.findByText(/Teams don't know how to pay yet/)).toBeInTheDocument();
    unmount();
    asRole('admin', { paymentInstructions: 'UPI: club@upi' });
    renderApp(`/events/${event.id}/settings`, { token: 'good-token' });
    expect(await screen.findByText('Payment instructions file')).toBeInTheDocument();
    expect(screen.queryByText(/Teams don't know how to pay yet/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('How to pay')).toHaveValue('UPI: club@upi');
  });

  it('uploads, shows and removes the payment instructions file', async () => {
    asRole('admin', { hasPaymentInstructionsFile: true });
    server.use(
      http.get(`${E}/payment-instructions-file`, () =>
        HttpResponse.json({ url: 'https://storage.test/pay.pdf?signed=1', expiresIn: 300 }),
      ),
    );
    const set = capture('put', `${E}/payment-instructions-file`, { event, role: 'admin' });
    const removed = capture('delete', `${E}/payment-instructions-file`, { event, role: 'admin' });
    renderApp(`/events/${event.id}/settings`, { token: 'good-token' });
    expect(await screen.findByRole('link', { name: 'View the current file' })).toHaveAttribute(
      'href',
      'https://storage.test/pay.pdf?signed=1',
    );
    await userEvent.upload(
      screen.getByLabelText('Payment instructions file'),
      new File(['webp'], 'pay.webp', { type: 'image/webp' }),
    );
    await waitFor(() =>
      expect(set[0]?.body).toEqual({ key: `events/${event.id}/payment_instructions/k.webp` }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(removed).toHaveLength(1));
  });

  it('edits the event and shows lock errors', async () => {
    asRole('admin');
    const save = capture('patch', E, { event, role: 'admin' });
    renderApp(`/events/${event.id}/settings`, { token: 'good-token' });
    const venue = await screen.findByLabelText('Venue');
    expect(screen.getByLabelText('Fee')).toHaveValue(500);
    await userEvent.clear(venue);
    await userEvent.type(venue, 'Hall B');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(save[0]?.body).toMatchObject({ venue: 'Hall B' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();

    server.use(
      http.patch(E, () => apiError(409, 'PAYMENT_SETTINGS_LOCKED', 'Payment settings are locked.')),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Payment settings are locked.')).toBeInTheDocument();
  });
});
