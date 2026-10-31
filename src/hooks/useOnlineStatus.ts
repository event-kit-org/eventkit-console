import { useEffect, useState } from 'react';
import { splitApiUrls } from '@/api/failover';

/**
 * Whether the app can reach the API right now. navigator.onLine alone is not
 * reliable (it is true on Wi-Fi without internet), so this also pings /health.
 * With several API addresses, online means any of them answers.
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
      let ok = false;
      for (const url of splitApiUrls(apiUrl)) {
        try {
          const res = await fetch(`${url}/health`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(3000),
          });
          ok = res.ok;
        } catch {
          ok = false;
        }
        if (ok) break;
      }
      if (!cancelled) setOnline(ok);
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
