import { useEffect, useState } from 'react';

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
};

/** "● Live · updated 20s ago" for numbers that refresh on their own. */
export function LiveStamp({ updatedAt }: { updatedAt: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  if (!updatedAt) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      Live · updated {ago(now - updatedAt)}
    </span>
  );
}
