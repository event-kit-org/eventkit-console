import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { API, server, TEST_CONFIG } from '@/test/server';
import { ApiError, createApiClient, unwrap } from './client';

describe('createApiClient', () => {
  it('sends the Bearer token and platform API key', async () => {
    let headers: Headers | undefined;
    server.use(
      http.get(`${API}/v1/events`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json([]);
      }),
    );
    const client = createApiClient(TEST_CONFIG, () => 'tok');
    await unwrap(client.GET('/v1/events'));
    expect(headers?.get('authorization')).toBe('Bearer tok');
    expect(headers?.get('x-api-key')).toBe('test-platform-key');
  });

  it('omits headers it has no value for', async () => {
    let headers: Headers | undefined;
    server.use(
      http.get(`${API}/v1/events`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json([]);
      }),
    );
    const client = createApiClient({ apiUrl: API, platformApiKey: '' }, () => null);
    await unwrap(client.GET('/v1/events'));
    expect(headers?.has('authorization')).toBe(false);
    expect(headers?.has('x-api-key')).toBe(false);
  });
});

describe('createApiClient with two API addresses', () => {
  it('moves to the second address while the first is unreachable', async () => {
    const BACKUP = 'http://api-backup.test';
    server.use(
      http.get(`${API}/v1/events`, () => HttpResponse.error()),
      http.get(`${BACKUP}/v1/events`, () => HttpResponse.json([{ id: 'e' }])),
    );
    const client = createApiClient({ ...TEST_CONFIG, apiUrl: `${API}, ${BACKUP}` }, () => null);
    try {
      expect(await unwrap(client.GET('/v1/events'))).toEqual([{ id: 'e' }]);
    } finally {
      localStorage.removeItem('eventkit:api-down');
    }
  });
});

describe('unwrap', () => {
  // Created per test: openapi-fetch captures fetch when the client is built,
  // which must happen after MSW has patched it.
  const client = () => createApiClient(TEST_CONFIG, () => null);

  it('throws an ApiError carrying the API error body', async () => {
    server.use(
      http.get(`${API}/v1/events`, () =>
        HttpResponse.json(
          { error: { code: 'FEATURE_DISABLED', message: 'Off.', details: { a: 1 } } },
          { status: 403 },
        ),
      ),
    );
    const err = await unwrap(client().GET('/v1/events')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 403,
      code: 'FEATURE_DISABLED',
      message: 'Off.',
      details: { a: 1 },
    });
  });

  it('copes with error responses that are not JSON', async () => {
    server.use(
      http.get(`${API}/v1/events`, () => new HttpResponse('Bad gateway', { status: 502 })),
    );
    const err = await unwrap(client().GET('/v1/events')).catch((e: unknown) => e);
    expect(err).toMatchObject({
      status: 502,
      code: 'UNKNOWN_ERROR',
      message: 'Request failed (502).',
    });
  });
});
