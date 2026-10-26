import type { Schemas } from '@/api/client';
import { formatIST } from '@/lib/datetime';

type Result = Schemas['ScanResult'];

/** What the volunteer reads after a scan. */
export function describeScan(r: Result): string {
  if (r.result === 'accepted') {
    return r.checkpoint.type === 'entry' ? 'Checked in' : 'OK — hand it over';
  }
  switch (r.reason) {
    case 'duplicate':
      return r.previousScanAt
        ? `Already scanned at ${formatIST(r.previousScanAt)}`
        : 'Already scanned here';
    case 'not_open':
      return 'This checkpoint is not open yet';
    case 'closed':
      return 'This checkpoint has closed';
    case 'not_attending':
      return 'Has not confirmed attendance (RSVP) yet';
    case 'not_checked_in':
      return 'Not checked in at the entry yet';
    case 'cancelled':
      return 'Registration is cancelled';
    default:
      return 'Refused';
  }
}
