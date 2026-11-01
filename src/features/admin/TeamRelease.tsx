import { ChevronDown, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorAlert } from '@/components/ErrorAlert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type ReleaseRequest, type ReleaseStage, useReleaseTeams } from './release';

const STAGE_TEXT: Record<ReleaseStage, string> = {
  shortlisted: 'shortlists',
  confirmed: 'confirmations',
  all: 'shortlists and confirmations',
};

/** "Not released": the team's portal still shows the previous step. */
export function PendingReleaseBadge() {
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
      not released
    </Badge>
  );
}

/**
 * The Teams page's release actions: the selected teams, or every team waiting,
 * for one stage. Each asks first: teams see the result as soon as it's released.
 */
export function ReleaseControls({
  selected,
  pendingCount,
  onReleased,
}: {
  selected: string[];
  pendingCount: number;
  onReleased: () => void;
}) {
  const release = useReleaseTeams();
  const [asking, setAsking] = useState<ReleaseRequest | null>(null);
  const confirm = () => {
    if (!asking) return;
    release.mutate(asking, {
      onSuccess: ({ released }) => {
        toast.success(
          released === 0
            ? 'Nothing new to release.'
            : `Released to ${released} team${released === 1 ? '' : 's'}.`,
        );
        onReleased();
      },
    });
    setAsking(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={selected.length === 0 || release.isPending}
        onClick={() => setAsking({ stage: 'all', teamIds: selected })}
      >
        <Send aria-hidden /> Release selected ({selected.length})
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={pendingCount === 0 || release.isPending}>
            Release all waiting ({pendingCount}) <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAsking({ stage: 'shortlisted' })}>
            Shortlists only
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAsking({ stage: 'confirmed' })}>
            Confirmations only
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAsking({ stage: 'all' })}>
            Shortlists and confirmations
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ErrorAlert error={release.error} />
      <AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {asking?.teamIds
                ? `Release to ${asking.teamIds.length} selected team${asking.teamIds.length === 1 ? '' : 's'}?`
                : `Release all waiting ${asking ? STAGE_TEXT[asking.stage] : ''}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their portals show the new status straight away. This can&apos;t be taken back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Release</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
