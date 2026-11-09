import { ListOrdered, Plus } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, RowsSkeleton } from '@/components/PageState';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEventContext } from '@/features/events/event-context';
import { useSearchParam } from '@/hooks/useSearchParam';
import { Leaderboard } from './Leaderboard';
import { PHASES, usePickedRound } from './rounds';
import { BoardDialog, SavedBoardCard, useSavedBoards } from './SavedLeaderboards';
import { Tracks } from './Tracks';

type SavedBoard = NonNullable<ReturnType<typeof useSavedBoards>['data']>[number];

/**
 * One leaderboard at a time: a round's ranking or a saved leaderboard over
 * several rounds, picked from one list. Tracks are below, for admins.
 */
export function LeaderboardsPage() {
  const { role } = useEventContext();
  const admin = role === 'admin';
  const { rounds, all, selected, setPicked } = usePickedRound();
  const saved = useSavedBoards();
  // A saved board is ?board=<id>; a round is ?round=<id> (as Judging links it).
  const [boardId, setBoardId] = useSearchParam('board');
  const board = admin ? saved.data?.find((b) => b.id === boardId) : undefined;
  const [editing, setEditing] = useState<SavedBoard | 'new' | null>(null);
  const value = board ? `saved:${board.id}` : selected ? `round:${selected.id}` : '';
  const choose = (v: string) => {
    const [kind, id] = v.split(':') as ['saved' | 'round', string];
    if (kind === 'saved') setBoardId(id);
    else {
      setBoardId('');
      setPicked(id);
    }
  };

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Leaderboards"
        description="How teams rank in each round, and leaderboards that add up several rounds."
      >
        {admin && selected && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden /> New leaderboard
          </Button>
        )}
      </PageHeader>
      <ErrorAlert error={rounds.error ?? saved.error} />
      {rounds.isPending && <RowsSkeleton rows={2} />}
      {rounds.data && !selected && (
        <EmptyState icon={ListOrdered} title="No rounds yet">
          Add a round on the Judging page. Its leaderboard fills in as judges score.
        </EmptyState>
      )}
      {selected && (
        <>
          <Select value={value} onValueChange={choose}>
            <SelectTrigger aria-label="Leaderboard" className="w-full min-w-0 sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Rounds</SelectLabel>
                {all.map((r) => (
                  <SelectItem key={r.id} value={`round:${r.id}`}>
                    <span className="truncate">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {PHASES.find((p) => p.value === r.phase)?.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
              {admin && (saved.data?.length ?? 0) > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Saved leaderboards</SelectLabel>
                    {saved.data!.map((b) => (
                      <SelectItem key={b.id} value={`saved:${b.id}`}>
                        <span className="truncate">{b.name}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>
          {board ? (
            <SavedBoardCard key={board.id} board={board} onEdit={() => setEditing(board)} />
          ) : (
            <Leaderboard key={selected.id} roundId={selected.id} />
          )}
        </>
      )}
      {selected && admin && <Tracks />}
      {editing && (
        <BoardDialog
          key={editing === 'new' ? 'new' : editing.id}
          board={editing === 'new' ? null : editing}
          rounds={all}
          onClose={() => setEditing(null)}
          onSaved={(b) => setBoardId(b.id)}
        />
      )}
    </div>
  );
}
