import type { Schemas } from '@/api/client';

export type DisplayStatus = Schemas['RegistrationStatus'] | 'confirmation_pending';

/**
 * A team's status as people should read it: a registered (or shortlisted) team
 * whose receipt awaits review is "Confirmation pending".
 */
export function teamDisplayStatus(team: {
  status: Schemas['RegistrationStatus'];
  latestProofStatus: Schemas['PaymentProofStatus'] | null;
}): DisplayStatus {
  if (
    (team.status === 'registered' || team.status === 'shortlisted') &&
    team.latestProofStatus === 'pending'
  ) {
    return 'confirmation_pending';
  }
  return team.status;
}
