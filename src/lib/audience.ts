import type { Schemas } from '@/api/client';
import { roleLabel } from '@/features/events/roles';

export const ROLES: Schemas['Role'][] = ['participant', 'volunteer', 'judge', 'admin'];

/** "Everyone" for all four roles, otherwise the roles in a fixed order. */
export function audienceText(roles: Schemas['Role'][]): string {
  if (roles.length === ROLES.length) return 'Everyone';
  return ROLES.filter((r) => roles.includes(r))
    .map((r) => `${roleLabel[r]}s`)
    .join(', ');
}
