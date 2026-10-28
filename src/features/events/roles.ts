import type { Schemas } from '@/api/client';

export const roleLabel: Record<Schemas['Role'], string> = {
  admin: 'Admin',
  volunteer: 'Volunteer',
  judge: 'Judge',
  participant: 'Participant',
  reviewer: 'Reviewer',
};

/** Console roles: the owner and co-admins (admin), and reviewers. */
export const CONSOLE_ROLES: Schemas['Role'][] = ['admin', 'reviewer'];
