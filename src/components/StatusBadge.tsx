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

const TONE: Partial<Record<keyof typeof LABEL, string>> = {
  confirmed: 'bg-green-100 text-green-900',
  attending: 'bg-green-100 text-green-900',
  checked_in: 'bg-green-600 text-white',
  cancelled: 'bg-red-100 text-red-900',
  shortlisted: 'bg-blue-100 text-blue-900',
  confirmation_pending: 'bg-amber-100 text-amber-900',
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <Badge className={cn(TONE[status])}>{LABEL[status]}</Badge>;
}
