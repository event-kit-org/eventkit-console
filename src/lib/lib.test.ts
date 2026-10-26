import { describe, expect, it } from 'vitest';
import { loadAppConfig } from './config';
import { formatDateIST, formatIST } from './datetime';
import { cn } from './utils';

describe('loadAppConfig', () => {
  it('prefers runtime config from the container', () => {
    expect(
      loadAppConfig(
        { apiUrl: 'https://x.test/api', platformApiKey: 'rk' },
        { VITE_API_URL: '/v', VITE_PLATFORM_API_KEY: 'vk' },
      ),
    ).toEqual({ apiUrl: 'https://x.test/api', platformApiKey: 'rk' });
  });

  it('falls back to VITE_* variables, then defaults', () => {
    expect(loadAppConfig(undefined, { VITE_API_URL: '/v', VITE_PLATFORM_API_KEY: 'vk' })).toEqual({
      apiUrl: '/v',
      platformApiKey: 'vk',
    });
    expect(loadAppConfig({}, {})).toEqual({ apiUrl: '/api', platformApiKey: '' });
  });

  it('reads window and import.meta.env by default', () => {
    window.__EVENTKIT_CONFIG__ = { apiUrl: '/from-window' };
    expect(loadAppConfig().apiUrl).toBe('/from-window');
    window.__EVENTKIT_CONFIG__ = undefined;
  });
});

describe('IST formatting', () => {
  it('shows UTC times in India Standard Time', () => {
    expect(formatIST('2026-10-31T03:30:00.000Z')).toBe('31 Oct 2026, 9:00 am IST');
    expect(formatDateIST('2026-10-30T20:00:00.000Z')).toBe('31 Oct 2026');
  });
});

describe('cn', () => {
  it('merges Tailwind classes', () => {
    expect(cn('px-2', undefined, 'px-4')).toBe('px-4');
  });
});
