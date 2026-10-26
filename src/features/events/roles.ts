import type { Schemas } from '@/api/client';

export const roleLabel: Record<Schemas['Role'], string> = {
  admin: 'Admin',
  volunteer: 'Volunteer',
  judge: 'Judge',
  participant: 'Participant',
};
