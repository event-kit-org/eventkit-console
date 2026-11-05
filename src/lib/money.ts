/** Amounts travel in the minor unit (paise). */
export function formatMoney(minor: number, currency: string | null): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency ?? 'INR',
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);
export const paiseToRupees = (paise: number) => paise / 100;

/** A team's balance for the dashboard: positive owes extra, negative is owed a refund. */
export function describeBalance(balance: number | null, currency: string | null): string {
  if (balance === null) return '—';
  if (balance === 0) return 'Settled';
  const amount = formatMoney(Math.abs(balance), currency);
  return balance > 0 ? `+${amount} to collect` : `−${amount} to refund`;
}

type Payer = { paidAmount: number | null; paidMembers: number | null; balance: number | null };

/** Teams owing extra and teams owed a refund, with their totals, from each team's balance. */
export function sumBalances(teams: Payer[]) {
  const extra = teams.filter((t) => (t.balance ?? 0) > 0);
  const refund = teams.filter((t) => (t.balance ?? 0) < 0);
  const total = (list: Payer[]) => list.reduce((n, t) => n + Math.abs(t.balance ?? 0), 0);
  return {
    extra: { teams: extra.length, total: total(extra) },
    refund: { teams: refund.length, total: total(refund) },
  };
}

/**
 * Balances if the fee were `fee` (paise): each paid team's new amount for the
 * members its receipt covered, minus what it paid.
 */
export function balancesAtFee(
  teams: Payer[],
  fee: number,
  feeBasis: 'per_person' | 'per_team',
): Payer[] {
  return teams.map((t) =>
    t.paidAmount === null || t.paidMembers === null
      ? t
      : { ...t, balance: (feeBasis === 'per_team' ? fee : fee * t.paidMembers) - t.paidAmount },
  );
}
