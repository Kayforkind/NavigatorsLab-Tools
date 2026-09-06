import { describe, it, expect } from 'vitest';
import { pickTotal, firstMerchantLine, amountsIn } from './receipts';

describe('amountsIn', () => {
  it('finds $-prefixed amounts', () => {
    expect(amountsIn('TOTAL $12.34')).toEqual([12.34]);
  });
  it('handles european decimals', () => {
    expect(amountsIn('SUMME 12,34')).toEqual([12.34]);
  });
  it('handles thousands separators', () => {
    expect(amountsIn('TOTAL 1 234.56')).toEqual([1234.56]);
    expect(amountsIn('TOTAL 1,234.56')).toEqual([1234.56]);
  });
  it('ignores dates and phone-like numbers', () => {
    expect(amountsIn('2026-09-05')).toEqual([]);
    expect(amountsIn('TEL 555-0199')).toEqual([]);
  });
});

describe('pickTotal', () => {
  it('prefers an explicit grand total over larger noise numbers', () => {
    const lines = [
      'NAVIGATORSLAB STORE',
      'Item 1 3.50',
      'Item 2 7.00',
      'SUBTOTAL 10.50',
      'TAX 0.94',
      'GRAND TOTAL $408.00',
    ];
    const { total, hint } = pickTotal(lines);
    expect(total).toBe(408.0);
    expect(hint.toLowerCase()).toContain('grand total');
  });

  it('skips subtotal/tax lines', () => {
    const lines = ['SHOP', 'SUBTOTAL 20.00', 'TAX 1.60', 'TOTAL 21.60'];
    expect(pickTotal(lines).total).toBe(21.6);
  });

  it('falls back to the largest non-tax amount', () => {
    const lines = ['CAFE', 'LATTE 4.50', 'SANDWICH 8.25'];
    expect(pickTotal(lines).total).toBe(8.25);
  });

  it('returns null on garbage', () => {
    expect(pickTotal(['', '...']).total).toBeNull();
  });
});

describe('firstMerchantLine', () => {
  it('picks the first alphabetic line', () => {
    expect(firstMerchantLine(['', '12/09/2026', 'NAVIGATORSLAB STORE', 'Item 1'])).toBe('NAVIGATORSLAB STORE');
  });
  it('skips pure numbers', () => {
    expect(firstMerchantLine(['12345', '8.50', 'SHOP B'])).toBe('SHOP B');
  });
});
