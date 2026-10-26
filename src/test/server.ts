import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Schemas } from '@/api/client';

export const API = 'http://api.test';
export const BUCKET = 'http://bucket.test';
export const TEST_CONFIG = { apiUrl: API, platformApiKey: 'test-platform-key' };

export const user: Schemas['User'] = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'asha@example.com',
  name: 'Asha',
  phone: null,
  createdAt: '2026-10-01T00:00:00.000Z',
};

export const event: Schemas['Event'] = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'PESOS X Silicon',
  hostedBy: 'PESOS',
  startAt: '2026-10-31T03:30:00.000Z',
  endAt: '2026-11-01T12:00:00.000Z',
  venue: 'Main Hall',
  registrationStart: '2026-10-01T00:00:00.000Z',
  registrationDeadline: '2026-10-30T00:00:00.000Z',
  maxParticipants: 150,
  minTeamSize: 2,
  maxTeamSize: 4,
  paymentMode: 'at_registration',
  registrationFee: 50000,
  currency: 'INR',
  paymentDeadline: null,
  hasPaymentQr: false,
  portalUrl: 'https://portal.test',
  portalPaths: {
    register: '/register/{token}',
    staff: '/staff/{token}',
    me: '/me/{token}',
    notifications: '/notifications',
  },
  participantPrefix: 'PX',
  discoverable: false,
  leaderboardVisible: false,
  createdAt: '2026-10-01T00:00:00.000Z',
};

export const apiError = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

/** Default handlers: a valid session for token "good-token". */
export const handlers = [
  http.get(`${API}/v1/auth/me`, ({ request }) =>
    request.headers.get('authorization') === 'Bearer good-token'
      ? HttpResponse.json(user)
      : apiError(401, 'UNAUTHORIZED', 'A valid Bearer access token is required.'),
  ),
  http.get(`${API}/v1/events`, () => HttpResponse.json([{ event, role: 'admin' }])),
  http.get(`${API}/health`, () => HttpResponse.json({ status: 'ok' })),
  http.get(`${API}/v1/events/:eventId/fields`, () => HttpResponse.json([])),
  http.get(`${API}/v1/events/:eventId/team-rules`, () => HttpResponse.json([])),
  // Uploads: a presigned link, then the browser's PUT straight to the bucket.
  http.post(`${API}/v1/events/:eventId/uploads`, async ({ request, params }) => {
    const { purpose, contentType } = (await request.json()) as {
      purpose: string;
      contentType: string;
    };
    const key = `events/${String(params.eventId)}/${purpose}/k.${contentType.split('/')[1]}`;
    return HttpResponse.json(
      {
        key,
        url: `${BUCKET}/${key}?signed=put`,
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        expiresIn: 300,
      },
      { status: 201 },
    );
  }),
  http.put(`${BUCKET}/*`, () => new HttpResponse(null, { status: 200 })),
];

export const server = setupServer(...handlers);
