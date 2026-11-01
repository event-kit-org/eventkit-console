import { EventKitError, type ScannerApi } from '@eventkit/sdk';
import { ApiError, type ApiClient, unwrap } from '@/api/client';
import { splitApiUrls } from '@/api/failover';

/**
 * API refusals become EventKitErrors, which the SDK scanner treats as final;
 * anything else (no answer) it retries with the same id, then decides offline.
 */
async function call<T>(promise: Promise<{ data?: T; error?: unknown; response: Response }>) {
  try {
    return await unwrap(promise);
  } catch (e) {
    if (e instanceof ApiError) throw new EventKitError(e.status, e.code, e.message, e.details);
    throw e;
  }
}

/** The SDK scanner's view of the API, through the console's own client. */
export function scannerApi(api: ApiClient, eventId: string): ScannerApi {
  const path = { params: { path: { eventId } } };
  return {
    scan: (body) => call(api.POST('/v1/events/{eventId}/scans', { ...path, body })),
    attendance: {
      mark: (qrToken, attending = true) =>
        call(
          api.POST('/v1/events/{eventId}/attendance', { ...path, body: { qrToken, attending } }),
        ),
    },
    scans: {
      roster: (checkpointId) =>
        call(
          api.GET('/v1/events/{eventId}/scans/roster', {
            params: { path: { eventId }, query: { checkpointId } },
          }),
        ),
      batch: (scans) =>
        call(api.POST('/v1/events/{eventId}/scans/batch', { ...path, body: { scans } })),
    },
  };
}

/**
 * Resolves when any API address answers /health. navigator.onLine alone is not
 * reliable (it is true on Wi-Fi without internet).
 */
export function healthCheck(apiUrl: string) {
  return async () => {
    if (!navigator.onLine) throw new Error('offline');
    for (const url of splitApiUrls(apiUrl)) {
      try {
        const res = await fetch(`${url}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return;
      } catch {
        // try the next address
      }
    }
    throw new Error('offline');
  };
}
