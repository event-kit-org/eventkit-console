import { Badge } from '@/components/ui/badge';
import type { DisplayStatus } from '@/lib/status';
import { cn } from '@/lib/utils';

const LABEL: Record<DisplayStatus, string> = {
  registered: 'Registered',
  shortlisted: 'Shortlisted',
  confirmed: 'Confirmed',
  attending: 'Attending',
  checked_in: 'Checked in',
  cancelled: 'Cancelled',
  confirmation_pending: 'Confirmation pending',
};

const TONE: Partial<Record<DisplayStatus, string>> = {
  confirmed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  attending: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  checked_in: 'bg-emerald-600 text-white',
  shortlisted: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  confirmation_pending: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <Badge
      variant={status === 'cancelled' ? 'destructive' : 'secondary'}
      className={cn(TONE[status])}
    >
      {LABEL[status]}
    </Badge>
  );
}
