import { useQuery } from '@tanstack/react-query';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useCallback, useRef, useState } from 'react';
import { ApiError, type Schemas, unwrap } from '@/api/client';
import { useAuth } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useEventContext } from '@/features/events/event-context';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { describeScan } from './scan-messages';

type Outcome =
  | { kind: 'result'; result: Schemas['ScanResult']; code: string }
  | { kind: 'error'; message: string };

/** Ignore the same code for this long after a result (cameras re-detect constantly). */
const SAME_CODE_COOLDOWN_MS = 3000;
const RETRIES = 2;

const storageKey = (eventId: string) => `eventkit.checkpoint.${eventId}`;
function remembered(eventId: string): string {
  try {
    return window.localStorage.getItem(storageKey(eventId)) ?? '';
  } catch {
    return '';
  }
}

/**
 * Online-only scanner. Each scan gets a UUID made on this phone; a request that
 * fails mid-air is retried with the same id, so it can never count twice. With
 * no connection the scanner pauses and says so: nothing is queued.
 */
export function ScannerPage() {
  const { api, config } = useAuth();
  const { event, path, features } = useEventContext();
  const { online, markOffline } = useOnlineStatus(config.apiUrl);
  const [checkpointId, setCheckpointId] = useState(() => remembered(event.id));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const last = useRef<{ code: string; at: number } | null>(null);
  /** A scan whose request never got an answer: rescanning the same code reuses its id. */
  const unanswered = useRef<{ code: string; checkpointId: string; id: string } | null>(null);

  const checkpoints = useQuery({
    queryKey: ['event', event.id, 'checkpoints'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/checkpoints', path)),
    enabled: features.scanning,
  });

  const choose = (id: string) => {
    setCheckpointId(id);
    setOutcome(null);
    try {
      window.localStorage.setItem(storageKey(event.id), id);
    } catch {
      // not remembered
    }
  };

  const submit = useCallback(
    async (code: string) => {
      const now = Date.now();
      if (
        last.current &&
        last.current.code === code &&
        now - last.current.at < SAME_CODE_COOLDOWN_MS
      )
        return;
      last.current = { code, at: now };

      const pending = unanswered.current;
      const id =
        pending && pending.code === code && pending.checkpointId === checkpointId
          ? pending.id
          : crypto.randomUUID();
      setBusy(true);
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            const result = await unwrap(
              api.POST('/v1/events/{eventId}/scans', {
                ...path,
                body: { id, checkpointId, qrToken: code },
              }),
            );
            unanswered.current = null;
            setOutcome({ kind: 'result', result, code });
            return;
          } catch (e) {
            if (e instanceof ApiError) {
              unanswered.current = null;
              setOutcome({ kind: 'error', message: e.message });
              return;
            }
            if (attempt >= RETRIES) throw e;
          }
        }
      } catch {
        unanswered.current = { code, checkpointId, id };
        markOffline();
        setOutcome({
          kind: 'error',
          message: 'No answer from the server. Not recorded — scan again when back online.',
        });
      } finally {
        setBusy(false);
      }
    },
    [api, path, checkpointId, markOffline],
  );

  /** At the gate: someone confirmed who never RSVPed is marked attending, then scanned again. */
  const markAttending = async (code: string) => {
    setBusy(true);
    try {
      await unwrap(
        api.POST('/v1/events/{eventId}/attendance', {
          ...path,
          body: { qrToken: code, attending: true },
        }),
      );
    } catch (e) {
      setOutcome({ kind: 'error', message: (e as Error).message });
      return;
    } finally {
      setBusy(false);
    }
    last.current = null;
    await submit(code);
  };

  if (!features.scanning) return <Alert>Scanning is switched off for this event.</Alert>;

  const ready = online && checkpointId !== '' && !busy;
  const result = outcome?.kind === 'result' ? outcome.result : null;

  return (
    <div className="mx-auto grid max-w-md gap-3">
      {!online && (
        <div
          role="alert"
          className="rounded-md bg-red-600 px-4 py-3 text-center font-semibold text-white"
        >
          You are offline. Scanning is paused until the connection is back.
        </div>
      )}
      <div className="grid gap-1">
        <label htmlFor="checkpoint" className="text-sm font-medium">
          Checkpoint
        </label>
        <Select id="checkpoint" value={checkpointId} onChange={(e) => choose(e.target.value)}>
          <option value="">Choose where you are scanning</option>
          {checkpoints.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <ErrorAlert error={checkpoints.error} />
      </div>

      {cameraError && (
        <Alert>Camera unavailable ({cameraError}). Allow camera access, or type codes below.</Alert>
      )}
      <div className={cn('overflow-hidden rounded-lg border bg-black', !ready && 'opacity-60')}>
        <Scanner
          onScan={(codes) => {
            const code = codes[0]?.rawValue;
            if (code && ready) void submit(code);
          }}
          paused={!ready}
          formats={['qr_code']}
          components={{ finder: true, torch: true }}
          allowMultiple
          scanDelay={500}
          onError={(e) => setCameraError(e.message)}
        />
      </div>

      {outcome && (
        <div
          role="status"
          className={cn(
            'rounded-lg p-4 text-center',
            result?.result === 'accepted' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          )}
        >
          {result ? (
            <>
              <div className="text-2xl font-bold">
                {result.result === 'accepted' ? '✓ ' : '✗ '}
                {describeScan(result)}
              </div>
              {result.meal && (
                <div className="mt-2 rounded-md bg-white/20 px-3 py-2 text-xl font-bold">
                  {result.meal.label}
                  {!result.meal.chosen && (
                    <span className="block text-sm font-normal">Default (did not vote)</span>
                  )}
                </div>
              )}
              <div className="mt-1 text-lg">{result.participant.name}</div>
              <div className="text-sm opacity-90">Team {result.participant.teamName}</div>
              {result.reason === 'not_attending' && outcome.kind === 'result' && (
                <Button
                  variant="outline"
                  className="mt-3 bg-white text-black"
                  disabled={!online || busy}
                  onClick={() => void markAttending(outcome.code)}
                >
                  Mark attending and check in
                </Button>
              )}
            </>
          ) : (
            <div className="text-lg font-semibold">
              {outcome.kind === 'error' && outcome.message}
            </div>
          )}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim() && ready) {
            last.current = null;
            void submit(manual.trim()).then(() => setManual(''));
          }
        }}
      >
        <Input
          aria-label="Code typed by hand"
          placeholder="Camera not working? Type the code"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!ready || !manual.trim()}>
          Check
        </Button>
      </form>
    </div>
  );
}
