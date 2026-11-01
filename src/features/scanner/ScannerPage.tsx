import { isEventKitError, type ScanResult } from '@eventkit/sdk';
import { useQuery } from '@tanstack/react-query';
import { Scanner } from '@yudiel/react-qr-scanner';
import { CameraOff, CloudUpload, Info, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { unwrap } from '@/api/client';
import { useAuth } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useEventContext } from '@/features/events/event-context';
import { cn } from '@/lib/utils';
import { ExitReasonDialog } from './ExitReasonDialog';
import { describeScan } from './scan-messages';
import { ScanLog } from './ScanLog';
import { useCheckpointScanner } from './useCheckpointScanner';

type Outcome =
  { kind: 'result'; result: ScanResult; code: string } | { kind: 'error'; message: string };

const storageKey = (eventId: string) => `eventkit.checkpoint.${eventId}`;
function remembered(eventId: string): string {
  try {
    return window.localStorage.getItem(storageKey(eventId)) ?? '';
  } catch {
    return '';
  }
}

/** Shows the pause between scans running out, so volunteers know when to scan the next. */
function PauseBar({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [until]);
  const left = Math.max(0, until - now);
  if (left === 0) return null;
  return <Progress aria-label="Ready for the next scan" value={100 - (left / 1200) * 100} />;
}

/**
 * The scanner (the SDK's): each scan gets a UUID made on this phone and is
 * retried with the same id, so it never counts twice. Without a connection it
 * keeps going from the checkpoint's cached roster, queues the scans and sends
 * them once back online. Exit checkpoints ask why the person is leaving.
 */
export function ScannerPage() {
  const { api } = useAuth();
  const { event, path, features } = useEventContext();
  const [checkpointId, setCheckpointId] = useState(() => remembered(event.id));
  const { scanner, online, offlineReady, pendingCount, log } = useCheckpointScanner(
    event.id,
    checkpointId,
  );
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  /** An exit scan waiting for its reason. */
  const [leaving, setLeaving] = useState<{ code: string; force: boolean } | null>(null);
  const [pausedUntil, setPausedUntil] = useState(0);

  const checkpoints = useQuery({
    queryKey: ['event', event.id, 'checkpoints'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/checkpoints', path)),
    enabled: features.scanning,
  });
  const checkpoint = checkpoints.data?.find((c) => c.id === checkpointId);

  const choose = (id: string) => {
    setCheckpointId(id);
    setOutcome(null);
    try {
      window.localStorage.setItem(storageKey(event.id), id);
    } catch {
      // not remembered
    }
  };

  async function run(action: () => Promise<ScanResult | null>, code: string) {
    setBusy(true);
    try {
      const result = await action();
      if (result) setOutcome({ kind: 'result', result, code });
    } catch (e) {
      setOutcome({
        kind: 'error',
        message: isEventKitError(e) || e instanceof Error ? e.message : 'Scan failed.',
      });
    } finally {
      setBusy(false);
      if (scanner) setPausedUntil(scanner.pausedUntil);
    }
  }

  const submit = (code: string, force = false, exitReason?: string) => {
    if (!scanner) return;
    if (checkpoint?.type === 'exit' && !exitReason) {
      setLeaving({ code, force });
      return;
    }
    void run(() => scanner.scan(code, { force, ...(exitReason ? { exitReason } : {}) }), code);
  };

  /** At the gate: someone confirmed who never RSVPed is marked attending, then scanned again. */
  const markAttending = (code: string) => {
    if (scanner) void run(() => scanner.markAttendingAndScan(code), code);
  };

  if (!features.scanning) {
    return (
      <Alert>
        <Info aria-hidden />
        <AlertDescription>Scanning is switched off for this event.</AlertDescription>
      </Alert>
    );
  }

  const canScan = (online || offlineReady) && checkpointId !== '' && !busy && !leaving;
  const result = outcome?.kind === 'result' ? outcome.result : null;

  return (
    <div className="mx-auto grid max-w-md gap-3">
      {!online && (
        <Alert variant={offlineReady ? 'default' : 'destructive'} role="alert">
          <WifiOff aria-hidden />
          <AlertTitle>You&apos;re offline</AlertTitle>
          <AlertDescription>
            {offlineReady
              ? 'Offline scan mode is on: scans are checked on this phone and sent when the connection is back.'
              : 'Scanning is paused: this checkpoint has no offline list yet. Open it once while online.'}
          </AlertDescription>
        </Alert>
      )}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <CloudUpload className="size-4" aria-hidden />
            Waiting to sync
          </span>
          <Badge variant="secondary" aria-label={`${pendingCount} scans waiting to sync`}>
            {pendingCount}
          </Badge>
        </div>
      )}
      <Field>
        <FieldLabel htmlFor="checkpoint">Checkpoint</FieldLabel>
        {checkpoints.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <NativeSelect
            id="checkpoint"
            className="w-full [&_select]:h-10"
            value={checkpointId}
            onChange={(e) => choose(e.target.value)}
          >
            <NativeSelectOption value="">Choose where you are scanning</NativeSelectOption>
            {checkpoints.data?.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <ErrorAlert error={checkpoints.error} />
      </Field>
      {cameraError && (
        <Alert>
          <CameraOff aria-hidden />
          <AlertDescription>
            Camera unavailable ({cameraError}). Allow camera access, or type codes below.
          </AlertDescription>
        </Alert>
      )}
      <div
        className={cn(
          'aspect-square overflow-hidden rounded-xl border bg-black transition-opacity',
          !canScan && 'opacity-60',
        )}
      >
        <Scanner
          onScan={(codes) => {
            const code = codes[0]?.rawValue;
            if (code && canScan) submit(code);
          }}
          paused={!canScan}
          formats={['qr_code']}
          components={{ finder: true, torch: true }}
          allowMultiple
          scanDelay={500}
          onError={(e) => setCameraError(e.message)}
        />
      </div>
      <PauseBar until={pausedUntil} />

      {outcome && (
        <div
          role="status"
          className={cn(
            'rounded-xl p-4 text-center shadow-sm',
            result?.result === 'accepted' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
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
              {result.offline && (
                <div className="mt-1 text-xs opacity-90">
                  Checked offline · sent when back online
                </div>
              )}
              {result.reason === 'not_attending' && outcome.kind === 'result' && (
                <Button
                  variant="secondary"
                  className="mt-3"
                  disabled={!online || busy}
                  onClick={() => markAttending(outcome.code)}
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
          if (manual.trim() && canScan) {
            submit(manual.trim(), true);
            setManual('');
          }
        }}
      >
        <Input
          aria-label="Code typed by hand"
          placeholder="Camera not working? Type the code"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!canScan || !manual.trim()}>
          Check
        </Button>
      </form>

      {checkpointId && (
        <ScanLog eventId={event.id} checkpointId={checkpointId} online={online} local={log} />
      )}

      <ExitReasonDialog
        code={leaving?.code ?? null}
        reasons={event.exitReasons}
        onCancel={() => setLeaving(null)}
        onConfirm={(reason) => {
          const pending = leaving!;
          setLeaving(null);
          submit(pending.code, true, reason);
        }}
      />
    </div>
  );
}
