import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API, server } from '@/test/server';
import { useOnlineStatus } from './useOnlineStatus';

afterEach(() => vi.restoreAllMocks());

describe('useOnlineStatus', () => {
  it('is online while /health answers, offline when it fails or errors', async () => {
    let healthy = true;
    server.use(
      http.get(`${API}/health`, () =>
        healthy ? HttpResponse.json({ status: 'ok' }) : new HttpResponse(null, { status: 503 }),
      ),
    );
    const { result } = renderHook(() => useOnlineStatus(API, 30));
    await waitFor(() => expect(result.current.online).toBe(true));
    healthy = false;
    await waitFor(() => expect(result.current.online).toBe(false));
    healthy = true;
    await waitFor(() => expect(result.current.online).toBe(true));
    server.use(http.get(`${API}/health`, () => HttpResponse.error()));
    await waitFor(() => expect(result.current.online).toBe(false));
  });

  it('goes offline with the browser, and can be marked offline by the caller', async () => {
    server.use(http.get(`${API}/health`, () => HttpResponse.json({ status: 'ok' })));
    const { result, unmount } = renderHook(() => useOnlineStatus(API, 60_000));
    await waitFor(() => expect(result.current.online).toBe(true));
    act(() => result.current.markOffline());
    expect(result.current.online).toBe(false);
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(result.current.online).toBe(true));

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.online).toBe(false);
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(result.current.online).toBe(false));
    unmount();
  });

  it('with several addresses, is online while any of them answers', async () => {
    const BACKUP = 'http://api-backup.test';
    server.use(
      http.get(`${API}/health`, () => HttpResponse.error()),
      http.get(`${BACKUP}/health`, () => HttpResponse.json({ status: 'ok' })),
    );
    const { result } = renderHook(() => useOnlineStatus(`${API},${BACKUP}`, 60_000));
    await waitFor(() => expect(result.current.online).toBe(true));
  });
});
