import type { Schemas } from '@/api/client';

type Option = Schemas['AssignmentList']['options'][number];

/**
 * Spreads the given teams over the options evenly, in random order: each team
 * goes to the option with the fewest teams that still has room. Teams left
 * over when every option is full get nothing.
 */
export function randomFill(
  teamIds: string[],
  options: Option[],
  random: () => number = Math.random,
): { teamId: string; optionId: string }[] {
  const shuffled = [...teamIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const counts = new Map(options.map((o) => [o.id, o.teams]));
  const room = (o: Option) => (o.capacity === null ? Infinity : o.capacity - counts.get(o.id)!);
  const picks: { teamId: string; optionId: string }[] = [];
  for (const teamId of shuffled) {
    const open = options.filter((o) => room(o) > 0);
    if (open.length === 0) break;
    const fewest = Math.min(...open.map((o) => counts.get(o.id)!));
    const tied = open.filter((o) => counts.get(o.id) === fewest);
    const pick = tied[Math.floor(random() * tied.length)]!;
    counts.set(pick.id, counts.get(pick.id)! + 1);
    picks.push({ teamId, optionId: pick.id });
  }
  return picks;
}

/** "3 / 5 teams", or "3 teams" with no limit. */
export const fillLabel = (o: Option) =>
  o.capacity === null
    ? `${o.teams} team${o.teams === 1 ? '' : 's'}`
    : `${o.teams} / ${o.capacity} teams`;
