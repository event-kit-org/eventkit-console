export interface AppConfig {
  /** Base URL of the API, e.g. "/api" behind the same domain. */
  apiUrl: string;
  /** Sent as X-Api-Key. Identifies the hosted front end; grants nothing by itself. */
  platformApiKey: string;
}

declare global {
  interface Window {
    __EVENTKIT_CONFIG__?: Partial<AppConfig>;
  }
}

/**
 * Runtime config written by the container at start-up (public/config.js) wins;
 * otherwise build-time VITE_* variables (local development).
 */
export function loadAppConfig(
  runtime: Partial<AppConfig> | undefined = window.__EVENTKIT_CONFIG__,
  env: Record<string, string | undefined> = import.meta.env,
): AppConfig {
  return {
    apiUrl: runtime?.apiUrl || env.VITE_API_URL || '/api',
    platformApiKey: runtime?.platformApiKey || env.VITE_PLATFORM_API_KEY || '',
  };
}
