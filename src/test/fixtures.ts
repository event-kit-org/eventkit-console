import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { Schemas } from '@/api/client';
import { API, event, server } from './server';

export const E = `${API}/v1/events/${event.id}`;

export const features = (
  on: Partial<Record<Schemas['Feature'], boolean>> = { registration: true, scanning: true },
) =>
  (['mailing', 'registration', 'scanning'] as const).map((feature) => ({
    feature,
    enabled: !!on[feature],
    bought: !!on[feature],
    updatedAt: event.createdAt,
  }));

/** The event as seen by someone with `role` (the owner, for admin, unless `isOwner` is false). */
export function asRole(
  role: Schemas['Role'],
  overrides: Partial<Schemas['Event']> = {},
  on?: Partial<Record<Schemas['Feature'], boolean>>,
  isOwner = role === 'admin',
) {
  server.use(
    http.get(E, () => HttpResponse.json({ event: { ...event, ...overrides }, role, isOwner })),
    // The sidebar reads the role from the events list.
    http.get(`${API}/v1/events`, () =>
      HttpResponse.json([{ event: { ...event, ...overrides }, role, isOwner }]),
    ),
    http.get(`${E}/features`, () => HttpResponse.json(features(on))),
  );
}

export const member = (
  registrationId: string,
  name: string,
  status: Schemas['RegistrationStatus'] = 'registered',
  isLeader = false,
): Schemas['Team']['members'][number] => ({
  registrationId,
  name,
  email: `${name.toLowerCase()}@example.com`,
  phone: '+91 98450 00000',
  participantCode: `PX-000${registrationId.slice(-1)}`,
  status,
  isLeader,
  answers: {},
  linkLastUsedAt: null,
});

export function team(overrides: Partial<Schemas['Team']> = {}): Schemas['Team'] {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Byte Club',
    leaderRegistrationId: 'r1',
    createdAt: event.createdAt,
    status: 'registered',
    belowMinimum: false,
    answers: {},
    members: [member('r1', 'Asha', 'registered', true), member('r2', 'Ravi')],
    payment: {
      mode: 'at_registration',
      amountDue: 100000,
      currency: 'INR',
      deadline: null,
      proofs: [],
    },
    shortlistedBy: null,
    confirmedBy: null,
    ...overrides,
  };
}

export function registeredTeam(
  status: Schemas['RegistrationStatus'] = 'registered',
  overrides: Partial<Schemas['Team']> = {},
) {
  return team({
    status,
    members: [member('r1', 'Asha', status, true), member('r2', 'Ravi', status)],
    ...overrides,
  });
}

export function proof(
  status: Schemas['PaymentProofStatus'],
  note: string | null = null,
): Schemas['PaymentProof'] {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    teamId: '44444444-4444-4444-8444-444444444444',
    status,
    amount: 100000,
    currency: 'INR',
    memberCount: 2,
    uploadedAt: event.createdAt,
    verifiedAt: null,
    rejectionNote: note,
  };
}

/** Records request bodies (and form data) sent to a route. */
export function capture(
  method: 'post' | 'put' | 'patch' | 'delete',
  url: string,
  response: unknown = { ok: true },
  status = 200,
) {
  const calls: { url: string; body: unknown; form?: FormData }[] = [];
  server.use(
    http[method](url, async ({ request }) => {
      const type = request.headers.get('content-type') ?? '';
      if (type.startsWith('multipart/form-data')) {
        calls.push({ url: request.url, body: null, form: await request.formData() });
      } else {
        const text = await request.text();
        calls.push({ url: request.url, body: text ? JSON.parse(text) : null });
      }
      return HttpResponse.json(response as object, { status });
    }),
  );
  return calls;
}

/** Answers the "are you sure?" dialog a ConfirmButton opened, with its `action` button. */
export async function confirmDialog(action: string) {
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: action }));
}
