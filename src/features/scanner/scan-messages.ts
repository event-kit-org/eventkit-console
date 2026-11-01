import type { Schemas } from '@/api/client';
import { formatIST } from '@/lib/datetime';

type Result = Schemas['ScanResult'];

/** What the volunteer reads after a scan. */
export function describeScan(r: Result): string {
  if (r.result === 'accepted') {
    if (r.exitReason) return `Out: ${r.exitReason}`;
    if (r.reentry) return 'Back in';
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

/** A rejection reason in a few words, for the scan log. */
export function reasonLabel(reason: Result['reason']): string {
  switch (reason) {
    case 'duplicate':
      return 'Duplicate';
    case 'not_open':
      return 'Not open';
    case 'closed':
      return 'Closed';
    case 'not_attending':
      return "Not RSVP'd";
    case 'not_checked_in':
      return 'Not checked in';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Refused';
  }
}
