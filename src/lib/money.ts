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
