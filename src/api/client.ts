import createClient, { type Middleware } from 'openapi-fetch';
import type { AppConfig } from '@/lib/config';
import type { components, paths } from './schema';

export type Schemas = components['schemas'];
export type ApiClient = ReturnType<typeof createApiClient>;

/** An error response from the API: { error: { code, message, details? } }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Typed client for the eventKit API. Adds the Bearer token (when logged in) and
 * the platform X-Api-Key to every request.
 */
export function createApiClient(config: AppConfig, getToken: () => string | null) {
  const client = createClient<paths>({ baseUrl: config.apiUrl });
  const auth: Middleware = {
    onRequest({ request }) {
      const token = getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      if (config.platformApiKey) request.headers.set('X-Api-Key', config.platformApiKey);
      return request;
    },
  };
  client.use(auth);
  return client;
}

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/** Returns the data or throws an ApiError built from the error body. */
export async function unwrap<T>(promise: Promise<ApiResult<T>>): Promise<T> {
  const { data, error, response } = await promise;
  if (response.ok) return data as T;
  const body = (error ?? {}) as { error?: { code?: string; message?: string; details?: unknown } };
  throw new ApiError(
    response.status,
    body.error?.code ?? 'UNKNOWN_ERROR',
    body.error?.message ?? `Request failed (${response.status}).`,
    body.error?.details,
  );
}
