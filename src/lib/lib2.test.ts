import { describe, expect, it } from 'vitest';
import { fromISTInput, toISTInput } from './datetime';
import { formatMoney, paiseToRupees, rupeesToPaise } from './money';

describe('money', () => {
  it('formats paise in rupees, showing paise only when needed', () => {
    expect(formatMoney(100000, 'INR')).toBe('₹1,000');
    expect(formatMoney(12345, 'INR')).toBe('₹123.45');
    expect(formatMoney(500, null)).toBe('₹5');
    expect(rupeesToPaise(499.99)).toBe(49999);
    expect(paiseToRupees(49999)).toBe(499.99);
  });
});

describe('IST inputs', () => {
  it('converts between UTC and IST datetime-local values', () => {
    expect(toISTInput('2026-10-31T03:30:00.000Z')).toBe('2026-10-31T09:00');
    expect(fromISTInput('2026-10-31T09:00')).toBe('2026-10-31T03:30:00.000Z');
    expect(fromISTInput('2026-11-01T02:00')).toBe('2026-10-31T20:30:00.000Z');
  });
});
