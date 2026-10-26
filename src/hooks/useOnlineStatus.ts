import { useEffect, useState } from 'react';

/**
 * Whether the app can reach the API right now. navigator.onLine alone is not
 * reliable (it is true on Wi-Fi without internet), so this also pings /health.
 */
export function useOnlineStatus(
  apiUrl: string,
  intervalMs = 5000,
): {
  online: boolean;
  markOffline: () => void;
} {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!navigator.onLine) {
        if (!cancelled) setOnline(false);
        return;
      }
      try {
        const res = await fetch(`${apiUrl}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        });
        if (!cancelled) setOnline(res.ok);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    const goOffline = () => setOnline(false);
    void check();
    const timer = window.setInterval(() => void check(), intervalMs);
    window.addEventListener('online', check);
    window.addEventListener('offline', goOffline);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', goOffline);
    };
  }, [apiUrl, intervalMs]);

  return { online, markOffline: () => setOnline(false) };
}
