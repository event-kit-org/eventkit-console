import { createScanner, type LocalLogEntry, type Scanner } from '@eventkit/sdk';
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/context';
import { healthCheck, scannerApi } from './scanner-api';

export interface CheckpointScanner {
  scanner: Scanner | null;
  online: boolean;
  /** A roster is cached for this checkpoint: scanning goes on offline. */
  offlineReady: boolean;
  /** Offline scans waiting to be sent. */
  pendingCount: number;
  /** This device's scans at the checkpoint, newest first. */
  log: LocalLogEntry[];
}

/**
 * The SDK scanner for one checkpoint (offline mode, same-code cooldown, pause
 * between scans), with its state as React state.
 */
export function useCheckpointScanner(eventId: string, checkpointId: string): CheckpointScanner {
  const { api, config } = useAuth();
  const [scanner, setScanner] = useState<Scanner | null>(null);
  const [state, setState] = useState<Omit<CheckpointScanner, 'scanner'>>({
    online: navigator.onLine,
    offlineReady: false,
    pendingCount: 0,
    log: [],
  });

  useEffect(() => {
    if (!checkpointId) return;
    const s = createScanner(scannerApi(api, eventId), healthCheck(config.apiUrl), {
      checkpointId,
      storageKey: eventId,
    });
    const read = () =>
      setState({
        online: s.online,
        offlineReady: s.offlineReady,
        pendingCount: s.pendingCount,
        log: s.log,
      });
    setScanner(s);
    read();
    const off = s.onChange(read);
    void s.check();
    return () => {
      off();
      s.destroy();
    };
  }, [api, config.apiUrl, eventId, checkpointId]);

  return { scanner: checkpointId ? scanner : null, ...state };
}
